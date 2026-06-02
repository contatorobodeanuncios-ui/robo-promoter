export type CampaignStatus = "running" | "analyzing" | "paused";

export interface Campaign {
  id: string;
  name: string;
  image: string;
  status: CampaignStatus;
  spent: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  copy: string;
  headline: string;
  link: string;
  budget: number;       // R$ / dia
  days: number;         // duração total
  city: string;
  neighborhood: string;
  radius: number;       // km
}

// Faixa estimada de público alcançado.
// Baseline definido pelo cliente: R$7 por 7 dias = 3.225 a 5.250 pessoas.
// Aumenta linearmente conforme valor (a partir de R$1) e dias (proporcional a 7).
export const reachRange = (budget: number, days: number) => {
  const factor = Math.max(0, budget - 1) * (Math.max(0, days) / 7);
  return {
    min: Math.round(537.5 * factor),
    max: Math.round(875 * factor),
  };
};

export const fmtRange = (r: { min: number; max: number }) =>
  `${r.min.toLocaleString("pt-BR")} – ${r.max.toLocaleString("pt-BR")}`;

export const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "Promoção Hambúrguer Artesanal",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
    status: "running",
    spent: 348.5,
    clicks: 1247,
    impressions: 28430,
    ctr: 4.39,
    cpc: 0.28,
    copy: "Hambúrguer artesanal com pão brioche, cheddar derretido e bacon crocante. Peça agora pelo WhatsApp!",
    headline: "🔥 Burger Artesanal -30% Hoje",
    link: "https://wa.me/5511999999999",
    budget: 25, days: 14, city: "São Paulo, SP", neighborhood: "Vila Madalena", radius: 8,
  },
  {
    id: "c2",
    name: "Pacote Estética Facial",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80",
    status: "running",
    spent: 612.0,
    clicks: 894,
    impressions: 21100,
    ctr: 4.24,
    cpc: 0.68,
    copy: "Limpeza de pele profunda + máscara LED. Resultado visível na primeira sessão.",
    headline: "✨ Pele renovada em 60 minutos",
    link: "https://wa.me/5511999999998",
    budget: 40, days: 21, city: "Rio de Janeiro, RJ", neighborhood: "Ipanema", radius: 5,
  },
  {
    id: "c3",
    name: "Curso de Inglês Online",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80",
    status: "analyzing",
    spent: 0,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    cpc: 0,
    copy: "Aprenda inglês em 6 meses com aulas ao vivo e professores nativos.",
    headline: "Fale inglês fluente em 6 meses",
    link: "https://meusite.com/ingles",
    budget: 15, days: 7, city: "Belo Horizonte, MG", neighborhood: "Savassi", radius: 20,
  },
  {
    id: "c4",
    name: "Academia - Plano Anual",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80",
    status: "paused",
    spent: 1240.7,
    clicks: 2380,
    impressions: 54200,
    ctr: 4.39,
    cpc: 0.52,
    copy: "Plano anual com 40% off. Musculação, funcional e aulas coletivas inclusos.",
    headline: "💪 Plano Anual -40% só hoje",
    link: "https://academia.com",
    budget: 60, days: 30, city: "Curitiba, PR", neighborhood: "Batel", radius: 12,
  },
];

export const dailyClicks = [
  { day: "Seg", clicks: 142, impressions: 3200 },
  { day: "Ter", clicks: 178, impressions: 4100 },
  { day: "Qua", clicks: 165, impressions: 3800 },
  { day: "Qui", clicks: 210, impressions: 4900 },
  { day: "Sex", clicks: 245, impressions: 5400 },
  { day: "Sáb", clicks: 198, impressions: 4300 },
  { day: "Dom", clicks: 109, impressions: 2730 },
];

export const ageDistribution = [
  { name: "18-24", value: 22 },
  { name: "25-34", value: 38 },
  { name: "35-44", value: 24 },
  { name: "45-54", value: 11 },
  { name: "55+", value: 5 },
];

export const summary = {
  totalSpent: campaigns.reduce((a, c) => a + c.spent, 0),
  totalClicks: campaigns.reduce((a, c) => a + c.clicks, 0),
  avgCpc: 0.42,
  robotStatus: "online" as const,
};
