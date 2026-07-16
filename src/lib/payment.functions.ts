import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ADMIN_EMAIL = "prototipospremium@gmail.com";
const ASAAS_USER_AGENT = "RoboDeLucro/1.0 (+https://robo-promoter.lovable.app)";

async function assertAdmin(_userId: string, claims?: { email?: string }) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Forbidden: admin only");
}

function asaasHeaders(apiKey: string, json = false): Record<string, string> {
  const h: Record<string, string> = {
    access_token: apiKey,
    "User-Agent": ASAAS_USER_AGENT,
    accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export interface AsaasConfig {
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
  const asaas = (map.get("asaas_config") as AsaasConfig | undefined) ?? { api_key_set: false };
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
    z.object({ api_key_set: z.boolean().default(false) }).parse(d),
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

function extractAsaasError(json: unknown, status: number): string {
  const j = json as { errors?: Array<{ description?: string; code?: string }>; message?: string } | null;
  if (j?.errors && j.errors.length > 0) {
    return j.errors.map((e) => e.description || e.code || "").filter(Boolean).join("; ") || `HTTP ${status}`;
  }
  if (j?.message) return j.message;
  return `HTTP ${status}`;
}

async function logPixAttempt(row: {
  payment_request_id: string | null;
  user_id: string;
  amount: number;
  campaign_id: string | null;
  asaas_customer_id: string | null;
  asaas_payment_id: string | null;
  http_status: number | null;
  ok: boolean;
  error_message: string | null;
  raw_payload?: unknown;
}) {
  try {
    const admin = await getAdmin();
    await admin.from("pix_attempts").insert({
      ...row,
      raw_payload: row.raw_payload as never,
    });
  } catch (e) {
    console.error("logPixAttempt failed", e);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Asaas às vezes ainda não terminou de gerar o QR Code no instante seguinte
// à criação da cobrança (é assíncrono do lado deles). Sem retry, a primeira
// tentativa pode falhar mesmo com a cobrança criada com sucesso, fazendo a
// tela de pagamento mostrar erro para um pagamento que na verdade existe.
// Tenta algumas vezes, com espera crescente, antes de desistir de verdade.
async function fetchAsaasPixCode(
  paymentId: string,
  apiKey: string,
): Promise<{ payload: string | null; error: string | null; status: number }> {
  const maxAttempts = 4;
  let lastError: string | null = null;
  let lastStatus = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(`https://api.asaas.com/v3/payments/${paymentId}/pixQrCode`, {
        method: "GET",
        headers: asaasHeaders(apiKey),
      });
      const json = (await resp.json()) as AsaasPixQrCode;
      if (json.payload) return { payload: json.payload, error: null, status: resp.status };
      lastError = extractAsaasError(json, resp.status);
      lastStatus = resp.status;
    } catch (e) {
      lastError = String(e);
      lastStatus = 0;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(1200 + attempt * 800); // 1.2s, 2.0s, 2.8s
    }
  }
  return { payload: null, error: lastError, status: lastStatus };
}

async function getOrCreateAsaasCustomer(params: {
  apiKey: string;
  userId: string;
  email: string;
  name: string;
  cpfCnpj: string;
  phone?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const admin = await getAdmin();
  const { data: prof } = await admin
    .from("profiles")
    .select("asaas_customer_id")
    .eq("id", params.userId)
    .maybeSingle();
  const existing = (prof as { asaas_customer_id?: string | null } | null)?.asaas_customer_id;
  if (existing) {
    // Garante que o CPF/CNPJ está atualizado no cliente já criado — sem isso
    // clientes antigos (criados antes do campo ser obrigatório) continuam
    // rejeitando cobranças com "necessário preencher o CPF ou CNPJ".
    try {
      await fetch(`https://api.asaas.com/v3/customers/${existing}`, {
        method: "POST",
        headers: asaasHeaders(params.apiKey, true),
        body: JSON.stringify({
          name: params.name,
          email: params.email,
          cpfCnpj: params.cpfCnpj,
          mobilePhone: params.phone ?? undefined,
          postalCode: params.postalCode ?? undefined,
          addressNumber: params.addressNumber ?? undefined,
        }),
      });
    } catch { /* ignora — a cobrança abaixo dirá se ainda falta algo */ }
    return { id: existing, error: null };
  }

  try {
    const resp = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers: asaasHeaders(params.apiKey, true),
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        cpfCnpj: params.cpfCnpj,
        mobilePhone: params.phone ?? undefined,
        postalCode: params.postalCode ?? undefined,
        addressNumber: params.addressNumber ?? undefined,
        externalReference: params.userId,
      }),
    });
    const json = (await resp.json()) as { id?: string };
    if (!json.id) return { id: null, error: extractAsaasError(json, resp.status) };
    await admin.from("profiles").update({ asaas_customer_id: json.id }).eq("id", params.userId);
    return { id: json.id, error: null };
  } catch (e) {
    return { id: null, error: String(e) };
  }
}

