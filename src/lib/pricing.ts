// Regra de negócio única de precificação de campanha.
// O orçamento que vai para a Meta Ads é budget * days. Sobre esse valor
// incide a taxa de transferência, serviço e impostos, que é cobrada tanto
// no PIX dedicado quanto no débito do saldo do app.
// IMPORTANTE: o percentual nunca é exibido ao usuário — só o valor em reais.
export const SERVICE_FEE_RATE = 0.15;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CampaignPricing {
  metaBudget: number;
  serviceFee: number;
  total: number;
}

export function campaignPricing(budget: number, days: number): CampaignPricing {
  const metaBudget = round2(budget * days);
  const serviceFee = round2(metaBudget * SERVICE_FEE_RATE);
  return { metaBudget, serviceFee, total: round2(metaBudget + serviceFee) };
}

export const SERVICE_FEE_LABEL = "Taxa de Transferência, Serviço e Impostos";
