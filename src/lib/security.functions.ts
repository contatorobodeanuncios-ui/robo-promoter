import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit, ipFromRequest, RateLimitError } from "@/lib/rate-limit";

const ADMIN_EMAIL = "prototipospremium@gmail.com";

/**
 * Camada de proteção que roda ANTES do login/cadastro/recuperação de senha.
 * Limite: 10 tentativas a cada 5 minutos por IP. Ao exceder, devolve
 * `{ ok: false }` com mensagem genérica e registra o evento para o admin.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        action: z.enum(["login", "signup", "reset"]),
        email: z.string().max(200).optional(),
        failed: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = ipFromRequest(getRequest());
    const { logSecurityEvent } = await import("@/lib/security.server");

    if (data.failed) {
      // Tentativa malsucedida: registra para o painel de segurança do admin.
      await logSecurityEvent(
        "security_login_failed",
        { ip, action: data.action, email: data.email ?? null },
        data.email ?? null,
      );
      return { ok: true, message: null as string | null };
    }

    try {
      enforceRateLimit(`auth:${data.action}:${ip}`, 10, 5 * 60 * 1000);
    } catch (err) {
      if (err instanceof RateLimitError) {
        await logSecurityEvent(
          "security_login_rate_limited",
          { ip, action: data.action, email: data.email ?? null },
          data.email ?? null,
        );
        return { ok: false, message: "Muitas tentativas, tente novamente em alguns minutos." };
      }
      throw err;
    }
    return { ok: true, message: null as string | null };
  });

export interface SecurityEventRow {
  id: string;
  action: string;
  actor: string;
  details: string;
  created_at: string;
}

export const adminListSecurityEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SecurityEventRow[]> => {
    const email = ((context.claims as { email?: string } | undefined)?.email ?? "").toLowerCase();
    if (email !== ADMIN_EMAIL) {
      const { logSecurityEvent } = await import("@/lib/security.server");
      await logSecurityEvent("security_admin_forbidden", { route: "security_events" }, email || null);
      throw new Error("Forbidden: admin only");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, admin_email, action, details, created_at")
      .like("action", "security_%")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.admin_email,
      details: JSON.stringify(r.details ?? {}),
      created_at: r.created_at,
    }));
  });
