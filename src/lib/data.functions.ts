import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  campaignPricing,
  round2,
  effectivePlan,
  trialDaysLeft,
  isCreditsLike,
  packagePriceFor,
  includedViewsForDays,
  campaignMediaBudget,
  ORDER_BUMP_VIEWS,
  ORDER_BUMP_PRICE,
} from "@/lib/pricing";


async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type CampaignStatus =
  | "running"
  | "analyzing"
  | "paused"
  | "aguardando_vinculo_meta"
  | "rodando"
  | "encerrada_saldo_consumido";

export type FundingType = "wallet" | "pix_dedicated";

// Criativo: além da imagem única, agora dá pra mandar vídeo ou carrossel
// (várias imagens, na ordem em que o cliente enviou).
export type CampaignMediaType = "image" | "video" | "carousel";

export interface CampaignMediaItem {
  path: string;   // caminho no Storage (bucket campaign-creatives)
  kind: "image" | "video";
  name: string;
  mime: string;
  size: number;
}


export interface CampaignRow {
  id: string;
  name: string;
  image: string;
  status: CampaignStatus;
  spent: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  copy: string;
  headline: string;
  link: string;
  budget: number;
  days: number;
  city: string;
  neighborhood: string;
  radius: number;
  total_paid: number;
  funding_type: FundingType;
  pix_total_budget: number;
  pix_remaining_budget: number;
  reach: number;
  results: number;
  revenue: number;
  frequency: number;
  cpm: number;
  cost_per_result: number;
  invoice_url: string | null;
  paused_at: string | null;
  started_running_at: string | null;
  ended_at: string | null;
  created_at: string;
  // Item novo: data/hora exata escolhida pelo cliente para o anúncio começar e terminar.
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  media_type: CampaignMediaType;
  media: CampaignMediaItem[];
  /** Plano Créditos: total de créditos do pacote (1 crédito = 24h de veiculação). */
  credits_total: number | null;
}


interface DbCampaign {
  id: string;
  name: string;
  image: string;
  status: CampaignStatus;
  spent: string | number;
  clicks: number;
  impressions: number;
  ctr: string | number;
  cpc: string | number;
  copy: string;
  headline: string;
  link: string;
  budget: number;
  days: number;
  city: string;
  neighborhood: string;
  radius: number;
  total_paid?: string | number | null;
  funding_type?: FundingType | null;
  pix_total_budget?: string | number | null;
  pix_remaining_budget?: string | number | null;
  reach?: number | null;
  results?: number | null;
  revenue?: string | number | null;
  frequency?: string | number | null;
  cpm?: string | number | null;
  cost_per_result?: string | number | null;
  invoice_url?: string | null;
  paused_at?: string | null;
  started_running_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  media_type?: string | null;
  media?: unknown;
  credits_total?: number | null;
}

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

export const parseMedia = (v: unknown): CampaignMediaItem[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      path: String(x.path ?? ""),
      kind: x.kind === "video" ? ("video" as const) : ("image" as const),
      name: String(x.name ?? ""),
      mime: String(x.mime ?? ""),
      size: Number(x.size ?? 0),
    }))
    .filter((x) => x.path.length > 0);
};


const mapCampaign = (r: DbCampaign): CampaignRow => ({
  id: r.id,
  name: r.name,
  image: r.image,
  status: r.status,
  spent: num(r.spent),
  clicks: r.clicks,
  impressions: r.impressions,
  ctr: num(r.ctr),
  cpc: num(r.cpc),
  copy: r.copy,
  headline: r.headline,
  link: r.link,
  budget: r.budget,
  days: r.days,
  city: r.city,
  neighborhood: r.neighborhood,
  radius: r.radius,
  total_paid: num(r.total_paid),
  funding_type: (r.funding_type ?? "wallet") as FundingType,
  pix_total_budget: num(r.pix_total_budget),
  pix_remaining_budget: num(r.pix_remaining_budget),
  reach: r.reach ?? 0,
  results: r.results ?? 0,
  revenue: num(r.revenue),
  frequency: num(r.frequency),
  cpm: num(r.cpm),
  cost_per_result: num(r.cost_per_result),
  invoice_url: r.invoice_url ?? null,
  paused_at: r.paused_at ?? null,
  started_running_at: r.started_running_at ?? null,
  ended_at: r.ended_at ?? null,
  created_at: r.created_at ?? "",
  scheduled_start_at: r.scheduled_start_at ?? null,
  scheduled_end_at: r.scheduled_end_at ?? null,
  media_type: (r.media_type ?? "image") as CampaignMediaType,
  media: parseMedia(r.media),
  credits_total: r.credits_total ?? null,
});



