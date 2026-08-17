// Registro de atividade suspeita (somente leitura para o admin).
// Grava em public.admin_audit_log com action prefixada por "security_".
// Nunca lança — logar segurança jamais pode quebrar um fluxo do app.

export type SecurityEventAction =
  | "security_login_failed"
  | "security_login_rate_limited"
  | "security_admin_forbidden"
  | "security_rate_limited";

export async function logSecurityEvent(
  action: SecurityEventAction,
  details: Record<string, unknown>,
  actor?: string | null,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_email: (actor ?? "anônimo").slice(0, 200),
      action,
      target_type: "security",
      target_id: null,
      details: details as never,
    } as never);
  } catch (err) {
    console.error("[security] falha ao registrar evento", err);
  }
}
