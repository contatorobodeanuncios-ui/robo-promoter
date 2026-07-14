import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ADMIN_EMAIL = "prototipospremium@gmail.com";

async function assertAdmin(_userId: string, claims?: { email?: string }) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Forbidden: admin only");
}

export interface AsaasConfig {
  link_template: string; // ex: "https://www.asaas.com/c/abcd?value={amount}"
  api_key_set: boolean;
}
export type PaymentConfirmMode = "manual" | "webhook";

export const getPaymentSettings = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["asaas_config", "payment_confirm_mode"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const asaas = (map.get("asaas_config") as AsaasConfig | undefined) ?? {
    link_template: "",
    api_key_set: false,
  };
  const confirmRaw = map.get("payment_confirm_mode") as { mode?: string } | undefined;
  const confirm = (confirmRaw?.mode ?? "manual") as PaymentConfirmMode;
  return { asaas, confirm };
});

export const setAsaasConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ link_template: z.string().max(500).default(""), api_key_set: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { error } = await admin.from("app_settings").upsert({
      key: "asaas_config",
      value: data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return data;
  });

export const setPaymentConfirmMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["manual", "webhook"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { error } = await admin.from("app_settings").upsert({
      key: "payment_confirm_mode",
      value: { mode: data.mode },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { mode: data.mode };
  });

const ALLOWED_PRESETS = [20, 50, 100, 200, 500, 1000] as const;

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().int().min(20).max(100000),
      campaignId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    void ALLOWED_PRESETS;
    const admin = await getAdmin();
    const { data: cfgRow } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "asaas_config")
      .maybeSingle();
    const cfg = (cfgRow?.value as AsaasConfig | null) ?? { link_template: "", api_key_set: false };

    // Cria linha em payment_requests primeiro para termos o id (usado como externalReference).
    const { data: row, error } = await admin
      .from("payment_requests")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        status: "pending",
        asaas_link: null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const prId = row.id as string;
    // externalReference: `pr:<uuid>` para top-up de saldo; `cmp:<campaignId>|pr:<uuid>` para campanha PIX dedicado.
    const externalReference = data.campaignId
      ? `cmp:${data.campaignId}|pr:${prId}`
      : `pr:${prId}`;

    let link = "";
    let usedApi = false;

    const apiKey = process.env.ASAAS_API_KEY;
    if (apiKey) {
      try {
        // 1) upsert de customer usando o e-mail do usuário logado (fallback: user_id).
        const email = (context.claims as { email?: string } | undefined)?.email ?? `user-${context.userId}@robolucro.app`;
        const custResp = await fetch("https://api.asaas.com/v3/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: apiKey,
          },
          body: JSON.stringify({
            name: email.split("@")[0],
            email,
            externalReference: context.userId,
          }),
        });
        const cust = (await custResp.json()) as { id?: string; errors?: unknown };
        const customerId = cust.id;
        if (customerId) {
          const due = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
          const payResp = await fetch("https://api.asaas.com/v3/payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              access_token: apiKey,
            },
            body: JSON.stringify({
              customer: customerId,
              billingType: "PIX",
              value: data.amount,
              dueDate: due,
              externalReference,
              description: data.campaignId
                ? `Campanha PIX dedicado — ${data.campaignId}`
                : `Recarga de saldo — Robô de Lucro`,
            }),
          });
          const pay = (await payResp.json()) as { id?: string; invoiceUrl?: string; errors?: Array<{ description?: string }> };
          if (pay.invoiceUrl) {
            link = pay.invoiceUrl;
            usedApi = true;
            await admin
              .from("payment_requests")
              .update({ asaas_link: link, asaas_payment_id: pay.id ?? null })
              .eq("id", prId);
          } else {
            console.error("Asaas payment error", pay.errors);
          }
        }
      } catch (err) {
        console.error("Asaas API failure, falling back to link_template", err);
      }
    }

    if (!link && cfg.link_template) {
      link = cfg.link_template
        .replace("{amount}", String(data.amount))
        .replace("{value}", String(data.amount))
        .replace("{ref}", externalReference);
      await admin.from("payment_requests").update({ asaas_link: link }).eq("id", prId);
    }

    return {
      id: prId,
      amount: Number(row.amount),
      link,
      externalReference,
      configured: !!link,
      via: usedApi ? "api" : link ? "template" : "none",
    };
  });

export interface PaymentRequestRow {
  id: string;
  user_id: string;
  client_name: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  asaas_link: string | null;
  created_at: string;
}

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentRequestRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      client_name: names.get(r.user_id) ?? null,
      amount: Number(r.amount),
      status: r.status,
      asaas_link: r.asaas_link,
      created_at: r.created_at,
    }));
  });

export const adminApprovePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { data: pr, error } = await admin
      .from("payment_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pr) throw new Error("Solicitação de pagamento não encontrada.");
    if (pr.status === "paid" || pr.status === "approved") return { ok: true, already: true };

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", pr.user_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const currentBalance = Number(profile?.balance ?? 0);
    const next = Number((currentBalance + Number(pr.amount)).toFixed(2));

    if (!profile) {
      // Cria profile mínimo se não existir, para não perder a aprovação.
      await admin.from("profiles").insert({ id: pr.user_id, balance: next }).select().maybeSingle();
    } else {
      const { error: uErr } = await admin
        .from("profiles")
        .update({ balance: next })
        .eq("id", pr.user_id);
      if (uErr) throw new Error(uErr.message);
    }
    const { error: sErr } = await admin
      .from("payment_requests")
      .update({ status: "paid", approved_at: new Date().toISOString() })
      .eq("id", pr.id);
    if (sErr) throw new Error(sErr.message);
    return { ok: true };
  });

export const adminRejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { error } = await admin
      .from("payment_requests")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