export const getAppData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: campaigns }] = await Promise.all([
      supabase
        .from("profiles")
        .select("balance, display_name, plan, trial_days, trial_started_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    ]);
    const p = (profile ?? {}) as {
      plan?: string | null;
      trial_days?: number | null;
      trial_started_at?: string | null;
    };
    return {
      balance: profile?.balance ? Number(profile.balance) : 0,
      displayName: profile?.display_name ?? null,
      plan: effectivePlan(p),
      trialDaysLeft: trialDaysLeft(p),
      campaigns: (campaigns ?? []).map((c) => mapCampaign(c as unknown as DbCampaign)),
    };
  });


// Limites alinhados aos tetos REAIS do próprio Facebook (não um teto artificial
// do app): imagem até 30MB (spec oficial de anúncio Meta), texto principal até
// 2200 caracteres, título até 400 (folga sobre os ~255 que a Meta usa).
// Antes: image limitado a base64 de ~6MB embutido direto no banco (ineficiente
// e o motivo do limite baixo); agora a imagem é uma URL do Storage, então o
// limite de caracteres aqui é só o tamanho de uma URL, não do arquivo.
const campaignInput = z.object({
  name: z.string().min(1).max(200),
  image: z.string().max(2000).default(""), // URL do Storage, não mais base64
  status: z.enum([
    "running",
    "analyzing",
    "paused",
    "aguardando_vinculo_meta",
    "rodando",
    "encerrada_saldo_consumido",
  ]).default("analyzing"),
  spent: z.number().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  ctr: z.number().min(0).default(0),
  cpc: z.number().min(0).default(0),
  copy: z.string().max(2200).default(""),
  headline: z.string().max(400).default(""),
  link: z.string().max(2000).default(""),
  budget: z.number().int().min(1).max(10000),
  days: z.number().int().min(1).max(365),
  city: z.string().max(200).default(""),
  neighborhood: z.string().max(200).default(""),
  radius: z.number().int().min(1).max(200),
  funding_type: z.enum(["wallet", "pix_dedicated"]).default("wallet"),
  pix_total_budget: z.number().min(0).optional(),
  scheduled_start_at: z.string().datetime().nullable().optional(),
  scheduled_end_at: z.string().datetime().nullable().optional(),
  // Criativo: imagem única, vídeo ou carrossel (várias imagens, em ordem).
  media_type: z.enum(["image", "video", "carousel"]).default("image"),
  media: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        kind: z.enum(["image", "video"]),
        name: z.string().max(200).default(""),
        mime: z.string().max(120).default(""),
        size: z.number().min(0).default(0),
      }),
    )
    .max(30)
    .default([]),
  // Plano Créditos: quantidade de créditos do pacote (1 crédito = 1 dia).
  credits_total: z.number().int().min(0).max(365).nullable().optional(),
  // Plano Créditos: total de visualizações escolhido pelo cliente no wizard.
  views: z.number().int().min(0).max(5_000_000).optional(),
  // Order bump do passo 6 (+3.000 visualizações por R$ 29,80).
  order_bump: z.boolean().default(false),
});


export interface CreateCampaignResult {
  campaign: CampaignRow;
  paid: boolean;
  needsPayment: boolean;
  totalCost: number;
  metaBudget: number;
  serviceFee: number;
  remainingDue: number;
}


