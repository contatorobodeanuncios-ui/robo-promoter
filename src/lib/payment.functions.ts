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
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
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
    z.object({ amount: z.number().int().min(20).max(100000) }).parse(d),
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
    const link = cfg.link_template
      ? cfg.link_template
          .replace("{amount}", String(data.amount))
          .replace("{value}", String(data.amount))
      : "";
    const { data: row, error } = await admin
      .from("payment_requests")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        status: "pending",
        asaas_link: link || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id as string,
      amount: Number(row.amount),
      link,
      configured: !!cfg.link_template,
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
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    const admin = await getAdmin();
    const { data: pr, error } = await admin
      .from("payment_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (pr.status === "paid" || pr.status === "approved") return { ok: true, already: true };

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", pr.user_id)
      .single();
    if (pErr) throw new Error(pErr.message);
    const next = Number(profile.balance) + Number(pr.amount);

    const { error: uErr } = await admin
      .from("profiles")
      .update({ balance: next })
      .eq("id", pr.user_id);
    if (uErr) throw new Error(uErr.message);
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
    await assertAdmin(context.userId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("payment_requests")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
