import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CampaignMode = "manual" | "automatic";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getCampaignMode = createServerFn({ method: "GET" }).handler(async () => {
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
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const setCampaignMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["manual", "automatic"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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
  status: "running" | "analyzing" | "paused";
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
    await assertAdmin(context.userId);
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
    z.object({ id: z.string().uuid(), status: z.enum(["running", "analyzing", "paused"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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
