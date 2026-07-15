import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CampaignMode = "manual" | "automatic";

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ADMIN_EMAIL = "prototipospremium@gmail.com";

function assertAdminEmail(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Forbidden: admin only");
}

async function assertAdmin(userId: string, claims?: { email?: string }) {
  void userId;
  assertAdminEmail(claims);
}

export const getCampaignMode = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "campaign_mode")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const mode = ((data?.value as { mode?: string } | null)?.mode ?? "manual") as CampaignMode;
  return { mode };
});

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = ((context.claims as { email?: string } | undefined)?.email ?? "").toLowerCase();
    return { isAdmin: email === ADMIN_EMAIL };
  });

export const setCampaignMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["manual", "automatic"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "campaign_mode", value: { mode: data.mode }, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { mode: data.mode };
  });

export interface AdminCampaignRow {
  id: string;
  user_id: string;
  client_name: string | null;
  client_email: string | null;
  name: string;
  status: "running" | "analyzing" | "paused" | "aguardando_vinculo_meta" | "rodando" | "encerrada_saldo_consumido" | "em_revisao";
  budget: number;
  days: number;
  spent: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  reach: number;
  results: number;
  revenue: number;
  frequency: number;
  cpm: number;
  cost_per_result: number;
  invoice_url: string | null;
  funding_type: "wallet" | "pix_dedicated";
  image: string;
  headline: string;
  copy: string;
  link: string;
  created_at: string;
  started_running_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  meta_campaign_id: string | null;

}

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCampaignRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: campaigns, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((campaigns ?? []).map((c) => c.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (campaigns ?? []).map((c) => {
      const p = pMap.get(c.user_id);
      return {
        id: c.id,
        user_id: c.user_id,
        client_name: p?.display_name ?? null,
        client_email: p?.email ?? null,
        name: c.name,
        status: c.status,
        budget: c.budget,
        days: c.days,
        spent: Number(c.spent),
        clicks: c.clicks,
        impressions: c.impressions,
        ctr: Number(c.ctr),
        cpc: Number(c.cpc),
        reach: c.reach ?? 0,
        results: c.results ?? 0,
        revenue: Number(c.revenue ?? 0),
        frequency: Number(c.frequency ?? 0),
        cpm: Number(c.cpm ?? 0),
        cost_per_result: Number(c.cost_per_result ?? 0),
        invoice_url: c.invoice_url ?? null,
        funding_type: (c.funding_type ?? "wallet") as "wallet" | "pix_dedicated",
        image: c.image,
        headline: c.headline,
        copy: c.copy,
        link: c.link,
        created_at: c.created_at,
        started_running_at: c.started_running_at ?? null,
        paused_at: c.paused_at ?? null,
        ended_at: c.ended_at ?? null,
        meta_campaign_id: c.meta_campaign_id ?? null,
      };
    });
  });


export const adminSetCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum([
        "running","analyzing","paused",
        "aguardando_vinculo_meta","rodando","encerrada_saldo_consumido","em_revisao",
      ]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Vincula manualmente o ID da campanha no Meta a uma campanha do sistema.
// Após salvo, o cron meta-metrics-sync passa a sincronizar as métricas reais.
export const adminSetMetaCampaignId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      meta_campaign_id: z.string().trim().max(64).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const value = data.meta_campaign_id && data.meta_campaign_id.length > 0
      ? data.meta_campaign_id.replace(/[^0-9]/g, "")
      : null;
    if (value && value.length < 6) throw new Error("ID do Meta inválido");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ meta_campaign_id: value })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "campaign_meta_link",
      target_type: "campaign",
      target_id: data.id,
      details: { meta_campaign_id: value },
    });
    return { ok: true, meta_campaign_id: value };
  });

