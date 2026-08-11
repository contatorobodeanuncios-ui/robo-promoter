// Regra de negócio única de precificação de campanha.
// O orçamento que vai para a Meta Ads é budget * days. Sobre esse valor
// incide a taxa de transferência, serviço e impostos, que é cobrada tanto
// no PIX dedicado quanto no débito do saldo do app.
// Usuários FREE pagam ainda uma taxa de plataforma adicional.
// IMPORTANTE: o percentual nunca é exibido ao usuário — só o valor em reais.
export const SERVICE_FEE_RATE = 0.15;
export const PLATFORM_FEE_RATE = 0.16;

export type UserPlan = "free" | "pro" | "trial_pro" | "credits";

// ===== Plano CRÉDITOS =====
// O cliente compra dias + potência de visualizações. Não existe taxa visível:
// o preço do pacote já embute tudo. Internamente metade do valor pago vira
// verba real de mídia (Meta) e a outra metade fica com a plataforma.
export const CPM_MIN = 15; // custo estimado por 1.000 visualizações (piso)
export const CPM_MAX = 20; // custo estimado por 1.000 visualizações (teto)
export const CREDITS_MEDIA_SHARE = 0.5; // fração do valor pago que vira verba de mídia
// Custos internos usados só no dashboard executivo (nunca exibidos ao cliente).
export const CREDITS_BANK_FIXED_COST = 1.99 + 0.99;
export const CREDITS_TAX_RATE = 0.12;

/** Faixa de visualizações estimadas para uma verba de mídia (CPM entre 15 e 20). */
export function viewsRangeForMedia(mediaBudget: number) {
  return {
    min: Math.round((mediaBudget / CPM_MAX) * 1000),
    max: Math.round((mediaBudget / CPM_MIN) * 1000),
  };
}

/** Verba de mídia necessária para entregar (pelo menos) X visualizações. */
export function mediaBudgetForViews(views: number) {
  return round2((views / 1000) * CPM_MAX);
}

/** Preço final do pacote de créditos a partir da verba de mídia. */
export function creditsPackagePrice(mediaBudget: number) {
  return round2(mediaBudget / CREDITS_MEDIA_SHARE);
}

/**
 * Estado de consumo dos créditos: 1 crédito = 24h de veiculação, consumido
 * gradualmente (nunca mais de 1 crédito em 24 horas).
 */
export function creditsState(c: {
  credits_total?: number | null;
  days?: number | null;
  started_running_at?: string | null;
  status?: string | null;
}) {
  const total = Number(c.credits_total ?? c.days ?? 0);
  if (!c.started_running_at || total <= 0) {
    return { total, used: 0, remaining: total, daysDone: 0 };
  }
  const elapsedDays = (Date.now() - new Date(c.started_running_at).getTime()) / 86_400_000;
  const used = Math.min(total, Math.max(0, elapsedDays));
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    daysDone: Math.min(total, Math.floor(used)),
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CampaignPricing {
  metaBudget: number;
  serviceFee: number;
  platformFee: number;
  /** taxa total exibida ao usuário (serviço + plataforma quando FREE) */
  feesTotal: number;
  feeLabel: string;
  total: number;
}

export const SERVICE_FEE_LABEL = "Taxa de Transferência, Serviço e Impostos";
export const SERVICE_PLATFORM_FEE_LABEL =
  "Taxa de Transferência, Serviço, Impostos e Plataforma";

export function campaignPricing(
  budget: number,
  days: number,
  plan: UserPlan = "pro",
): CampaignPricing {
  const metaBudget = round2(budget * days);
  // Plano CRÉDITOS: pacote fechado, sem nenhuma taxa exibida ao cliente.
  if (plan === "credits") {
    return {
      metaBudget,
      serviceFee: 0,
      platformFee: 0,
      feesTotal: 0,
      feeLabel: "",
      total: creditsPackagePrice(metaBudget),
    };
  }
  const serviceFee = round2(metaBudget * SERVICE_FEE_RATE);
  const platformFee = plan === "free" ? round2(metaBudget * PLATFORM_FEE_RATE) : 0;
  const feesTotal = round2(serviceFee + platformFee);
  return {
    metaBudget,
    serviceFee,
    platformFee,
    feesTotal,
    feeLabel: plan === "free" ? SERVICE_PLATFORM_FEE_LABEL : SERVICE_FEE_LABEL,
    total: round2(metaBudget + feesTotal),
  };
}

/** Nível efetivo: um Teste Pro vencido volta a valer como Free. */
export function effectivePlan(p: {
  plan?: string | null;
  trial_days?: number | null;
  trial_started_at?: string | null;
}): UserPlan {
  const plan = (p.plan ?? "credits") as UserPlan;
  if (plan === "credits") return "credits";
  if (plan !== "trial_pro") return plan === "pro" ? "pro" : "free";
  if (trialDaysLeft(p) <= 0) return "free";
  return "trial_pro";
}

/** Dias restantes (arredondados pra cima) do modo Teste Pro. */
export function trialDaysLeft(p: {
  trial_days?: number | null;
  trial_started_at?: string | null;
}): number {
  if (!p.trial_days || !p.trial_started_at) return 0;
  const end = new Date(p.trial_started_at).getTime() + p.trial_days * 86_400_000;
  const ms = end - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export const KIWIFY_PRO_CHECKOUT = "https://pay.kiwify.com.br/ECJMIKj";