// Verifica o modo de manutenção antes de criar campanha — item novo.
async function assertNotInMaintenance() {
  const admin = await getAdmin();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  const v = data?.value as { enabled?: boolean; message?: string } | null;
  if (v?.enabled) {
    throw new Error(
      v.message ||
        "Para sua segurança, não é possível colocar um anúncio no ar neste momento. Será liberado em breve. Sugerimos que volte em algumas horas. Pedimos que aguarde, por gentileza!",
    );
  }
}

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => campaignInput.parse(data))
  .handler(async ({ data, context }): Promise<CreateCampaignResult> => {
    await assertNotInMaintenance();
    const { supabase, userId } = context;
    const admin = await getAdmin();
    // Nível do usuário define se há taxa de plataforma (FREE) ou não (PRO/TESTE PRO).
    const { data: planProf } = await admin
      .from("profiles")
      .select("plan, trial_days, trial_started_at")
      .eq("id", userId)
      .maybeSingle();
    const plan = effectivePlan(
      (planProf ?? {}) as { plan?: string | null; trial_days?: number | null; trial_started_at?: string | null },
    );
    // Orçamento que vai para a Meta + taxas (mesma regra no PIX e no saldo).
    let {
      metaBudget,
      serviceFee,
      platformFee,
      feesTotal,
      total: totalCost,
    } = campaignPricing(data.budget, data.days, plan);

    // Plano Créditos/Pro Max: o preço real é o pacote por dias + visualizações
    // extras + (opcional) o order bump escolhido no passo 6.
    const includedViews = includedViewsForDays(data.days);
    const chosenViews = Math.max(includedViews, data.views ?? includedViews);
    const bumpViews = data.order_bump ? ORDER_BUMP_VIEWS : 0;
    const bumpPrice = data.order_bump ? ORDER_BUMP_PRICE : 0;
    // extra_views = tudo que foi comprado acima do incluído pelos dias
    // (mesma coluna usada pelo Turbinar Alcance, para o total bater sempre).
    let extraViews = 0;
    let extraPaid = 0;
    if (isCreditsLike(plan)) {
      const packageTotal = packagePriceFor(data.days, chosenViews);
      totalCost = round2(packageTotal + bumpPrice);
      metaBudget = campaignMediaBudget(totalCost);
      serviceFee = 0;
      platformFee = 0;
      feesTotal = 0;
      extraViews = Math.max(0, chosenViews - includedViews) + bumpViews;
      extraPaid = round2(
        packageTotal - packagePriceFor(data.days, includedViews) + bumpPrice,
      );
    }

    const isPix = data.funding_type === "pix_dedicated";
    const safe = {
      name: data.name,
      image: data.image,
      copy: data.copy,
      headline: data.headline,
      link: data.link,
      budget: data.budget,
      days: data.days,
      city: data.city,
      neighborhood: data.neighborhood,
      radius: data.radius,
      spent: 0,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      cpc: 0,
      status: isPix ? ("aguardando_vinculo_meta" as const) : ("analyzing" as const),
      funding_type: data.funding_type,
      // pix_total_budget é só a verba de veiculação (sem taxa).
      pix_total_budget: isPix ? metaBudget : null,
      pix_remaining_budget: isPix ? 0 : null,
      service_fee: serviceFee,
      platform_fee: platformFee,

      scheduled_start_at: data.scheduled_start_at ?? null,
      scheduled_end_at: data.scheduled_end_at ?? null,
      media_type: data.media_type,
      media: data.media as unknown as Json,
      // No plano Créditos o pacote vira créditos (1 crédito = 1 dia).
      credits_total: isCreditsLike(plan) ? data.days : null,
      extra_views: extraViews,
      extra_paid: extraPaid,

    };
    const { data: row, error } = await supabase
      .from("campaigns")
      .insert({ ...safe, user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (isPix) {
      return {
        campaign: mapCampaign(row as unknown as DbCampaign),
        paid: false,
        needsPayment: true,
        totalCost,
        metaBudget,
        serviceFee: feesTotal,
        remainingDue: totalCost,
      };
    }

    const { data: prof } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();
    const balance = Number(prof?.balance ?? 0);

    if (balance >= totalCost) {
      const next = round2(balance - totalCost);
      await admin.from("profiles").update({ balance: next }).eq("id", userId);
      // total_paid guarda o total debitado (verba + taxas); service_fee/platform_fee isolam as taxas.
      await admin
        .from("campaigns")
        .update({ total_paid: totalCost, service_fee: serviceFee, platform_fee: platformFee } as never)
        .eq("id", row.id);
      // Toda campanha precisa aparecer em "Solicitações de pagamento", mesmo
      // quando foi paga com saldo do app — aqui o registro já nasce como pago.
      await admin.from("payment_requests").insert({
        user_id: userId,
        amount: totalCost,
        status: "paid",
        type: "campaign_budget",
        campaign_id: row.id,
        note: `Pago com saldo do app (veiculação R$ ${metaBudget.toFixed(2)} + taxas R$ ${feesTotal.toFixed(2)})`,
        approved_at: new Date().toISOString(),
      } as never);
      const fresh = { ...(row as unknown as DbCampaign), total_paid: totalCost };

      return {
        campaign: mapCampaign(fresh),
        paid: true,
        needsPayment: false,
        totalCost,
        metaBudget,
        serviceFee: feesTotal,
        remainingDue: 0,
      };
    }


    return {
      campaign: mapCampaign(row as unknown as DbCampaign),
      paid: false,
      needsPayment: true,
      totalCost,
      metaBudget,
      serviceFee: feesTotal,
      remainingDue: round2(totalCost - balance),
    };

  });

const updateInput = z.object({
  id: z.string().uuid(),
  patch: campaignInput.partial(),
});

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const {
      spent: _s, clicks: _c, impressions: _i, ctr: _ct, cpc: _cp,
      funding_type: _ft, pix_total_budget: _ptb,
      ...safe
    } = data.patch;
    void _s; void _c; void _i; void _ct; void _cp; void _ft; void _ptb;
    const { error } = await supabase.from("campaigns").update(safe).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const wipeAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const admin = await getAdmin();
    const { data: existing } = await admin
      .from("campaigns")
      .select("id,name,status,headline,image,budget,days,spent")
      .eq("user_id", userId);
    const list = existing ?? [];
    const active = list.filter(
      (c) => c.status === "running" || c.status === "analyzing" || c.status === "rodando",
    ).length;
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const email = (claims as { email?: string } | undefined)?.email ?? null;

    await admin.from("wipe_events").insert({
      user_id: userId,
      user_email: email,
      user_name: profile?.display_name ?? null,
      campaigns_snapshot: JSON.parse(JSON.stringify(list)),
      active_count: active,
      total_count: list.length,
    });

    const { error: delErr } = await admin
      .from("campaigns")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

// ============ Modo de manutenção (item novo) ============
export interface MaintenanceMode {
  enabled: boolean;
  message: string;
}

const DEFAULT_MAINTENANCE_MESSAGE =
  "Para sua segurança, não é possível colocar um anúncio no ar neste momento. " +
  "Será liberado em breve. Sugerimos que volte em algumas horas. " +
  "Pedimos que aguarde, por gentileza!";

export const getMaintenanceMode = createServerFn({ method: "GET" }).handler(
  async (): Promise<MaintenanceMode> => {
    const admin = await getAdmin();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    const v = data?.value as { enabled?: boolean; message?: string } | null;
    return {
      enabled: !!v?.enabled,
      message: v?.message || DEFAULT_MAINTENANCE_MESSAGE,
    };
  },
);

// ============ Pausa programada do robô ============
// Dois modos: "free" (horário livre, padrão — campanhas pagas entram na fila
// imediatamente) e "scheduled" (pausa por N horas; ao chegar o horário de
// retomada volta sozinho para "free").
export interface RobotSchedule {
  mode: "free" | "scheduled";
  paused_at: string | null;
  hours: number;
  resume_at: string | null;
}

export const getRobotSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<RobotSchedule> => {
    const admin = await getAdmin();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "robot_schedule")
      .maybeSingle();
    const v = (data?.value ?? null) as
      | { mode?: string; paused_at?: string; hours?: number }
      | null;
    const hours = Number(v?.hours ?? 0);
    if (v?.mode !== "scheduled" || !v?.paused_at || !(hours > 0)) {
      return { mode: "free", paused_at: null, hours: 0, resume_at: null };
    }
    const resume = new Date(new Date(v.paused_at).getTime() + hours * 3_600_000);
    // Passou do horário de retomada → volta automaticamente para horário livre.
    if (resume.getTime() <= Date.now()) {
      return { mode: "free", paused_at: null, hours: 0, resume_at: null };
    }
    return {
      mode: "scheduled",
      paused_at: v.paused_at,
      hours,
      resume_at: resume.toISOString(),
    };
  },
);

