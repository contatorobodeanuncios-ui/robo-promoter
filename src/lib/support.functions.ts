import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "prototipospremium@gmail.com";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isAdminEmail(claims: { email?: string } | undefined) {
  return (claims?.email ?? "").toLowerCase() === ADMIN_EMAIL;
}

export interface SupportAttachment {
  path: string;
  mime: string;
  size: number;
  name: string;
  kind: "image" | "audio" | "file";
}

export interface SupportMessageRow {
  id: string;
  conversation_id: string;
  sender: "client" | "user" | "admin";
  content: string;
  created_at: string;
  attachments: SupportAttachment[];
}


export interface SupportConversationRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
  last_message_at: string | null;
  unread_by_admin: boolean;
  unread_by_client: boolean;
  updated_at: string;
  last_message?: string | null;
}

// ============ Cliente ============

export const getOrCreateMyConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: existing } = await sb
      .from("support_conversations")
      .select("*")
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { id: existing.id, unread_by_client: existing.unread_by_client };
    const { data, error } = await sb
      .from("support_conversations")
      .insert({ user_id: context.userId, status: "open" })
      .select("id, unread_by_client")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id, unread_by_client: data.unread_by_client };
  });

export const listMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SupportMessageRow[]> => {
    const sb = await admin();
    // valida ownership
    const { data: conv } = await sb
      .from("support_conversations")
      .select("user_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv || conv.user_id !== context.userId) throw new Error("Forbidden");
    // marca lido pelo cliente
    await sb
      .from("support_conversations")
      .update({ unread_by_client: false })
      .eq("id", data.conversation_id);
    const { data: msgs, error } = await sb
      .from("support_messages")
      .select("*")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []) as SupportMessageRow[];
  });

export const sendMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversation_id: z.string().uuid(),
      content: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: conv } = await sb
      .from("support_conversations")
      .select("user_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv || conv.user_id !== context.userId) throw new Error("Forbidden");
    const now = new Date().toISOString();
    const { error } = await sb.from("support_messages").insert({
      conversation_id: data.conversation_id,
      sender: "client",
      content: data.content,
    });
    if (error) throw new Error(error.message);
    await sb
      .from("support_conversations")
      .update({ last_message_at: now, unread_by_admin: true, updated_at: now })
      .eq("id", data.conversation_id);
    return { ok: true };
  });

// ============ Admin ============

export const adminListConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportConversationRow[]> => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    const { data: convs, error } = await sb
      .from("support_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((convs ?? []).map((c) => c.user_id)));
    const { data: profs } = await sb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p]));

    // pega última mensagem por conversa
    const convIds = (convs ?? []).map((c) => c.id);
    const { data: lastMsgs } = await sb
      .from("support_messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", convIds.length ? convIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    const lastByConv = new Map<string, string>();
    for (const m of lastMsgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m.content);
    }

    return (convs ?? []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      user_name: nameMap.get(c.user_id)?.display_name ?? null,
      user_email: nameMap.get(c.user_id)?.email ?? null,
      status: c.status,
      last_message_at: c.last_message_at,
      unread_by_admin: c.unread_by_admin,
      unread_by_client: c.unread_by_client,
      updated_at: c.updated_at,
      last_message: lastByConv.get(c.id) ?? null,
    }));
  });

export const adminListMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SupportMessageRow[]> => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    await sb
      .from("support_conversations")
      .update({ unread_by_admin: false })
      .eq("id", data.conversation_id);
    const { data: msgs, error } = await sb
      .from("support_messages")
      .select("*")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []) as SupportMessageRow[];
  });

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversation_id: z.string().uuid(),
      content: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    const now = new Date().toISOString();
    const { error } = await sb.from("support_messages").insert({
      conversation_id: data.conversation_id,
      sender: "admin",
      content: data.content,
    });
    if (error) throw new Error(error.message);
    await sb
      .from("support_conversations")
      .update({ last_message_at: now, unread_by_client: true, updated_at: now })
      .eq("id", data.conversation_id);
    // audit
    await sb.from("admin_audit_log").insert({
      admin_email: (context.claims as { email?: string })?.email ?? "",
      action: "support_reply",
      target_type: "conversation",
      target_id: data.conversation_id,
      details: { length: data.content.length },
    });
    return { ok: true };
  });

export const adminCloseConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    const { error } = await sb
      .from("support_conversations")
      .update({ status: "closed" })
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Audit Log ============
export interface AuditLogRow {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditLogRow[]> => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    const { data, error } = await sb
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      admin_email: r.admin_email,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      details: r.details ? JSON.stringify(r.details) : null,
      created_at: r.created_at,
    }));
  });

// ============ Dashboard executivo ============
export interface ExecStats {
  active_users: number;
  total_users: number;
  campaigns_running: number;
  total_spent: number;
  revenue: number;
  conversion_rate: number;
  avg_ticket: number;
  open_support: number;
  period_from: string;
  period_to: string;
}

export const getExecDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        period: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ExecStats> => {
    if (!isAdminEmail(context.claims as { email?: string })) throw new Error("Forbidden");
    const sb = await admin();
    const now = new Date();
    const days = data.period === "7d" ? 7 : data.period === "90d" ? 90 : 30;
    const to = data.period === "custom" && data.to ? new Date(data.to) : now;
    const from =
      data.period === "custom" && data.from
        ? new Date(data.from)
        : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [{ count: totalUsers }, { count: activeUsers }, { count: running }, campaignsRes, paymentsRes, supportRes] =
      await Promise.all([
        sb.from("profiles").select("*", { count: "exact", head: true }),
        sb.from("profiles").select("*", { count: "exact", head: true }).eq("status", "approved"),
        sb.from("campaigns").select("*", { count: "exact", head: true }).in("status", ["running", "rodando"]),
        sb.from("campaigns").select("spent, revenue").gte("created_at", fromIso).lte("created_at", toIso),
        sb.from("payment_requests").select("amount, status").gte("created_at", fromIso).lte("created_at", toIso),
        sb.from("support_conversations").select("*", { count: "exact", head: true }).eq("status", "aberto"),
      ]);

    const spent = (campaignsRes.data ?? []).reduce((s, c) => s + Number(c.spent ?? 0), 0);
    const approved = (paymentsRes.data ?? []).filter((p) => p.status === "approved" || p.status === "paid");
    const revenue = approved.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const total = (paymentsRes.data ?? []).length;
    const convRate = total > 0 ? approved.length / total : 0;
    const avgTicket = approved.length > 0 ? revenue / approved.length : 0;

    return {
      active_users: activeUsers ?? 0,
      total_users: totalUsers ?? 0,
      campaigns_running: running ?? 0,
      total_spent: spent,
      revenue,
      conversion_rate: convRate,
      avg_ticket: avgTicket,
      open_support: supportRes.count ?? 0,
      period_from: fromIso,
      period_to: toIso,
    };
  });
