import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { parseMedia, type CampaignMediaItem, type CampaignMediaType } from "@/lib/data.functions";

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
  city: string;
  neighborhood: string;
  radius: number;
  total_paid: number;
  pix_total_budget: number;
  pix_remaining_budget: number;
  image: string;
  headline: string;
  copy: string;
  link: string;
  created_at: string;
  started_running_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  meta_campaign_id: string | null;
  meta_effective_status: string | null;
  metrics_last_error: string | null;
  metrics_last_synced_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  media_type: CampaignMediaType;
  media: CampaignMediaItem[];
  archived_at: string | null;
  archived_reason: "deleted" | "awaiting_payment" | null;
  extra_views?: number | null;
  extra_paid?: number | null;
  queue_priority?: number | null;
  client_plan?: string | null;
}


export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCampaignRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: campaigns, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      // Fila de execução: Pro Max (prioridade) primeiro, depois ordem de chegada.
      .order("queue_priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((campaigns ?? []).map((c) => c.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, plan")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (campaigns ?? []).map((c) => {
      const p = pMap.get(c.user_id);
      return {
        id: c.id,
        user_id: c.user_id,
        client_name: p?.display_name ?? null,
        client_email: p?.email ?? null,
        client_plan: (p as { plan?: string } | undefined)?.plan ?? null,
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
        city: c.city ?? "",
        neighborhood: c.neighborhood ?? "",
        radius: c.radius ?? 0,
        total_paid: Number(c.total_paid ?? 0),
        pix_total_budget: Number(c.pix_total_budget ?? 0),
        pix_remaining_budget: Number(c.pix_remaining_budget ?? 0),
        image: c.image,
        headline: c.headline,
        copy: c.copy,
        link: c.link,
        created_at: c.created_at,
        started_running_at: c.started_running_at ?? null,
        paused_at: c.paused_at ?? null,
        ended_at: c.ended_at ?? null,
        meta_campaign_id: c.meta_campaign_id ?? null,
        meta_effective_status: c.meta_effective_status ?? null,
        metrics_last_error: c.metrics_last_error ?? null,
        metrics_last_synced_at: c.metrics_last_synced_at ?? null,
        scheduled_start_at: c.scheduled_start_at ?? null,
        scheduled_end_at: c.scheduled_end_at ?? null,
        media_type: ((c as { media_type?: string }).media_type ?? "image") as CampaignMediaType,
        media: parseMedia((c as { media?: unknown }).media),
        archived_at: (c as { archived_at?: string | null }).archived_at ?? null,
        archived_reason:
          ((c as { archived_reason?: string | null }).archived_reason ?? null) as
            | "deleted"
            | "awaiting_payment"
            | null,
      };


    });
  });

// ============ Arquivamento de campanhas (admin) ============
// "Apagar" e "Aguardando pagamento" não deletam nada: só tiram a campanha da
// lista principal e a jogam para a aba de arquivadas correspondente.
export const adminArchiveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      reason: z.enum(["deleted", "awaiting_payment"]).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({
        archived_at: data.reason ? new Date().toISOString() : null,
        archived_reason: data.reason,
        archived_by: data.reason ? context.userId : null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: data.reason ? `campaign_archive_${data.reason}` : "campaign_unarchive",
      target_type: "campaign",
      target_id: data.id,
    });
    return { ok: true };
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
      lock: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    // Quando o admin define o status manualmente, travamos a campanha para que a
    // sincronizacao automatica do Meta nao volte o status sozinha (ex.: para "em_revisao").
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: data.status, admin_status_lock: data.lock ?? true } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface MetaAdAccountCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  ad_account_id: string;
  account_id: string;
  account_name: string;
  already_linked_to: string | null; // nome da campanha do app que já usa esse ID, se houver
}

export interface MetaAdAccountInfo {
  account_id: string;
  account_name: string;
  campaign_count: number;
  error: string | null;
}

export interface MetaAdAccountCampaignsResult {
  campaigns: MetaAdAccountCampaign[];
  accounts: MetaAdAccountInfo[];
}

