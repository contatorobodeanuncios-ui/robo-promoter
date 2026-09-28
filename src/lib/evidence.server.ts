import { getRequest } from "@tanstack/react-start/server";

// Metadados da requisição lidos SOMENTE no servidor. Nunca confia em dado do
// navegador. Cidade/país só vêm dos cabeçalhos da hospedagem; sem dado = null.
export type RequestMeta = {
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
};

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s || s.toUpperCase() === "XX" || s.toUpperCase() === "T1") return null;
  return s.slice(0, 500);
}

export function metaFromRequest(req: Request | undefined | null): RequestMeta {
  const h = req?.headers;
  if (!h) return { ip: null, user_agent: null, city: null, country: null };
  const ip = clean(h.get("cf-connecting-ip")) ?? clean(h.get("x-forwarded-for")?.split(",")[0]);
  let city = clean(h.get("cf-ipcity"));
  if (city) {
    try { city = decodeURIComponent(city); } catch { /* mantém */ }
  }
  return {
    ip,
    user_agent: clean(h.get("user-agent")),
    city,
    country: clean(h.get("cf-ipcountry")),
  };
}

export function getRequestMeta(): RequestMeta {
  try {
    return metaFromRequest(getRequest());
  } catch {
    return { ip: null, user_agent: null, city: null, country: null };
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type StatusEvent = {
  event: string;
  at: string;
  ip?: string | null;
  user_agent?: string | null;
  actor?: string | null;
  note?: string | null;
};

/** Cria (se ainda não existir) a evidência do pagamento com os dados do clique. */
export async function ensurePaymentEvidence(p: {
  paymentRequestId: string;
  userId: string;
  email: string | null;
  sessionId: string | null;
  meta: RequestMeta;
  terms: { accepted: boolean; at: string | null; ip: string | null; version: string | null };
  event: string;
}) {
  try {
    const db = await admin();
    const { data: existing } = await db
      .from("payment_evidence" as never)
      .select("id, status_events, terms_accepted")
      .eq("payment_request_id", p.paymentRequestId)
      .maybeSingle();
    const ev: StatusEvent = {
      event: p.event,
      at: new Date().toISOString(),
      ip: p.meta.ip,
      user_agent: p.meta.user_agent,
      actor: "cliente",
    };
    if (!existing) {
      await db.from("payment_evidence" as never).insert({
        payment_request_id: p.paymentRequestId,
        user_id: p.userId,
        account_email: p.email,
        ip: p.meta.ip,
        user_agent: p.meta.user_agent,
        session_id: p.sessionId,
        city: p.meta.city,
        country: p.meta.country,
        terms_accepted: p.terms.accepted,
        terms_accepted_at: p.terms.at,
        terms_ip: p.terms.ip,
        terms_version: p.terms.version,
        status_events: [ev],
      } as never);
    } else {
      const row = existing as unknown as { id: string; status_events: StatusEvent[] | null; terms_accepted: boolean };
      const patch: Record<string, unknown> = { status_events: [...(row.status_events ?? []), ev] };
      if (!row.terms_accepted && p.terms.accepted) {
        patch.terms_accepted = true;
        patch.terms_accepted_at = p.terms.at;
        patch.terms_ip = p.terms.ip;
        patch.terms_version = p.terms.version;
      }
      await db.from("payment_evidence" as never).update(patch as never).eq("id", row.id);
    }
  } catch (e) {
    console.error("[evidence] ensure failed", e);
  }
}

/** Acrescenta um evento de status (e opcionalmente saldo antes/depois). */
export async function appendPaymentEvent(
  paymentRequestId: string,
  ev: Omit<StatusEvent, "at">,
  extra?: { balance_before?: number | null; balance_after?: number | null; bonus?: number | null },
) {
  try {
    const db = await admin();
    const { data: existing } = await db
      .from("payment_evidence" as never)
      .select("id, status_events")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();
    const full: StatusEvent = { ...ev, at: new Date().toISOString() };
    const patch: Record<string, unknown> = {};
    if (extra?.balance_before !== undefined) patch.balance_before = extra.balance_before;
    if (extra?.balance_after !== undefined) patch.balance_after = extra.balance_after;
    if (extra?.bonus !== undefined) patch.bonus = extra.bonus;
    if (existing) {
      const row = existing as unknown as { id: string; status_events: StatusEvent[] | null };
      patch.status_events = [...(row.status_events ?? []), full];
      await db.from("payment_evidence" as never).update(patch as never).eq("id", row.id);
    } else {
      // Pagamento antigo sem evidência: cria linha só com o que é real.
      const { data: pr } = await db
        .from("payment_requests")
        .select("user_id")
        .eq("id", paymentRequestId)
        .maybeSingle();
      if (!pr) return;
      await db.from("payment_evidence" as never).insert({
        payment_request_id: paymentRequestId,
        user_id: (pr as { user_id: string }).user_id,
        status_events: [full],
        ...patch,
      } as never);
    }
  } catch (e) {
    console.error("[evidence] append failed", e);
  }
}
