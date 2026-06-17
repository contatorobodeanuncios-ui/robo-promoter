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

export interface CreateCampaignResult {
  campaign: CampaignRow;
  paid: boolean;
  needsPayment: boolean;
  totalCost: number;
  remainingDue: number;
}

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => campaignInput.parse(data))
  .handler(async ({ data, context }): Promise<CreateCampaignResult> => {
    const { supabase, userId } = context;
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

    const totalCost = Math.round(data.budget * data.days);
    const admin = await getAdmin();
    const { data: prof } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();
    const balance = Number(prof?.balance ?? 0);

    if (balance >= totalCost) {
      const next = balance - totalCost;
      await admin.from("profiles").update({ balance: next }).eq("id", userId);
      await admin.from("campaigns").update({ total_paid: totalCost }).eq("id", row.id);
      const fresh = { ...(row as unknown as DbCampaign), total_paid: totalCost };
      return {
        campaign: mapCampaign(fresh),
        paid: true,
        needsPayment: false,
        totalCost,
        remainingDue: 0,
      };
    }

    return {
      campaign: mapCampaign(row as unknown as DbCampaign),
      paid: false,
      needsPayment: true,
      totalCost,
      remainingDue: totalCost - balance,
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
    const { spent: _s, clicks: _c, impressions: _i, ctr: _ct, cpc: _cp, ...safe } = data.patch;
    void _s; void _c; void _i; void _ct; void _cp;
    const { error } = await supabase.from("campaigns").update(safe).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const wipeAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const admin = await getAdmin();
    // Snapshot antes de apagar (para registro na zona de perigo /admindev)
    const { data: existing } = await admin
      .from("campaigns")
      .select("id,name,status,headline,image,budget,days,spent")
      .eq("user_id", userId);
    const list = existing ?? [];
    const active = list.filter(
      (c) => c.status === "running" || c.status === "analyzing",
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

    // NUNCA apaga o saldo já pago (preservado). Apaga apenas campanhas.
    const { error: delErr } = await admin
      .from("campaigns")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