// Busca as campanhas que existem de verdade nas contas de anúncios do Meta
// (usa META_AD_ACCOUNT_ID + META_ACCESS_TOKEN). Suporta várias contas:
// IDs separados por vírgula no secret META_AD_ACCOUNT_ID.
// Contas que falham não derrubam a busca — voltam com `error` preenchido.
export const adminListMetaAdAccountCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaAdAccountCampaignsResult> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const token = process.env.META_ACCESS_TOKEN;
    const rawAccountIds = process.env.META_AD_ACCOUNT_ID;
    if (!token) throw new Error("META_ACCESS_TOKEN não configurado no servidor");
    if (!rawAccountIds) throw new Error("META_AD_ACCOUNT_ID não configurado no servidor");

    const accountIds = rawAccountIds
      .split(",")
      .map((id) => id.trim().replace(/^act_/, ""))
      .filter(Boolean);
    if (accountIds.length === 0) throw new Error("META_AD_ACCOUNT_ID está vazio");

    const admin = await getSupabaseAdmin();
    const { data: already } = await admin
      .from("campaigns")
      .select("name, meta_campaign_id")
      .not("meta_campaign_id", "is", null);
    const linkedMap = new Map((already ?? []).map((c) => [c.meta_campaign_id as string, c.name]));

    const campaigns: MetaAdAccountCampaign[] = [];
    const accounts: MetaAdAccountInfo[] = [];

    for (const accId of accountIds) {
      let accountName = `act_${accId}`;
      try {
        const infoRes = await fetch(
          `https://graph.facebook.com/v20.0/act_${accId}?fields=name,account_status&access_token=${encodeURIComponent(token)}`,
        );
        if (infoRes.ok) {
          const info = (await infoRes.json()) as { name?: string };
          if (info.name) accountName = info.name;
        }

        const url = `https://graph.facebook.com/v20.0/act_${accId}/campaigns?fields=id,name,status,effective_status&limit=200&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status} — ${txt.slice(0, 150)}`);
        }
        const json = (await res.json()) as {
          data?: Array<{ id: string; name: string; status: string; effective_status: string }>;
        };
        const list = json.data ?? [];
        for (const c of list) {
          campaigns.push({
            id: c.id,
            name: c.name,
            status: c.status,
            effective_status: c.effective_status,
            ad_account_id: accId,
            account_id: accId,
            account_name: accountName,
            already_linked_to: linkedMap.get(c.id) ?? null,
          });
        }
        accounts.push({ account_id: accId, account_name: accountName, campaign_count: list.length, error: null });
      } catch (e) {
        accounts.push({
          account_id: accId,
          account_name: accountName,
          campaign_count: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (campaigns.length === 0 && accounts.every((a) => a.error)) {
      throw new Error(accounts.map((a) => `${a.account_name}: ${a.error}`).join(" | "));
    }
    return { campaigns, accounts };
  });

// Sincroniza métricas de UMA campanha logo após o vínculo, para o admin ver
// resultado imediato em vez de esperar o cron.
async function syncSingleCampaignMetrics(campaignId: string, metaCampaignId: string) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");
  const url = `https://graph.facebook.com/v20.0/${metaCampaignId}/insights?fields=spend,clicks,impressions,ctr,cpc,reach,frequency,cpm&date_preset=maximum&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const json = (await res.json()) as {
    data?: Array<Record<string, string>>;
  };
  const row = json.data?.[0];
  const admin = await getSupabaseAdmin();
  const n = (v: string | undefined) => (v == null ? 0 : Number(v) || 0);
  await admin
    .from("campaigns")
    .update({
      spent: n(row?.spend),
      clicks: Math.round(n(row?.clicks)),
      impressions: Math.round(n(row?.impressions)),
      ctr: n(row?.ctr),
      cpc: n(row?.cpc),
      reach: Math.round(n(row?.reach)),
      frequency: n(row?.frequency),
      cpm: n(row?.cpm),
      metrics_last_synced_at: new Date().toISOString(),
      metrics_last_error: null,
    })
    .eq("id", campaignId);
}

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

    let synced = false;
    let syncError: string | null = null;
    if (value) {
      try {
        await syncSingleCampaignMetrics(data.id, value);
        synced = true;
      } catch (e) {
        syncError = e instanceof Error ? e.message : String(e);
        await supabaseAdmin
          .from("campaigns")
          .update({ metrics_last_error: syncError })
          .eq("id", data.id);
      }
    }
    return { ok: true as const, meta_campaign_id: value, synced, syncError };
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
      .select("id, display_name, email, plan")
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
  /** nível do usuário, vindo do perfil */
  plan: "free" | "pro" | "trial_pro" | "credits" | "pro_max";
  trial_days: number | null;
  trial_started_at: string | null;
  phone: string | null;
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
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const ids = Array.from(new Set(rows.map((r) => String(r.user_id))));
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, plan, trial_days, trial_started_at, phone")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        p as unknown as {
          plan?: string | null;
          trial_days?: number | null;
          trial_started_at?: string | null;
          phone?: string | null;
        },
      ]),
    );
    return rows.map((r) => {
      const prof = byId.get(String(r.user_id));
      return {
        ...(r as unknown as AccessRequestRow),
        plan: ((prof?.plan ?? "free") as AccessRequestRow["plan"]),
        trial_days: prof?.trial_days ?? null,
        trial_started_at: prof?.trial_started_at ?? null,
        phone: prof?.phone ?? null,
      };
    });
  });

// ============ Nível do usuário: Free / Pro / Teste Pro ============
export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        plan: z.enum(["free", "pro", "trial_pro", "credits", "pro_max"]),
        trial_days: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const patch: Record<string, unknown> = { plan: data.plan };
    if (data.plan === "trial_pro") {
      patch.trial_days = data.trial_days ?? 7;
      patch.trial_started_at = new Date().toISOString();
    } else {
      patch.trial_days = null;
      patch.trial_started_at = null;
    }
    const { error } = await admin
      .from("profiles")
      .upsert({ id: data.user_id, ...patch } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "user_set_plan",
      target_type: "user",
      target_id: data.user_id,
      details: patch as never,
    } as never);
    await applyQueuePriority(data.user_id, data.plan);
    return { ok: true, plan: data.plan };
  });

/** Selo dourado Pro Max = prioridade 1 nas filas de pagamento e execução. */
async function applyQueuePriority(userId: string, plan: string) {
  const admin = await getSupabaseAdmin();
  const priority = plan === "pro_max" ? 1 : 0;
  await admin.from("campaigns").update({ queue_priority: priority } as never).eq("user_id", userId);
  await admin
    .from("payment_requests")
    .update({ queue_priority: priority } as never)
    .eq("user_id", userId);
}

/** Mudança de plano em massa (vários usuários de uma vez). */
export const adminBulkSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_ids: z.array(z.string().uuid()).min(1).max(500),
        plan: z.enum(["free", "pro", "trial_pro", "credits", "pro_max"]),
        trial_days: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const patch: Record<string, unknown> = { plan: data.plan };
    if (data.plan === "trial_pro") {
      patch.trial_days = data.trial_days ?? 7;
      patch.trial_started_at = new Date().toISOString();
    } else {
      patch.trial_days = null;
      patch.trial_started_at = null;
    }
    const rows = data.user_ids.map((id) => ({ id, ...patch }));
    const { error } = await admin.from("profiles").upsert(rows as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    for (const id of data.user_ids) await applyQueuePriority(id, data.plan);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "user_bulk_set_plan",
      target_type: "user",
      target_id: `${data.user_ids.length} usuários`,
      details: { plan: data.plan, user_ids: data.user_ids } as never,
    } as never);
    return { ok: true, count: data.user_ids.length };
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

// ============ Listar todos os clientes (para suporte proativo e gestão) ============
export interface AdminClientRow {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  balance: number;
  status: string;
  created_at: string;
  plan: "free" | "pro" | "trial_pro" | "credits" | "pro_max";
  trial_days: number | null;
  trial_started_at: string | null;
}

export const adminListAllClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminClientRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, email, phone, balance, status, created_at, plan, trial_days, trial_started_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      email: r.email,
      phone: r.phone,
      balance: Number(r.balance ?? 0),
      status: r.status ?? "approved",
      created_at: r.created_at,
      plan: ((r as unknown as { plan?: string }).plan ?? "free") as AdminClientRow["plan"],
      trial_days: (r as unknown as { trial_days?: number | null }).trial_days ?? null,
      trial_started_at: (r as unknown as { trial_started_at?: string | null }).trial_started_at ?? null,
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
      .select("id, display_name, email, phone, balance, status, created_at, plan, trial_days, trial_started_at")
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
  raw_payload: Json | null;
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

// ============ Banir / devolver acesso / editar saldo / editar perfil / editar métricas ============
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

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      display_name: z.string().max(200).nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().max(30).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { user_id, ...rest } = data;
    const update: { display_name?: string | null; email?: string | null; phone?: string | null } = {};
    if (rest.display_name !== undefined) update.display_name = rest.display_name;
    if (rest.email !== undefined) update.email = rest.email;
    if (rest.phone !== undefined) update.phone = rest.phone;
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await admin.from("profiles").update(update).eq("id", user_id);
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "profile_edit",
      target_type: "user",
      target_id: user_id,
      details: update,
    });
    return { ok: true };
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

// ============ Modo de manutenção ============
export const setMaintenanceMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      enabled: z.boolean(),
      message: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: existing } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    const prevMsg = (existing?.value as { message?: string } | null)?.message;
    const { error } = await admin.from("app_settings").upsert({
      key: "maintenance_mode",
      value: { enabled: data.enabled, message: data.message ?? prevMsg ?? "" },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: data.enabled ? "maintenance_on" : "maintenance_off",
      target_type: "app_settings",
      target_id: "maintenance_mode",
      details: { message: data.message ?? null },
    });
    return { ok: true };
  });

// ============ Link de acesso direto (magic link com slug curto) ============
export const adminGenerateAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(data.user_id);
    if (userErr || !userRes?.user?.email) throw new Error("Usuário sem e-mail cadastrado");
    const email = userRes.user.email;

    const siteUrl = process.env.PUBLIC_SITE_URL || "https://robo-promoter.lovable.app";
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/dashboard` },
    });
    if (linkErr || !linkRes?.properties) {
      throw new Error(linkErr?.message ?? "Falha ao gerar link de acesso");
    }
    // Importante: NÃO usamos o action_link do Supabase — ele usa o fluxo PKCE,
    // que exige o "code verifier" gravado no navegador de quem gerou o link.
    // Como quem abre é o cliente (outro navegador), o login falharia.
    // Usamos o hashed_token com verifyOtp na nossa própria página /entrar,
    // que loga direto sem senha e sem verificador.
    const hashedToken = linkRes.properties.hashed_token;
    const target = hashedToken
      ? `${siteUrl}/entrar?th=${encodeURIComponent(hashedToken)}`
      : linkRes.properties.action_link;


    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const slug = Array.from({ length: 8 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: slugErr } = await admin.from("access_link_slugs").insert({
      slug,
      target_url: target,
      target_user_id: data.user_id,
      created_by_email: (context.claims as { email?: string })?.email ?? null,
      expires_at: expiresAt,
    });
    if (slugErr) throw new Error(slugErr.message);

    await admin.from("admin_magic_link_events").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      target_user_id: data.user_id,
      target_email: email,
    });

    return { url: `${siteUrl}/e/${slug}`, email, expires_at: expiresAt };
  });

