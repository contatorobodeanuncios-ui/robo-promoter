import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOOST_PACKAGES, campaignMediaBudget, effectivePlan } from "@/lib/pricing";

const ADMIN_EMAIL = "prototipospremium@gmail.com";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function assertAdmin(claims: { email?: string } | undefined) {
  if ((claims?.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Forbidden: admin only");
  }
}

export interface ProMaxLinks {
  seller_school_url: string;
  whatsapp_url: string;
}

const DEFAULT_LINKS: ProMaxLinks = { seller_school_url: "", whatsapp_url: "" };

export const getProMaxLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ProMaxLinks> => {
    const admin = await getAdmin();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "promax_links")
      .maybeSingle();
    const v = (data?.value ?? {}) as Partial<ProMaxLinks>;
    return {
      seller_school_url: v.seller_school_url ?? DEFAULT_LINKS.seller_school_url,
      whatsapp_url: v.whatsapp_url ?? DEFAULT_LINKS.whatsapp_url,
    };
  });

export const adminSetProMaxLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        seller_school_url: z.string().max(500).default(""),
        whatsapp_url: z.string().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const admin = await getAdmin();
    const { error } = await admin
      .from("app_settings")
      .upsert(
        { key: "promax_links", value: data as never, updated_at: new Date().toISOString() } as never,
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Copy Inteligente (IA) ============
export const refineCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().min(5).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: prof } = await admin
      .from("profiles")
      .select("plan, trial_days, trial_started_at")
      .eq("id", context.userId)
      .maybeSingle();
    const plan = effectivePlan((prof ?? {}) as Record<string, never>);
    const isAdmin = (context.claims as { email?: string })?.email?.toLowerCase() === ADMIN_EMAIL;
    if (plan !== "pro_max" && !isAdmin) {
      throw new Error("Copy Inteligente é exclusivo do plano Pro Max.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("IA indisponível no momento.");

    const prompt = `Você é um copywriter brasileiro especialista em anúncios de Facebook/Instagram para pequenos negócios locais.
Reescreva o texto abaixo em uma versão altamente persuasiva, sem erros de português, com gatilho de urgência sutil e uma CTA clara no final.
Responda APENAS com JSON no formato {"headline": string, "copy": string, "cta": string, "tips": string[]}.
Texto original:
"""${data.text}"""`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Muitas solicitações. Tente novamente em instantes.");
    if (!res.ok) throw new Error("Não foi possível refinar a copy agora.");
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as {
      headline?: string;
      copy?: string;
      cta?: string;
      tips?: string[];
    };
    return {
      headline: String(parsed.headline ?? "").slice(0, 300),
      copy: String(parsed.copy ?? "").slice(0, 2200),
      cta: String(parsed.cta ?? "").slice(0, 200),
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 5).map((t) => String(t).slice(0, 200)) : [],
    };
  });

// ============ Turbinar Alcance ============
export interface BoostRow {
  id: string;
  campaign_id: string;
  views: number;
  amount: number;
  media_budget: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export const createBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      packageIndex: z.number().int().min(0).max(BOOST_PACKAGES.length - 1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: camp } = await admin
      .from("campaigns")
      .select("id, user_id")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!camp || camp.user_id !== context.userId) throw new Error("Campanha não encontrada.");

    const pkg = BOOST_PACKAGES[data.packageIndex];
    const { data: row, error } = await admin
      .from("campaign_boosts")
      .insert({
        campaign_id: data.campaignId,
        user_id: context.userId,
        views: pkg.views,
        amount: pkg.price,
        media_budget: campaignMediaBudget(pkg.price),
        status: "pending",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, views: pkg.views, amount: pkg.price };
  });

export const listCampaignBoosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BoostRow[]> => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("campaign_boosts")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false });
    return ((rows ?? []) as unknown as BoostRow[]).map((r) => ({
      ...r,
      amount: Number(r.amount),
      media_budget: Number(r.media_budget),
    }));
  });

export const adminListBoosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoostRow[]> => {
    assertAdmin(context.claims as { email?: string });
    const admin = await getAdmin();
    const { data } = await admin
      .from("campaign_boosts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    return ((data ?? []) as unknown as BoostRow[]).map((r) => ({
      ...r,
      amount: Number(r.amount),
      media_budget: Number(r.media_budget),
    }));
  });
