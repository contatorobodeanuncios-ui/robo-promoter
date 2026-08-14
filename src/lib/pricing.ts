// Regra de negócio única de precificação de campanha.
// O orçamento que vai para a Meta Ads é budget * days. Sobre esse valor
// incide a taxa de transferência, serviço e impostos, que é cobrada tanto
// no PIX dedicado quanto no débito do saldo do app.
// Usuários FREE pagam ainda uma taxa de plataforma adicional.
// IMPORTANTE: o percentual nunca é exibido ao usuário — só o valor em reais.
export const SERVICE_FEE_RATE = 0.15;
export const PLATFORM_FEE_RATE = 0.16;

export type UserPlan = "free" | "pro" | "trial_pro" | "credits" | "pro_max";

/** Planos que usam a lógica de créditos (pacote fechado, 1 crédito = 24h). */
export const isCreditsLike = (p: UserPlan) => p === "credits" || p === "pro_max";

// ===== Precificação por dias (pacote de veiculação) =====
// preco = 18 * dias + 3 · visualizações 500–633/dia · CTR 3%–4%
export const MIN_DAYS = 3;
export const RECOMMENDED_DAYS = 7;
export const VIEWS_PER_DAY_MIN = 500;
export const VIEWS_PER_DAY_MAX = 633;
export const CTR_MIN = 0.03;
export const CTR_MAX = 0.04;
/** Taxas de banco fixas descontadas do valor pago (uso interno). */
export const BANK_FIXED_COST = 1.99 + 0.99;
/** Imposto do Facebook sobre a parte da Meta (uso interno). */
export const FACEBOOK_TAX_RATE = 0.12;

export function packagePriceForDays(days: number) {
  return round2(18 * Math.max(MIN_DAYS, days) + 3);
}

export function packageViewsForDays(days: number) {
  const d = Math.max(MIN_DAYS, days);
  return { min: VIEWS_PER_DAY_MIN * d, max: VIEWS_PER_DAY_MAX * d };
}

export function packageClicksForDays(days: number) {
  const v = packageViewsForDays(days);
  return { min: Math.round(v.min * CTR_MIN), max: Math.round(v.max * CTR_MAX) };
}

/**
 * Repartição interna (NUNCA exibida ao cliente):
 * paga - taxas de banco → 50/50 plataforma / Meta → 12% de imposto do Facebook.
 */
export function internalBreakdown(pricePaid: number) {
  const afterBank = round2(Math.max(0, pricePaid - BANK_FIXED_COST));
  const platform = round2(afterBank / 2);
  const metaGross = round2(afterBank / 2);
  const facebookTax = round2(metaGross * FACEBOOK_TAX_RATE);
  const metaNet = round2(metaGross - facebookTax);
  return {
    pricePaid: round2(pricePaid),
    bankFees: BANK_FIXED_COST,
    platform,
    metaGross,
    facebookTax,
    metaNet,
  };
}

/** Orçamento real que vai para a campanha na Meta (uso interno/admin). */
export const campaignMediaBudget = (pricePaid: number) => internalBreakdown(pricePaid).metaNet;

/** Pacotes fechados de Turbinar Alcance (add-on Pro Max). */
export const BOOST_PACKAGES: { views: number; price: number }[] = [
  { views: 1200, price: 45 },
  { views: 2500, price: 87 },
  { views: 3600, price: 133 },
  { views: 4700, price: 175 },
  { views: 5700, price: 220 },
  { views: 6800, price: 270 },
  { views: 7800, price: 310 },
  { views: 8900, price: 350 },
  { views: 10000, price: 400 },
];


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
  // Planos CRÉDITOS e PRO MAX: pacote fechado por dias, sem taxa exibida.
  if (isCreditsLike(plan)) {
    const total = packagePriceForDays(days);
    return {
      metaBudget: campaignMediaBudget(total),
      serviceFee: 0,
      platformFee: 0,
      feesTotal: 0,
      feeLabel: "",
      total,
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
  if (plan === "pro_max") return "pro_max";
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

// ===== Escala de visualizações x dias (pacote de créditos) =====
// Referência: 3 dias = 1.800 visualizações = R$ 57,00 (18*dias+3).
export const VIEWS_PER_DAY_BASE = 600;

export const baseViewsForDays = (days: number) =>
  VIEWS_PER_DAY_BASE * Math.max(MIN_DAYS, days);

/** Preço proporcional às visualizações escolhidas para a quantidade de dias. */
export function packagePriceFor(days: number, views: number) {
  const d = Math.max(MIN_DAYS, days);
  const base = baseViewsForDays(d);
  const v = Math.max(1, views);
  return round2(packagePriceForDays(d) * (v / base));
}

/** Cliques estimados (3% a 4% das visualizações). */
export function clicksForViews(views: number) {
  return { min: Math.round(views * CTR_MIN), max: Math.round(views * CTR_MAX) };
}

/**
 * Valores exibidos ao admin: apenas o total pago pelo cliente e o valor real
 * que vai para o Meta Ads (pago - taxas de banco, /2, -12% de imposto).
 */
export function adminCampaignValues(pricePaid: number, days: number) {
  const metaNet = campaignMediaBudget(pricePaid);
  const d = Math.max(1, days);
  return { paid: round2(pricePaid), metaNet, daily: round2(metaNet / d) };
}