// Submits campaign through Meta Marketing API (skeleton).
// In manual mode → returns analyzing; automatic mode → tries Meta API and falls back to analyzing on failure.
export const submitCampaignToMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: modeRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "campaign_mode")
      .maybeSingle();
    const mode = ((modeRow?.value as { mode?: string } | null)?.mode ?? "manual") as CampaignMode;

    if (mode === "manual") {
      await supabase.from("campaigns").update({ status: "analyzing" }).eq("id", data.campaignId);
      return { status: "analyzing" as const, mode };
    }

    // Automatic — call Meta Marketing API (skeleton; falls back on any failure)
    const token = process.env.META_AGENCY_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;
    try {
      if (!token || !adAccountId) throw new Error("Meta credentials missing");
      const res = await fetch(
        `https://graph.facebook.com/v20.0/act_${adAccountId}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: `RDL_${data.campaignId.slice(0, 8)}`,
            objective: "OUTCOME_TRAFFIC",
            status: "ACTIVE",
            special_ad_categories: [],
          }),
        },
      );
      if (!res.ok) throw new Error(`Meta API ${res.status}`);
      await supabase.from("campaigns").update({ status: "running" }).eq("id", data.campaignId);
      return { status: "running" as const, mode };
    } catch (err) {
      console.error("Meta submit failed, fallback to manual:", err);
      await supabase.from("campaigns").update({ status: "analyzing" }).eq("id", data.campaignId);
      return { status: "analyzing" as const, mode, fallback: true };
    }
  });

export interface WipeSnapshotItem {
  id: string;
  name: string;
  status: string;
  headline?: string;
  image?: string;
  budget?: number;
  days?: number;
  spent?: number;
}

export interface AdminWipeEventRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  active_count: number;
  total_count: number;
  campaigns_snapshot: WipeSnapshotItem[];
  created_at: string;
}

export const adminListWipeEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWipeEventRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("wipe_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: r.user_email,
      user_name: r.user_name,
      active_count: r.active_count,
      total_count: r.total_count,
      campaigns_snapshot: Array.isArray(r.campaigns_snapshot)
        ? (r.campaigns_snapshot as unknown as WipeSnapshotItem[])
        : [],
      created_at: r.created_at,
    }));
  });

// ============ Meta metrics health ============
export interface MetaMetricsHealth {
  last_run_at: string | null;
  last_status: string | null;
  processed_count: number;
  error_count: number;
  duration_ms: number | null;
  stale: boolean; // true se última execução > 90 min
}

export const getMetaMetricsHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaMetricsHealth> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data } = await admin
      .from("meta_metrics_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { last_run_at: null, last_status: null, processed_count: 0, error_count: 0, duration_ms: null, stale: true };
    }
    const lastAt = data.finished_at ?? data.started_at;
    const ageMin = (Date.now() - new Date(lastAt).getTime()) / 60000;
    return {
      last_run_at: lastAt,
      last_status: data.status,
      processed_count: data.processed_count ?? 0,
      error_count: data.error_count ?? 0,
      duration_ms: data.duration_ms,
      stale: ageMin > 90 || data.status === "error",
    };
  });

// ============ Ajuste manual de saldo ============
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      delta: z.number().refine((n) => n !== 0, "delta não pode ser zero"),
      reason: z.string().min(3, "motivo obrigatório (mín. 3 chars)"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: prof, error: pErr } = await admin
      .from("profiles").select("balance").eq("id", data.user_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const current = Number(prof?.balance ?? 0);
    const next = Number((current + data.delta).toFixed(2));
    const { error: uErr } = await admin
      .from("profiles").update({ balance: next }).eq("id", data.user_id);
    if (uErr) throw new Error(uErr.message);
    await admin.from("manual_balance_adjustments").insert({
      user_id: data.user_id,
      admin_id: context.userId,
      delta: data.delta,
      reason: data.reason,
      balance_after: next,
    });
    return { ok: true, balance_after: next };
  });

// ============ Notas internas por cliente ============
export const adminGetClientNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: row } = await admin
      .from("admin_notes").select("note, updated_at").eq("user_id", data.user_id).maybeSingle();
    return { note: row?.note ?? "", updated_at: row?.updated_at ?? null };
  });

export const adminSaveClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), note: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("admin_notes").upsert({
      user_id: data.user_id,
      note: data.note,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Ação em massa: pausar campanhas ============
export const adminBulkSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      status: z.enum(["running","analyzing","paused","aguardando_vinculo_meta","rodando","encerrada_saldo_consumido"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("campaigns").update({ status: data.status }).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

// ============ Export CSV de campanhas (completo) ============
export const adminExportCampaignsCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ csv: string }> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: campaigns } = await admin
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = campaigns ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const header = [
      "id","cliente_nome","cliente_email","campanha_nome","status","funding_type",
      "valor_total","criada_em","iniciou_em","pausada_em","encerrada_em",
      "meta_campaign_id","meta_ad_account_id",
      "cliques","impressoes","alcance","resultados",
      "ctr","cpc","cpm","frequencia","custo_por_resultado","gasto","receita",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      const p = pMap.get(r.user_id);
      const valorTotal = Number(r.pix_total_budget ?? (Number(r.budget) * Number(r.days)));
      const row = [
        r.id,
        p?.display_name ?? "",
        p?.email ?? "",
        r.name,
        r.status,
        r.funding_type ?? "wallet",
        valorTotal,
        r.created_at,
        r.started_running_at ?? "",
        r.paused_at ?? "",
        r.ended_at ?? "",
        r.meta_campaign_id ?? "",
        r.meta_ad_account_id ?? "",
        r.clicks,
        r.impressions,
        r.reach ?? 0,
        r.results ?? 0,
        r.ctr,
        r.cpc,
        r.cpm ?? 0,
        r.frequency ?? 0,
        r.cost_per_result ?? 0,
        r.spent,
        r.revenue ?? 0,
      ];
      lines.push(row.map(esc).join(","));
    }
    return { csv: lines.join("\n") };
  });

// ============ Access Requests (aprovação de novos usuários) ============
export interface AccessRequestRow {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export const adminListAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessRequestRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as AccessRequestRow[];
  });

export const adminApproveAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: req, error: rErr } = await admin
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("user_id")
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Solicitação não encontrada.");
    // Libera acesso real do usuário no profiles (upsert garante linha existente).
    const { data: authUser } = await admin.auth.admin.getUserById(req.user_id);
    const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const displayName =
      (meta.full_name as string) ||
      (meta.name as string) ||
      (authUser?.user?.email ? authUser.user.email.split("@")[0] : null);
    const { error: pErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: req.user_id,
          status: "approved",
          email: authUser?.user?.email ?? null,
          display_name: displayName,
        },
        { onConflict: "id" },
      );
    if (pErr) throw new Error(pErr.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "access_request_approve",
      target_type: "access_request",
      target_id: data.id,
    });
    return { ok: true };
  });

export const adminDenyAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: req, error } = await admin
      .from("access_requests")
      .update({
        status: "rejected",
        reason: data.reason ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("user_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (req) {
      await admin
        .from("profiles")
        .upsert({ id: req.user_id, status: "banned" }, { onConflict: "id" });
    }
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "access_request_deny",
      target_type: "access_request",
      target_id: data.id,
      details: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

// ============ Listar todos os clientes (para suporte proativo) ============
export interface AdminClientRow {
  id: string;
  display_name: string | null;
  email: string | null;
  balance: number;
  created_at: string;
}

export const adminListAllClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminClientRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, email, balance, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      email: r.email,
      balance: Number(r.balance ?? 0),
      created_at: r.created_at,
    }));
  });

// ============ Admin inicia conversa com um cliente ============
export const adminStartConversationWith = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: existing } = await admin
      .from("support_conversations")
      .select("id")
      .eq("user_id", data.user_id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { id: existing.id };
    const { data: created, error } = await admin
      .from("support_conversations")
      .insert({ user_id: data.user_id, status: "aberto", unread_by_client: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });



// ============ Contexto do cliente para a Central de Suporte ============
export interface AdminClientContext {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  balance: number;
  status: string | null;
  created_at: string;
  code: string;
  active_campaigns: Array<{
    id: string;
    name: string;
    status: string;
    budget: number;
    days: number;
    spent: number;
    created_at: string;
  }>;
}

export const adminGetClientContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AdminClientContext> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: p } = await admin
      .from("profiles")
      .select("id, display_name, email, phone, balance, status, created_at")
      .eq("id", data.user_id)
      .maybeSingle();
    const { data: camps } = await admin
      .from("campaigns")
      .select("id, name, status, budget, days, spent, created_at")
      .eq("user_id", data.user_id)
      .in("status", ["running", "rodando", "analyzing", "aguardando_vinculo_meta", "paused"])
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      id: data.user_id,
      display_name: p?.display_name ?? null,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      balance: Number(p?.balance ?? 0),
      status: p?.status ?? null,
      created_at: p?.created_at ?? new Date().toISOString(),
      code: data.user_id.slice(0, 8).toUpperCase(),
      active_campaigns: (camps ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        budget: Number(c.budget ?? 0),
        days: Number(c.days ?? 0),
        spent: Number(c.spent ?? 0),
        created_at: c.created_at,
      })),
    };
  });

// ============ Falhas de integração Asaas (auditoria PIX) ============
export interface PixAttemptRow {
  id: string;
  created_at: string;
  user_id: string;
  amount: number;
  campaign_id: string | null;
  asaas_customer_id: string | null;
  asaas_payment_id: string | null;
  http_status: number | null;
  ok: boolean;
  error_message: string | null;
  raw_payload: unknown;
}

export const adminListPixAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PixAttemptRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("pix_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as PixAttemptRow[];
  });

// ============ Banir / devolver acesso / editar saldo / editar métricas ============
export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), status: z.enum(["approved", "banned"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("profiles")
      .upsert({ id: data.user_id, status: data.status }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: data.status === "banned" ? "user_ban" : "user_unban",
      target_type: "user",
      target_id: data.user_id,
      details: {},
    });
    return { ok: true };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      delta: z.number(),
      reason: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: prof } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", data.user_id)
      .maybeSingle();
    const current = Number(prof?.balance ?? 0);
    const next = Number((current + data.delta).toFixed(2));
    const { error: uErr } = await admin
      .from("profiles")
      .update({ balance: next })
      .eq("id", data.user_id);
    if (uErr) throw new Error(uErr.message);
    await admin.from("manual_balance_adjustments").insert({
      user_id: data.user_id,
      admin_id: context.userId,
      delta: data.delta,
      reason: data.reason,
      balance_after: next,
    });
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "balance_adjust",
      target_type: "user",
      target_id: data.user_id,
      details: { delta: data.delta, reason: data.reason, balance_after: next },
    });
    return { ok: true, balance: next };
  });

export const adminUpdateCampaignMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      spent: z.number().optional(),
      clicks: z.number().int().optional(),
      impressions: z.number().int().optional(),
      ctr: z.number().optional(),
      cpc: z.number().optional(),
      cpm: z.number().optional(),
      frequency: z.number().optional(),
      results: z.number().int().optional(),
      revenue: z.number().optional(),
      cost_per_result: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { id, ...rest } = data;
    const update = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    const { error } = await admin.from("campaigns").update(update as never).eq("id", id);
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "campaign_metrics_edit",
      target_type: "campaign",
      target_id: id,
      details: update,
    });
    return { ok: true };
  });
