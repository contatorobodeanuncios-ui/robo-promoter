import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

export type EvidenceStatusEvent = {
  event: string;
  at: string;
  ip?: string | null;
  user_agent?: string | null;
  actor?: string | null;
  note?: string | null;
};

export type LoginEventRow = {
  id: string;
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

export type PaymentEvidenceDetail = {
  payment: {
    id: string;
    amount: number;
    status: string;
    type: string | null;
    created_at: string;
    approved_at: string | null;
    asaas_payment_id: string | null;
  };
  client: { id: string; name: string | null; email: string | null; phone: string | null; cpf_cnpj: string | null };
  evidence: {
    account_email: string | null;
    ip: string | null;
    user_agent: string | null;
    session_id: string | null;
    city: string | null;
    country: string | null;
    terms_accepted: boolean;
    terms_accepted_at: string | null;
    terms_ip: string | null;
    terms_version: string | null;
    balance_before: number | null;
    balance_after: number | null;
    bonus: number | null;
    status_events: EvidenceStatusEvent[];
  } | null;
  nearby_logins: LoginEventRow[];
  auth_sessions: Array<{ ip: string | null; created_at: string | null; user_agent: string | null }>;
};

async function loadEvidence(paymentId: string): Promise<PaymentEvidenceDetail> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: pr, error } = await db
    .from("payment_requests")
    .select("id, user_id, amount, status, type, created_at, approved_at, asaas_payment_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !pr) throw new Error("Pagamento não encontrado");
  const [{ data: prof }, { data: ev }] = await Promise.all([
    db.from("profiles").select("display_name, email, phone, cpf_cnpj").eq("id", pr.user_id).maybeSingle(),
    db.from("payment_evidence" as never).select("*").eq("payment_request_id", paymentId).maybeSingle(),
  ]);
  const t = new Date(pr.created_at).getTime();
  const from = new Date(t - 3 * 86400_000).toISOString();
  const to = new Date(t + 3 * 86400_000).toISOString();
  const { data: logins } = await db
    .from("login_events" as never)
    .select("id, ip, user_agent, city, country, created_at")
    .eq("user_id", pr.user_id)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(10);
  let sessions: PaymentEvidenceDetail["auth_sessions"] = [];
  try {
    const { data: s } = await db.rpc("admin_auth_session_ips" as never, { _user_id: pr.user_id } as never);
    sessions = ((s ?? []) as Array<{ ip: string | null; created_at: string | null; user_agent: string | null }>).map((r) => ({
      ip: r.ip, created_at: r.created_at, user_agent: r.user_agent,
    }));
  } catch { /* sem dado */ }
  const e = ev as unknown as Record<string, unknown> | null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    payment: {
      id: pr.id,
      amount: Number(pr.amount),
      status: pr.status,
      type: pr.type ?? null,
      created_at: pr.created_at,
      approved_at: pr.approved_at,
      asaas_payment_id: pr.asaas_payment_id,
    },
    client: {
      id: pr.user_id,
      name: prof?.display_name ?? null,
      email: prof?.email ?? null,
      phone: prof?.phone ?? null,
      cpf_cnpj: prof?.cpf_cnpj ?? null,
    },
    evidence: e
      ? {
          account_email: (e.account_email as string) ?? null,
          ip: (e.ip as string) ?? null,
          user_agent: (e.user_agent as string) ?? null,
          session_id: (e.session_id as string) ?? null,
          city: (e.city as string) ?? null,
          country: (e.country as string) ?? null,
          terms_accepted: !!e.terms_accepted,
          terms_accepted_at: (e.terms_accepted_at as string) ?? null,
          terms_ip: (e.terms_ip as string) ?? null,
          terms_version: (e.terms_version as string) ?? null,
          balance_before: num(e.balance_before),
          balance_after: num(e.balance_after),
          bonus: num(e.bonus),
          status_events: (Array.isArray(e.status_events) ? e.status_events : []) as EvidenceStatusEvent[],
        }
      : null,
    nearby_logins: (logins ?? []) as unknown as LoginEventRow[],
    auth_sessions: sessions,
  };
}

export const adminGetPaymentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    return loadEvidence(data.payment_id);
  });

export const adminListLoginEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [{ data: logins }, { data: pays }] = await Promise.all([
      db.from("login_events" as never)
        .select("id, ip, user_agent, city, country, created_at")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("payment_requests")
        .select("id, amount, status, type, created_at")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    return {
      logins: (logins ?? []) as unknown as LoginEventRow[],
      payments: (pays ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), status: p.status, type: p.type ?? null, created_at: p.created_at })),
    };
  });

