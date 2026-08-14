import { supabase } from "@/integrations/supabase/client";

/**
 * Rastreamento leve de atividade do usuário (sessão + cliques). Qualquer
 * falha é silenciosamente ignorada — nunca deve quebrar a experiência.
 */

let sessionId: string | null = null;
let sessionStartedAt = 0;

function genId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function insertEvent(kind: string, extra?: { label?: string; duration_ms?: number }) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("user_activity_events").insert({
      user_id: userId,
      kind,
      session_id: sessionId,
      label: extra?.label ?? null,
      duration_ms: extra?.duration_ms ?? null,
    });
  } catch {
    /* silencioso */
  }
}

/** Deve ser chamado uma vez, ao montar o shell do app. */
export function startSession() {
  if (sessionId) return;
  sessionId = genId();
  sessionStartedAt = Date.now();
  void insertEvent("session_start");
}

/** Deve ser chamado no unload/beforeunload da página. */
export function endSession() {
  if (!sessionId) return;
  const duration_ms = Date.now() - sessionStartedAt;
  void insertEvent("session_end", { duration_ms });
}

/** Loga um clique de interesse (ex: navegação, CTA). */
export function trackClick(label: string) {
  void insertEvent("click", { label });
}