// ============ Auditoria de vínculos Meta ============
export interface MetaLinkAuditRow {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  changed_by_email: string | null;
  old_meta_campaign_id: string | null;
  new_meta_campaign_id: string | null;
  old_meta_ad_account_id: string | null;
  new_meta_ad_account_id: string | null;
  created_at: string;
}

export const adminListMetaLinkAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaLinkAuditRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("campaign_meta_link_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.campaign_id)));
    const { data: camps } = await admin
      .from("campaigns")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((camps ?? []).map((c) => [c.id, c.name]));
    return (rows ?? []).map((r) => ({
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_name: nameMap.get(r.campaign_id) ?? null,
      changed_by_email: r.changed_by_email ?? null,
      old_meta_campaign_id: r.old_meta_campaign_id ?? null,
      new_meta_campaign_id: r.new_meta_campaign_id ?? null,
      old_meta_ad_account_id: r.old_meta_ad_account_id ?? null,
      new_meta_ad_account_id: r.new_meta_ad_account_id ?? null,
      created_at: r.created_at,
    }));
  });

// ============ IA de métricas: listagem das análises ============
export interface AIReviewRow {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  verdict: "good" | "warn" | "bad" | "no_data";
  summary: string;
  recommendations: string[];
  created_at: string;
}

export const adminListAIReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AIReviewRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: rows, error } = await admin
      .from("campaign_ai_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.campaign_id)));
    const { data: camps } = await admin
      .from("campaigns")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((camps ?? []).map((c) => [c.id, c.name]));
    return (rows ?? []).map((r) => ({
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_name: nameMap.get(r.campaign_id) ?? null,
      verdict: r.verdict as AIReviewRow["verdict"],
      summary: r.summary,
      recommendations: Array.isArray(r.recommendations)
        ? (r.recommendations as Json[]).map((x) => String(x))
        : [],
      created_at: r.created_at,
    }));
  });