const NR = "Não registrado";

export const adminExportEvidencePDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims as { email?: string });
    const d = await loadEvidence(data.payment_id);
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const gray = rgb(0.35, 0.4, 0.48);
    const dark = rgb(0.05, 0.08, 0.14);
    let page = doc.addPage([595, 842]);
    let y = 800;
    // Helvetica padrão só aceita WinAnsi: remove caracteres fora disso.
    const safe = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
    const ensure = (h: number) => {
      if (y - h < 50) { page = doc.addPage([595, 842]); y = 800; }
    };
    const title = (t: string) => {
      ensure(30); y -= 8;
      page.drawText(safe(t), { x: 40, y, size: 12, font: bold, color: dark });
      y -= 18;
    };
    const line = (label: string, value: string | null | undefined) => {
      ensure(16);
      const v = value === null || value === undefined || value === "" ? NR : value;
      page.drawText(safe(label), { x: 40, y, size: 9, font, color: gray });
      const txt = safe(v);
      const max = 80;
      const chunks = txt.match(new RegExp(`.{1,${max}}`, "g")) ?? [txt];
      for (const c of chunks) {
        ensure(14);
        page.drawText(c, { x: 200, y, size: 9, font: bold, color: dark });
        y -= 13;
      }
      y -= 2;
    };
    const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);
    const brl = (n: number | null | undefined) => (n === null || n === undefined ? null : `R$ ${n.toFixed(2).replace(".", ",")}`);
    const ev = d.evidence;

    page.drawText("Relatório de Evidências de Pagamento", { x: 40, y, size: 16, font: bold, color: dark });
    y -= 16;
    page.drawText(safe(`Gerado em ${dt(new Date().toISOString())}`), { x: 40, y, size: 9, font, color: gray });
    y -= 10;

    title("Cliente");
    line("Nome:", d.client.name);
    line("E-mail:", d.client.email);
    line("Telefone:", d.client.phone);
    line("CPF/CNPJ:", d.client.cpf_cnpj);
    line("ID do cliente:", d.client.id);

    title("Pagamento");
    line("ID:", d.payment.id);
    line("Tipo:", d.payment.type === "campaign_boost" ? "Turbinar Alcance" : d.payment.type === "balance_topup" ? "Recarga de saldo" : d.payment.type === "campaign_budget" ? "Campanha" : null);
    line("Valor pago:", brl(d.payment.amount));
    line("Status:", d.payment.status);
    line("Criado em:", dt(d.payment.created_at));
    line("Aprovado em:", dt(d.payment.approved_at));
    line("Referência Asaas:", d.payment.asaas_payment_id);

    title("Aceite dos Termos de Uso");
    line("Aceitou:", ev ? (ev.terms_accepted ? "Sim" : "Não") : null);
    line("Data/hora:", dt(ev?.terms_accepted_at));
    line("IP do aceite:", ev?.terms_ip);
    line("Versão:", ev?.terms_version);

    title("Dados do clique em pagar");
    line("E-mail da conta:", ev?.account_email);
    line("IP:", ev?.ip);
    line("Aparelho:", ev?.user_agent);
    line("Cidade:", ev?.city);
    line("País:", ev?.country);
    line("ID da sessão:", ev?.session_id);

    title("Saldo");
    line("Saldo antes:", brl(ev?.balance_before));
    line("Saldo depois:", brl(ev?.balance_after));
    line("Bônus:", brl(ev?.bonus));

    title("Linha do tempo");
    if (!ev || ev.status_events.length === 0) line("Eventos:", null);
    for (const s of ev?.status_events ?? []) {
      line(dt(s.at) ?? "", `${s.event}${s.actor ? ` (${s.actor})` : ""} - IP: ${s.ip ?? NR}`);
    }

    title("Acessos próximos à data do pagamento");
    if (d.nearby_logins.length === 0) line("Acessos:", null);
    for (const l of d.nearby_logins) {
      line(dt(l.created_at) ?? "", `IP ${l.ip ?? NR} - ${l.city ?? NR}/${l.country ?? NR} - ${l.user_agent ?? NR}`);
    }

    title("IP da sessão de login (auth.sessions)");
    if (d.auth_sessions.length === 0) line("Sessões:", null);
    for (const s of d.auth_sessions.slice(0, 5)) line(dt(s.created_at) ?? "", `IP ${s.ip ?? NR}`);

    const bytes = await doc.save();
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { pdf: btoa(bin), filename: `evidencias-${d.payment.id.slice(0, 8)}.pdf` };
  });
