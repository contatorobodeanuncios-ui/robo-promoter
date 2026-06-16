import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type CampaignStatus = "running" | "analyzing" | "paused";

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
}

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

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
});

export const getAppData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: campaigns }] = await Promise.all([
      supabase.from("profiles").select("balance, display_name").eq("id", userId).maybeSingle(),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    ]);
    return {
      balance: profile?.balance ? Number(profile.balance) : 0,
      displayName: profile?.display_name ?? null,
      campaigns: (campaigns ?? []).map((c) => mapCampaign(c as unknown as DbCampaign)),
    };
  });

const campaignInput = z.object({
  name: z.string().min(1).max(200),
  image: z.string().max(2000).default(""),
  status: z.enum(["running", "analyzing", "paused"]).default("analyzing"),
  spent: z.number().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  impressions: z.number().int().min(0).default(0),
  ctr: z.number().min(0).default(0),
  cpc: z.number().min(0).default(0),
  copy: z.string().max(2000).default(""),
  headline: z.string().max(300).default(""),
  link: z.string().max(2000).default(""),
  budget: z.number().int().min(1).max(10000),
  days: z.number().int().min(1).max(365),
  city: z.string().max(200).default(""),
  neighborhood: z.string().max(200).default(""),
  radius: z.number().int().min(1).max(200),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => campaignInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Métricas reais começam zeradas — só serão preenchidas pela integração Facebook/Pixel.
    const safe = {
      ...data,
      spent: 0,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      cpc: 0,
      status: "analyzing" as const,
    };
    const { data: row, error } = await supabase
      .from("campaigns")
      .insert({ ...safe, user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapCampaign(row as unknown as DbCampaign);
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
    // Bloqueia mutação de métricas pelo cliente — só FB/Pixel via webhook (server) pode atualizar.
    const { spent: _s, clicks: _c, impressions: _i, ctr: _ct, cpc: _cp, ...safe } = data.patch;
    void _s; void _c; void _i; void _ct; void _cp;
    const { error } = await supabase.from("campaigns").update(safe).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const wipeAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const admin = await getAdmin();
    // IMPORTANTE: nunca apaga o saldo já pago no app — o saldo é dinheiro real
    // do cliente e só sai por gasto em campanha. Apenas as campanhas e suas
    // métricas são removidas.
    const { error: delErr } = await admin.from("campaigns").delete().eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
