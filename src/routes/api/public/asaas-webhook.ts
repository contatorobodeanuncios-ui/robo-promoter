import { createFileRoute } from "@tanstack/react-router";

// Webhook do Asaas — chamado quando o cliente confirma o pagamento.
// Segurança: Asaas envia o header `asaas-access-token`. Comparamos com o
// secret `ASAAS_WEBHOOK_TOKEN`.
//
// Idempotência: registra cada evento em `asaas_webhook_events` com UNIQUE em
// `asaas_event_id`. Se o mesmo evento chegar 2x (o Asaas reenvia por 24h em
// caso de erro), o segundo insert falha e retornamos 200 sem re-creditar.
//
// Roteamento por externalReference:
//   - "pr:<uuid>"                → top-up de saldo do app (profiles.balance).
//   - "cmp:<campaignId>|pr:<uuid>" → PIX dedicado: credita pix_remaining_budget
//     da campanha e marca status=rodando. Não vai pro saldo.
export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit, ipFromRequest } = await import("@/lib/rate-limit");
        const ip = ipFromRequest(request);
        const rl = rateLimit(`asaas-webhook:${ip}`, 60, 5 * 60 * 1000);
        if (!rl.ok) return new Response("Too many requests", { status: 429 });

        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!expected) {
          return json({ error: "Webhook token not configured" }, 503);
        }
        const got = request.headers.get("asaas-access-token") || "";
        const a = Buffer.from(got);
        const b = Buffer.from(expected);
        const { timingSafeEqual } = await import("crypto");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: {
          id?: string;
          event?: string;
          payment?: {
            id?: string;
            externalReference?: string;
            value?: number;
            status?: string;
          };
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event ?? "";
        const payment = payload?.payment ?? {};
        // Id único do evento: prefere payload.id, fallback para paymentId+event.
        const eventId = payload.id
          ? String(payload.id)
          : `${event}:${payment.id ?? "unknown"}:${payment.status ?? ""}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotência: tenta inserir; se der conflito, ignora silenciosamente.
        const { error: dedupErr } = await supabaseAdmin
          .from("asaas_webhook_events")
          .insert({
            asaas_event_id: eventId,
            event_type: event,
            payment_id: payment.id ?? null,
            external_reference: payment.externalReference ?? null,
            raw_payload: payload as unknown as never,
          });
        if (dedupErr) {
          // 23505 = unique_violation. Já processado.
          if ((dedupErr as { code?: string }).code === "23505") {
            return json({ ok: true, duplicated: true }, 200);
          }
          console.error("webhook dedup insert failed", dedupErr);
        }

        if (!event.startsWith("PAYMENT_CONFIRMED") && !event.startsWith("PAYMENT_RECEIVED")) {
          return json({ ok: true, ignored: event }, 200);
        }

        const ref = payment.externalReference ?? "";
        if (!ref) return new Response("Missing externalReference", { status: 400 });

        // Parse do ref.
        let campaignId: string | null = null;
        let prId: string | null = null;
        for (const part of ref.split("|")) {
          if (part.startsWith("cmp:")) campaignId = part.slice(4);
          else if (part.startsWith("pr:")) prId = part.slice(3);
          else if (!prId) prId = part; // formato legado sem prefixo
        }
        if (!prId) return new Response("Invalid externalReference", { status: 400 });

        const { data: pr, error } = await supabaseAdmin
          .from("payment_requests")
          .select("*")
          .eq("id", prId)
          .maybeSingle();
        if (error || !pr) {
          return new Response("Payment request not found", { status: 404 });
        }
        if (pr.status === "paid") {
          return json({ ok: true, already: true }, 200);
        }

        if (campaignId) {
          // PIX dedicado → credita saldo da campanha e coloca pra rodar.
          const { data: camp, error: cErr } = await supabaseAdmin
            .from("campaigns")
            .select("id, pix_remaining_budget, pix_total_budget")
            .eq("id", campaignId)
            .maybeSingle();
          if (cErr || !camp) {
            return new Response("Campaign not found", { status: 404 });
          }
          const currentRemaining = Number(camp.pix_remaining_budget ?? 0);
          const currentTotal = Number(camp.pix_total_budget ?? 0);
          const value = Number(pr.amount);
          await supabaseAdmin
            .from("campaigns")
            .update({
              pix_remaining_budget: currentRemaining + value,
              pix_total_budget: currentTotal > 0 ? currentTotal : value,
              total_paid: value,
              status: "rodando",
            })
            .eq("id", campaignId);
        } else {
          // Top-up de saldo do app.
          const { data: profile, error: pErr } = await supabaseAdmin
            .from("profiles")
            .select("balance")
            .eq("id", pr.user_id)
            .single();
          if (pErr) return new Response(pErr.message, { status: 500 });
          const nextBalance = Number(profile.balance) + Number(pr.amount);
          await supabaseAdmin
            .from("profiles")
            .update({ balance: nextBalance })
            .eq("id", pr.user_id);
        }

        await supabaseAdmin
          .from("payment_requests")
          .update({
            status: "paid",
            asaas_payment_id: payment.id ?? null,
            approved_at: new Date().toISOString(),
          })
          .eq("id", pr.id);

        return json({ ok: true }, 200);
      },
    },
  },
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
