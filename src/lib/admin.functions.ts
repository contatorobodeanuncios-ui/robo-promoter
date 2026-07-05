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
  name: string;
  status: "running" | "analyzing" | "paused" | "aguardando_vinculo_meta" | "rodando" | "encerrada_saldo_consumido";
  budget: number;
  days: number;
  spent: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  image: string;
  headline: string;
  copy: string;
  link: string;
  created_at: string;
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
      .select("id, display_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return (campaigns ?? []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      client_name: nameById.get(c.user_id) ?? null,
      name: c.name,
      status: c.status,
      budget: c.budget,
      days: c.days,
      spent: Number(c.spent),
      clicks: c.clicks,
      impressions: c.impressions,
      ctr: Number(c.ctr),
      cpc: Number(c.cpc),
      image: c.image,
      headline: c.headline,
      copy: c.copy,
      link: c.link,
      created_at: c.created_at,
    }));
  });

export const adminSetCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum([
        "running","analyzing","paused",
        "aguardando_vinculo_meta","rodando","encerrada_saldo_consumido",
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

// ============ Export CSV de campanhas ============
export const adminExportCampaignsCSV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ csv: string }> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data } = await admin.from("campaigns").select("*").order("created_at", { ascending: false });
    const rows = data ?? [];
    const header = ["id","user_id","name","status","budget","spent","clicks","impressions","ctr","cpc","created_at"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(header.map((h) => esc((r as Record<string, unknown>)[h])).join(","));
    }
    return { csv: lines.join("\n") };
  });

