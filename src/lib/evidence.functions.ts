import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Registra início de sessão (IP/aparelho/local lidos no servidor). */
export const recordSessionStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().max(100).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getRequestMeta } = await import("@/lib/evidence.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = getRequestMeta();
    await supabaseAdmin.from("login_events" as never).insert({
      user_id: context.userId,
      ip: meta.ip,
      user_agent: meta.user_agent,
      city: meta.city,
      country: meta.country,
    } as never);
    await supabaseAdmin.from("user_activity_events").insert({
      user_id: context.userId,
      kind: "session_start",
      session_id: data.session_id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      city: meta.city,
      country: meta.country,
    } as never);

    // Aceite de termos feito no cadastro: registra uma vez, sem inventar IP.
    try {
      const { count } = await supabaseAdmin
        .from("terms_acceptances" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("context", "signup");
      if (!count) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        const md = (u?.user?.user_metadata ?? {}) as { terms_accepted_at?: string; terms_version?: string };
        if (md.terms_accepted_at) {
          await supabaseAdmin.from("terms_acceptances" as never).insert({
            user_id: context.userId,
            version: md.terms_version ?? "desconhecida",
            context: "signup",
            created_at: md.terms_accepted_at,
          } as never);
        }
      }
    } catch { /* silencioso */ }
    return { ok: true };
  });
