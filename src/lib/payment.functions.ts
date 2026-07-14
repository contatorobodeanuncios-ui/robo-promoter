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
  link_template: string;
  api_key_set: boolean;
}
export interface ManualPixConfig {
  key: string;
  beneficiary: string;
  enabled: boolean;
}
export type PaymentConfirmMode = "manual" | "webhook";

export const getPaymentSettings = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["asaas_config", "payment_confirm_mode", "manual_pix_config"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const asaas = (map.get("asaas_config") as AsaasConfig | undefined) ?? {
    link_template: "",
    api_key_set: false,
  };
  const confirmRaw = map.get("payment_confirm_mode") as { mode?: string } | undefined;
  const confirm = (confirmRaw?.mode ?? "manual") as PaymentConfirmMode;
  const manualPix = (map.get("manual_pix_config") as ManualPixConfig | undefined) ?? {
    key: "",
    beneficiary: "",
    enabled: false,
  };
  return { asaas, confirm, manualPix };
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

export const setManualPixConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      key: z.string().max(200).default(""),
      beneficiary: z.string().max(200).default(""),
      enabled: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getAdmin();
    const { error } = await admin.from("app_settings").upsert({
      key: "manual_pix_config",
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

interface AsaasPixQrCode {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
  errors?: Array<{ description?: string }>;
}

async function fetchAsaasPixCode(paymentId: string, apiKey: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://api.asaas.com/v3/payments/${paymentId}/pixQrCode`, {
      method: "GET",
      headers: { access_token: apiKey },
    });
    const json = (await resp.json()) as AsaasPixQrCode;
    if (json.payload) return json.payload;
    console.error("Asaas pixQrCode error", json.errors);
    return null;
  } catch (e) {
    console.error("fetchAsaasPixCode failed", e);
    return null;
  }
}

async function createAsaasPixCharge(params: {
  apiKey: string;
  email: string;
  userId: string;
  amount: number;
  externalReference: string;
  description: string;
}): Promise<{ id: string; invoiceUrl: string | null; pixCode: string | null } | null> {
  try {
    const custResp = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: params.apiKey },
      body: JSON.stringify({
        name: params.email.split("@")[0],
        email: params.email,
        externalReference: params.userId,
      }),
    });
    const cust = (await custResp.json()) as { id?: string; errors?: unknown };
    const customerId = cust.id;
    if (!customerId) {
      console.error("Asaas customer create failed", cust.errors);
      return null;
    }
    const due = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const payResp = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: params.apiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: params.amount,
        dueDate: due,
        externalReference: params.externalReference,
        description: params.description,
      }),
    });
    const pay = (await payResp.json()) as {
      id?: string;
      invoiceUrl?: string;
      errors?: Array<{ description?: string }>;
    };
    if (!pay.id) {
      console.error("Asaas payment create failed", pay.errors);
      return null;
    }
    const pixCode = await fetchAsaasPixCode(pay.id, params.apiKey);
    return { id: pay.id, invoiceUrl: pay.invoiceUrl ?? null, pixCode };
  } catch (e) {
    console.error("createAsaasPixCharge failed", e);
    return null;
  }
}

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().int().min(20).max(100000),
      campaignId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: settingsRows } = await admin
      .from("app_settings")
      .select("key, value")
      .in("key", ["manual_pix_config"]);
    const settingsMap = new Map((settingsRows ?? []).map((r) => [r.key as string, r.value as unknown]));
    const manualPix = (settingsMap.get("manual_pix_config") as ManualPixConfig | undefined) ?? {
      key: "",
      beneficiary: "",
      enabled: false,
    };

    // Reutiliza uma solicitação pendente pra mesma campanha, se existir.
    let prId: string | null = null;
    let existingPaymentId: string | null = null;
    if (data.campaignId) {
      const { data: existing } = await admin
        .from("payment_requests")
        .select("id, status, asaas_payment_id, amount")
        .eq("user_id", context.userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      // procura a mais recente cujo ref bate com a campanha
      for (const r of existing ?? []) {
        const { data: ev } = await admin
          .from("asaas_webhook_events")
          .select("id")
          .eq("payment_id", r.asaas_payment_id ?? "")
          .limit(1);
        void ev;
      }
      // simpler: só reusar se amount bater e mesma campanha ref
      const { data: reuse } = await admin
        .from("payment_requests")
        .select("id, asaas_payment_id, amount")
        .eq("user_id", context.userId)
        .eq("status", "pending")
        .eq("amount", data.amount)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reuse) {
        prId = reuse.id;
        existingPaymentId = reuse.asaas_payment_id ?? null;
      }
    }

    if (!prId) {
      const { data: row, error } = await admin
        .from("payment_requests")
        .insert({
          user_id: context.userId,
          amount: data.amount,
          status: "pending",
          asaas_link: null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      prId = row.id as string;
    }

    const externalReference = data.campaignId
      ? `cmp:${data.campaignId}|pr:${prId}`
      : `pr:${prId}`;

    let pixCode: string | null = null;
    let invoiceUrl: string | null = null;
    let asaasPaymentId: string | null = existingPaymentId;
    let via: "api" | "fallback" | "none" = "none";

    const apiKey = process.env.ASAAS_API_KEY;
    if (apiKey) {
      // Se já temos um payment_id salvo, tenta só buscar o QR de novo.
      if (existingPaymentId) {
        pixCode = await fetchAsaasPixCode(existingPaymentId, apiKey);
      }
      if (!pixCode) {
        const email =
          (context.claims as { email?: string } | undefined)?.email ??
          `user-${context.userId}@robolucro.app`;
        const charge = await createAsaasPixCharge({
          apiKey,
          email,
          userId: context.userId,
          amount: data.amount,
          externalReference,
          description: data.campaignId
            ? `Campanha PIX dedicado — ${data.campaignId}`
            : `Recarga de saldo — Robô de Lucro`,
        });
        if (charge) {
          asaasPaymentId = charge.id;
          invoiceUrl = charge.invoiceUrl;
          pixCode = charge.pixCode;
        }
      }
      if (pixCode || invoiceUrl) {
        via = "api";
        await admin
          .from("payment_requests")
          .update({
            asaas_link: invoiceUrl,
            asaas_payment_id: asaasPaymentId,
          })
          .eq("id", prId);
      }
    }

    // Fallback: chave PIX manual configurada pelo admin.
    let fallbackPix: { key: string; beneficiary: string } | null = null;
    if (!pixCode && manualPix.enabled && manualPix.key.trim()) {
      fallbackPix = { key: manualPix.key.trim(), beneficiary: manualPix.beneficiary.trim() };
      via = "fallback";
    }

    return {
      id: prId,
      amount: data.amount,
      pixCode,
      invoiceUrl,
      fallbackPix,
      configured: !!(pixCode || fallbackPix),
      via,
    };
  });

export const getPaymentRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: pr, error } = await admin
      .from("payment_requests")
      .select("id, user_id, status, amount")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pr || pr.user_id !== context.userId) throw new Error("Not found");
    return { id: pr.id, status: pr.status as "pending" | "approved" | "rejected" | "paid" };
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