// ============ Criativos: URLs assinadas para o admin ver e baixar ============
// O bucket campaign-creatives é privado, então o admin precisa de URLs
// assinadas. `download` faz o navegador baixar o arquivo original (sem
// recompressão, resolução intacta) em um clique.
export const adminGetCampaignMediaUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { data: camp, error } = await admin
      .from("campaigns")
      .select("media, media_type, image")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const items = parseMedia((camp as { media?: unknown } | null)?.media);
    const mediaType = ((camp as { media_type?: string } | null)?.media_type ?? "image") as CampaignMediaType;

    const out: Array<CampaignMediaItem & { url: string; downloadUrl: string }> = [];
    for (const it of items) {
      const [view, dl] = await Promise.all([
        admin.storage.from("campaign-creatives").createSignedUrl(it.path, 60 * 60),
        admin.storage
          .from("campaign-creatives")
          .createSignedUrl(it.path, 60 * 60, { download: it.name || true }),
      ]);
      if (view.data?.signedUrl) {
        out.push({
          ...it,
          url: view.data.signedUrl,
          downloadUrl: dl.data?.signedUrl ?? view.data.signedUrl,
        });
      }
    }
    return {
      media_type: mediaType,
      items: out,
      legacy_image: out.length === 0 ? ((camp as { image?: string } | null)?.image ?? "") : "",
    };
  });


