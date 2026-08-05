// Regra de negócio única de precificação de campanha.
// O orçamento que vai para a Meta Ads é budget * days. Sobre esse valor
// incide a taxa de transferência, serviço e impostos, que é cobrada tanto
// no PIX dedicado quanto no débito do saldo do app.
// Usuários FREE pagam ainda uma taxa de plataforma adicional.
// IMPORTANTE: o percentual nunca é exibido ao usuário — só o valor em reais.
export const SERVICE_FEE_RATE = 0.15;
export const PLATFORM_FEE_RATE = 0.16;

export type UserPlan = "free" | "pro" | "trial_pro";

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
  const plan = (p.plan ?? "free") as UserPlan;
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