// ============ Upload de criativo (imagem do anúncio) ============
// Antes: a imagem inteira ia como base64 direto numa coluna de texto do
// banco (ineficiente, e por isso o limite baixo de ~6MB). Agora só gera o
// caminho — o navegador sobe o arquivo direto pro Storage (bucket público
// campaign-creatives, criado via migração), e a URL pública é o que é salvo
// na campanha. Isso remove o teto artificial do app; o único limite real que
// resta é o que o próprio Facebook aceita (30MB).
export const getCreativeUploadPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const path = `creatives/${context.userId}/${Date.now()}-${safe}`;
    return { path };
  });

// Gera URLs assinadas para o próprio usuário ver seus criativos (o bucket
// campaign-creatives é privado). Só libera caminhos dentro da pasta do usuário.
export const getMyCreativeSignedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paths: z.array(z.string().min(1).max(500)).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const prefix = `creatives/${context.userId}/`;
    const allowed = data.paths.filter((p) => p.startsWith(prefix));
    if (allowed.length === 0) return { urls: {} as Record<string, string> };
    const admin = await getAdmin();
    const { data: signed, error } = await admin.storage
      .from("campaign-creatives")
      .createSignedUrls(allowed, 60 * 60);
    if (error) throw new Error(error.message);
    const urls: Record<string, string> = {};
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    }
    return { urls };
  });