// ============ Entradas abertas (aprovacao automatica de acesso) ============
export const getAutoApproveAccess = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getSupabaseAdmin();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "auto_approve_access")
    .maybeSingle();
  return { enabled: Boolean((data?.value as { enabled?: boolean } | null)?.enabled) };
});

export const setAutoApproveAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("app_settings").upsert({
      key: "auto_approve_access",
      value: { enabled: data.enabled },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await admin.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: data.enabled ? "auto_approve_on" : "auto_approve_off",
      target_type: "app_settings",
      target_id: "auto_approve_access",
    });
    return { enabled: data.enabled };
  });

/**
 * Registra o pedido de acesso do proprio usuario logado. Se as "entradas abertas"
 * estiverem ligadas pelo admin, aprova na hora e libera o painel.
 */
export const submitAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ display_name: z.string().max(200).nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await getSupabaseAdmin();
    const userId = context.userId;
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;

    const { data: prof } = await admin
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();
    const current = (prof?.status ?? "pending") as string;
    if (current === "banned") {
      await admin.from("access_requests").upsert(
        { user_id: userId, email, display_name: data.display_name ?? null, status: "rejected" },
        { onConflict: "user_id" },
      );
      return { approved: false };
    }
    if (current === "approved") return { approved: true };

    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "auto_approve_access")
      .maybeSingle();
    const auto = Boolean((setting?.value as { enabled?: boolean } | null)?.enabled);

    await admin.from("access_requests").upsert(
      {
        user_id: userId,
        email,
        display_name: data.display_name ?? null,
        status: auto ? "approved" : "pending",
        reviewed_at: auto ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );

    if (!auto) return { approved: false };

    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        status: "approved",
        email,
        display_name: data.display_name ?? (email ? email.split("@")[0] : null),
      },
      { onConflict: "id" },
    );
    if (pErr) throw new Error(pErr.message);
    return { approved: true };
  });

// ============ Dashboard Executivo: métricas ocultas/resetadas ============
// Guarda no app_settings (key "exec_dashboard_hidden") a lista de chaves de
// métricas que o admin escondeu/resetou individualmente no painel.
export const getExecDashboardHidden = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hidden: string[] }> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "exec_dashboard_hidden")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const hidden = (data?.value as { hidden?: string[] } | null)?.hidden ?? [];
    return { hidden: Array.isArray(hidden) ? hidden : [] };
  });

export const setExecDashboardHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hidden: z.array(z.string()) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: "exec_dashboard_hidden",
        value: { hidden: data.hidden },
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { hidden: data.hidden };
  });

// ============ Turbinar Alcance (boosts): marcar como processado ============
export interface AdminCampaignBoostRow {
  id: string;
  campaign_id: string;
  views: number;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export const adminListCampaignBoosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AdminCampaignBoostRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("campaign_boosts")
      .select("*")
      .eq("campaign_id", data.campaign_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      campaign_id: r.campaign_id,
      views: r.views,
      amount: Number(r.amount),
      status: r.status,
      paid_at: r.paid_at ?? null,
      created_at: r.created_at,
    }));
  });

export const adminMarkBoostProcessed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ boost_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("campaign_boosts")
      .update({ status: "processed" } as never)
      .eq("id", data.boost_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Histórico de atividade do usuário ============
export interface AdminUserActivityRow {
  id: string;
  kind: string;
  label: string | null;
  session_id: string | null;
  duration_ms: number | null;
  created_at: string;
}

export const adminListUserActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), limit: z.number().min(1).max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AdminUserActivityRow[]> => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("user_activity_events")
      .select("id, kind, label, session_id, duration_ms, created_at")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminUserActivityRow[];
  });