async function createAsaasCharge(params: {
  apiKey: string;
  customerId: string;
  amount: number;
  externalReference: string;
  description: string;
  billingType: "PIX" | "CREDIT_CARD" | "UNDEFINED";
}): Promise<{
  id: string | null;
  invoiceUrl: string | null;
  pixCode: string | null;
  error: string | null;
  status: number;
}> {
  try {
    const due = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const payResp = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: asaasHeaders(params.apiKey, true),
      body: JSON.stringify({
        customer: params.customerId,
        billingType: params.billingType,
        value: params.amount,
        dueDate: due,
        externalReference: params.externalReference,
        description: params.description,
      }),
    });
    const pay = (await payResp.json()) as { id?: string; invoiceUrl?: string };
    if (!pay.id) {
      return {
        id: null,
        invoiceUrl: null,
        pixCode: null,
        error: extractAsaasError(pay, payResp.status),
        status: payResp.status,
      };
    }
    if (params.billingType === "PIX") {
      const qr = await fetchAsaasPixCode(pay.id, params.apiKey);
      return {
        id: pay.id,
        invoiceUrl: pay.invoiceUrl ?? null,
        pixCode: qr.payload,
        error: qr.error,
        status: payResp.status,
      };
    }
    return {
      id: pay.id,
      invoiceUrl: pay.invoiceUrl ?? null,
      pixCode: null,
      error: null,
      status: payResp.status,
    };
  } catch (e) {
    return { id: null, invoiceUrl: null, pixCode: null, error: String(e), status: 0 };
  }
}

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().int().min(20).max(100000),
      campaignId: z.string().uuid().optional(),
      billingType: z.enum(["PIX", "CREDIT_CARD"]).default("PIX"),
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

    const paymentType: "campaign_budget" | "balance_topup" = data.campaignId
      ? "campaign_budget"
      : "balance_topup";

    // Reutiliza uma solicitação pendente com o mesmo valor + campanha se existir.
    let prId: string | null = null;
    let existingPaymentId: string | null = null;
    if (data.campaignId) {
      const { data: reuse } = await admin
        .from("payment_requests")
        .select("id, asaas_payment_id, amount")
        .eq("user_id", context.userId)
        .eq("status", "pending")
        .eq("amount", data.amount)
        .eq("campaign_id", data.campaignId)
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
          type: paymentType,
          campaign_id: data.campaignId ?? null,
        } as never)
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
    let asaasCustomerId: string | null = null;
    let apiError: string | null = null;
    let httpStatus: number | null = null;
    let via: "api" | "fallback" | "none" = "none";

    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
      apiError = "ASAAS_API_KEY não configurada no servidor";
    } else {
      // Se já temos payment_id salvo e é PIX, tenta só buscar o QR de novo.
      if (existingPaymentId && data.billingType === "PIX") {
        const qr = await fetchAsaasPixCode(existingPaymentId, apiKey);
        pixCode = qr.payload;
        apiError = qr.error;
        httpStatus = qr.status;
        asaasPaymentId = existingPaymentId;
      }
      if (!pixCode && !invoiceUrl) {
        const email =
          (context.claims as { email?: string } | undefined)?.email ??
          `user-${context.userId}@robolucro.app`;
        const name = email.split("@")[0] || "Cliente";
        const cust = await getOrCreateAsaasCustomer({
          apiKey,
          userId: context.userId,
          email,
          name,
        });
        asaasCustomerId = cust.id;
        if (!cust.id) {
          apiError = cust.error ?? "Falha ao criar cliente Asaas";
        } else {
          const charge = await createAsaasCharge({
            apiKey,
            customerId: cust.id,
            amount: data.amount,
            externalReference,
            description: data.campaignId
              ? `Campanha PIX dedicado — ${data.campaignId}`
              : `Recarga de saldo — Robô de Lucro`,
            billingType: data.billingType,
          });
          asaasPaymentId = charge.id;
          invoiceUrl = charge.invoiceUrl;
          pixCode = charge.pixCode;
          apiError = charge.error;
          httpStatus = charge.status;
        }
      }
      if (pixCode || invoiceUrl) {
        via = "api";
        apiError = null;
        await admin
          .from("payment_requests")
          .update({
            asaas_link: invoiceUrl,
            asaas_payment_id: asaasPaymentId,
            last_error: null,
          } as never)
          .eq("id", prId);
      } else if (apiError) {
        await admin
          .from("payment_requests")
          .update({ last_error: apiError } as never)
          .eq("id", prId);
      }
    }

    // Registra a tentativa (sucesso ou falha) para auditoria.
    await logPixAttempt({
      payment_request_id: prId,
      user_id: context.userId,
      amount: data.amount,
      campaign_id: data.campaignId ?? null,
      asaas_customer_id: asaasCustomerId,
      asaas_payment_id: asaasPaymentId,
      http_status: httpStatus,
      ok: !!(pixCode || invoiceUrl),
      error_message: pixCode || invoiceUrl ? null : apiError,
      raw_payload: { billingType: data.billingType, via, type: paymentType },
    });

    // Fallback: chave PIX manual configurada pelo admin.
    let fallbackPix: { key: string; beneficiary: string } | null = null;
    if (!pixCode && !invoiceUrl && manualPix.enabled && manualPix.key.trim()) {
      fallbackPix = { key: manualPix.key.trim(), beneficiary: manualPix.beneficiary.trim() };
      via = "fallback";
    }

    return {
      id: prId,
      amount: data.amount,
      pixCode,
      invoiceUrl,
      fallbackPix,
      configured: !!(pixCode || invoiceUrl || fallbackPix),
      via,
      billingType: data.billingType,
      errorMessage: pixCode || invoiceUrl ? null : apiError,
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
