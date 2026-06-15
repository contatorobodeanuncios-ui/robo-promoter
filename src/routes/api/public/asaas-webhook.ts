import { createFileRoute } from "@tanstack/react-router";

// Webhook do Asaas — chamado quando o cliente confirma o pagamento.
// Segurança: Asaas envia o header `asaas-access-token`. Comparamos com o
// secret `ASAAS_WEBHOOK_TOKEN` (configurável via Secrets). Se o admin ainda
// não configurou o secret, o endpoint REJEITA tudo — não credita saldo às cegas.
export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!expected) {
          return new Response(
            JSON.stringify({ error: "Webhook token not configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
        const got = request.headers.get("asaas-access-token") || "";
        if (got !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { event?: string; payment?: { id?: string; externalReference?: string; value?: number; status?: string } };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event ?? "";
        const payment = payload?.payment ?? {};
        // Só processa eventos de pagamento confirmado/recebido
        if (!event.startsWith("PAYMENT_CONFIRMED") && !event.startsWith("PAYMENT_RECEIVED")) {
          return new Response(JSON.stringify({ ok: true, ignored: event }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // O `externalReference` deve carregar o id da payment_request (definido na criação).
        const requestId = payment.externalReference;
        if (!requestId) {
          return new Response("Missing externalReference", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pr, error } = await supabaseAdmin
          .from("payment_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();
        if (error || !pr) {
          return new Response("Payment request not found", { status: 404 });
        }
        if (pr.status === "paid") {
          return new Response(JSON.stringify({ ok: true, already: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: profile, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("balance")
          .eq("id", pr.user_id)
          .single();
        if (pErr) return new Response(pErr.message, { status: 500 });
        const nextBalance = Number(profile.balance) + Number(pr.amount);

        await supabaseAdmin.from("profiles").update({ balance: nextBalance }).eq("id", pr.user_id);
        await supabaseAdmin
          .from("payment_requests")
          .update({
            status: "paid",
            asaas_payment_id: payment.id ?? null,
            approved_at: new Date().toISOString(),
          })
          .eq("id", pr.id);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
