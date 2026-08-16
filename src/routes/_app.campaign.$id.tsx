import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { creditsState, airTimeLabel } from "@/lib/pricing";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, MousePointerClick, Percent, DollarSign, Sparkles,
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, Info, CreditCard, Coins,
  Download, Rocket, Zap, Clock,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BoostDialog } from "@/components/app/BoostDialog";
import { CampaignImage } from "@/components/app/CampaignImage";
import { downloadReportImage } from "@/lib/report-image";
import type { Campaign } from "@/lib/store";

export const Route = createFileRoute("/_app/campaign/$id")({
  head: () => ({
    meta: [
      { title: `Campanha — Robô de Lucro` },
      { name: "description", content: "Métricas reais e insights do robô para sua campanha." },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-10">
      <p>Campanha não encontrada.</p>
      <Link to="/dashboard" className="text-primary text-sm">← voltar</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-10 text-sm text-destructive">{error.message}</div>
  ),
  component: CampaignDetail,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** extra_views ainda não existe no schema tipado — leitura defensiva. */
function getExtraViews(c: unknown): number {
  const v = (c as { extra_views?: number | string | null } | null)?.extra_views;
  return v ? Number(v) || 0 : 0;
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const c = useAppStore((s) => s.campaigns.find((x) => x.id === id));
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const plan = useAppStore((s) => s.plan);
  const isProMax = plan === "pro_max";
  const [boostOpen, setBoostOpen] = useState(false);
  const nav = useNavigate();

  if (!c) {
    return (
      <div className="p-10">
        <p>Campanha não encontrada.</p>
        <Link to="/dashboard" className="text-primary text-sm">← voltar</Link>
      </div>
    );
  }

  // Corrigido: antes exigia isRunning (status === running/rodando) além de ter
  // cliques/impressões — então uma campanha pausada com dados reais (ex: você
  // pausou no Facebook depois de já ter gasto e gerado resultado) escondia
  // tudo atrás de "não disponível". O que importa é se o dado chegou de
  // verdade do Facebook, não o status atual da campanha.
  const hasRealMetrics = c.clicks > 0 || c.impressions > 0 || c.spent > 0;
  const na = "não disponível";
  // Plano Créditos: 1 crédito = 24h de veiculação, consumido gradualmente.
  const credits = creditsState(c);
  const extraViews = getExtraViews(c);

  const togglePause = () => {
    const next = c.status === "paused" ? "running" : "paused";
    updateCampaign(c.id, { status: next });
    toast.success(next === "paused" ? "Campanha pausada" : "Campanha retomada");
  };

  // Views/CPM card: X = impressões entregues, Y = total de visualizações
  // compradas (pacote + turbos).
  const purchasedViewsBase = (() => {
    // Estimativa do pacote comprado com base no orçamento/dias quando não há
    // um campo explícito de "views compradas" — mantém coerência com o que
    // foi vendido ao cliente.
    return Math.round(c.budget * c.days * 40); // ~ referência de CPM médio
  })();
  const totalViews = purchasedViewsBase + extraViews;

  const metrics: Array<{ label: string; value: string; icon: typeof Eye; dim?: boolean }> = [
    { label: "Impressões", value: hasRealMetrics ? c.impressions.toLocaleString("pt-BR") : na, icon: Eye, dim: !hasRealMetrics },
    { label: "Cliques", value: hasRealMetrics ? c.clicks.toLocaleString("pt-BR") : na, icon: MousePointerClick, dim: !hasRealMetrics },
    { label: "CTR", value: hasRealMetrics ? `${c.ctr.toFixed(2)}%` : na, icon: Percent, dim: !hasRealMetrics },
    { label: "CPC", value: hasRealMetrics && c.cpc ? fmtBRL(c.cpc) : na, icon: DollarSign, dim: !hasRealMetrics || !c.cpc },
    {
      label: "Créditos",
      value: c.credits_total
        ? `${credits.used.toFixed(2)}/${credits.total} créditos totais`
        : na,
      icon: Coins,
      dim: !c.credits_total,
    },
    {
      label: "Tempo no ar",
      value: airTimeLabel(c) ?? na,
      icon: Clock,
      dim: !airTimeLabel(c),
    },
    {
      label: "Views / total comprado",
      value: hasRealMetrics ? `${c.impressions.toLocaleString("pt-BR")}/${totalViews.toLocaleString("pt-BR")}` : na,
      icon: Eye,
      dim: !hasRealMetrics,
    },
    { label: "Frequência", value: hasRealMetrics && c.frequency ? c.frequency.toFixed(2) : na, icon: Percent, dim: !hasRealMetrics || !c.frequency },
    { label: "Custo por resultado", value: hasRealMetrics && c.cost_per_result ? fmtBRL(c.cost_per_result) : na, icon: DollarSign, dim: !hasRealMetrics || !c.cost_per_result },
    { label: "Alcance", value: hasRealMetrics && c.reach ? c.reach.toLocaleString("pt-BR") : na, icon: Eye, dim: !hasRealMetrics || !c.reach },
    { label: "Resultados", value: hasRealMetrics && c.results ? c.results.toLocaleString("pt-BR") : na, icon: MousePointerClick, dim: !hasRealMetrics || !c.results },
    { label: "Receita", value: hasRealMetrics && c.revenue ? fmtBRL(c.revenue) : na, icon: DollarSign, dim: !hasRealMetrics || !c.revenue },
    { label: "ROI", value: hasRealMetrics && c.revenue && c.spent ? `${(((c.revenue - c.spent) / c.spent) * 100).toFixed(1)}%` : na, icon: Percent, dim: !hasRealMetrics || !c.revenue },
  ];


  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:p-10 max-w-5xl mx-auto space-y-8 overflow-x-hidden">
      <header className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-start sm:justify-between gap-4 text-center sm:text-left">
        <div className="min-w-0 w-full sm:w-auto">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 break-words">{c.name}</h1>
          <p className="text-sm text-muted-foreground">{c.headline}</p>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
          {isProMax && (
            <>
              <Button variant="glass" onClick={() => handleDownloadReport(c, hasRealMetrics)}>
                <Download className="h-4 w-4" /> Baixar Relatório
              </Button>
              <Button
                variant="glass"
                className="border-[#e6b422]/50 text-[#e6b422]"
                onClick={() => setBoostOpen(true)}
              >
                <Rocket className="h-4 w-4" /> Turbinar Alcance
              </Button>
            </>
          )}
          <Button variant="glass" onClick={togglePause}>{c.status === "paused" ? "Retomar" : "Pausar"}</Button>
        </div>
      </header>

      {extraViews > 0 && (
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#2b1c00] bg-gradient-to-r from-[#f7d774] via-[#e6b422] to-[#c9971b] shadow-[0_0_18px_-6px_#e6b422]">
            <Zap className="h-3.5 w-3.5" /> Turbinou {extraViews.toLocaleString("pt-BR")} visualizações
          </span>
        </div>
      )}

      {(() => {
        const totalCost = Math.round(c.budget * c.days);
        const unpaid = Number(c.total_paid ?? 0) < totalCost;
        if (!unpaid) return null;
        return (
          <section className="rounded-2xl p-5 border-2 border-warning/50 bg-warning/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Pagamento não concluído</p>
                <p className="text-xs text-muted-foreground">
                  Esta campanha ainda não foi paga ({fmtBRL(totalCost)}). Conclua o pagamento para o anúncio subir.
                </p>
              </div>
            </div>
            <Button
              variant="neon"
              onClick={() =>
                nav({
                  to: "/payment",
                  search: { campaignId: c.id, budget: c.budget, days: c.days, name: c.name },
                })
              }
            >
              <CreditCard className="h-4 w-4" /> Concluir pagamento
            </Button>
          </section>
        );
      })()}

      {/* Bloco de valor pago — sempre visível, separado do saldo */}
      <section className="glass-strong rounded-2xl p-5 grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor pago pelo anúncio</p>
          <p className="text-2xl font-bold text-primary tabular-nums">{fmtBRL(c.total_paid)}</p>
          <p className="text-[11px] text-muted-foreground">não conta como saldo do app</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Créditos de veiculação</p>
          <p className="text-lg font-bold tabular-nums">Créditos referente a {c.days} dias de anúncios</p>
          <p className="text-[11px] text-muted-foreground">total pago {fmtBRL(c.total_paid)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
          <p className="text-2xl font-bold tabular-nums capitalize">
            {c.status === "running" || c.status === "rodando" ? "Ativa" : c.status === "analyzing" ? "Em análise" : c.status === "paused" ? "Pausada" : c.status === "aguardando_vinculo_meta" ? "Aguardando pagamento" : "Encerrada"}
          </p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[400px,1fr] gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white text-xs font-bold">M</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Minha Empresa</p>
                <p className="text-[11px] text-muted-foreground">Patrocinado · 🌎</p>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="px-4 pb-3 text-sm">{c.copy}</p>
            <CampaignImage image={c.image} media={c.media} alt="" className="w-full aspect-square object-cover" fallbackClassName="w-full aspect-square grid place-items-center bg-white/5 text-muted-foreground" />
            <div className="p-3 flex items-center justify-between bg-white/[0.02] border-t border-white/5">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase">
                  {(() => {
                    try { return new URL(c.link.startsWith("http") ? c.link : "https://" + c.link).hostname; }
                    catch { return c.link || "—"; }
                  })()}
                </p>
                <p className="text-sm font-medium truncate">{c.headline}</p>
              </div>
              <Button variant="glass" size="sm">Saiba mais</Button>
            </div>
            <div className="flex items-center justify-around p-2 border-t border-white/5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ThumbsUp className="h-4 w-4" /> Curtir</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> Comentar</span>
              <span className="flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Compartilhar</span>
            </div>
          </div>
        </div>

        {/* Métricas reais — só aparecem se houver dados do Facebook */}
        <div className="space-y-6 min-w-0">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <m.icon className="h-4 w-4 text-primary" />
                </div>
                <p className={`text-xl font-bold mt-2 tabular-nums ${m.dim ? "text-muted-foreground italic" : ""}`}>{m.value}</p>
              </div>
            ))}
          </div>


          {!hasRealMetrics && (
            <div className="glass rounded-2xl p-6 flex items-start gap-3 border border-primary/20">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Aguardando dados reais do Facebook & Pixel</p>
                <p className="text-xs text-muted-foreground">
                  O Robô só exibe métricas validadas pelo Facebook Marketing API e pelo Pixel.
                  Assim que a campanha tiver algum dado real reportado (mesmo que já tenha sido
                  pausada depois), ele aparece aqui automaticamente.
                </p>
              </div>
            </div>
          )}

          {hasRealMetrics && (
            <div className="glass rounded-2xl p-5 flex items-start gap-3 border border-primary/30">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Insights só são gerados a partir de dados reais reportados pelo Facebook e Pixel.
              </p>
            </div>
          )}
        </div>
      </div>

      {boostOpen && (
        <BoostDialog campaignId={c.id} campaignName={c.name} onClose={() => setBoostOpen(false)} />
      )}
    </div>
  );
}

/** Gera e baixa o relatório de desempenho em imagem (PNG). */
function handleDownloadReport(c: Campaign, hasRealMetrics: boolean) {
  const na = "não disponível";
  const extraViews = getExtraViews(c);
  const purchasedViewsBase = Math.round(c.budget * c.days * 40);
  const totalViews = purchasedViewsBase + extraViews;
  const statusLabel =
    c.status === "running" || c.status === "rodando" ? "Ativa"
      : c.status === "analyzing" ? "Em análise"
      : c.status === "paused" ? "Pausada"
      : c.status === "aguardando_vinculo_meta" ? "Aguardando pagamento"
      : "Encerrada";

  downloadReportImage({
    campaignName: c.name,
    headline: c.headline,
    status: statusLabel,
    metrics: [
      { label: "Impressões", value: hasRealMetrics ? c.impressions.toLocaleString("pt-BR") : na },
      { label: "Cliques", value: hasRealMetrics ? c.clicks.toLocaleString("pt-BR") : na },
      { label: "CTR", value: hasRealMetrics ? `${c.ctr.toFixed(2)}%` : na },
      { label: "CPC", value: hasRealMetrics && c.cpc ? fmtBRL(c.cpc) : na },
      { label: "Views entregues/comprado", value: hasRealMetrics ? `${c.impressions.toLocaleString("pt-BR")}/${totalViews.toLocaleString("pt-BR")}` : na },
      { label: "Alcance", value: hasRealMetrics && c.reach ? c.reach.toLocaleString("pt-BR") : na },
      { label: "Resultados", value: hasRealMetrics && c.results ? c.results.toLocaleString("pt-BR") : na },
      { label: "Valor pago", value: fmtBRL(c.total_paid) },
    ],
  }).then(() => toast.success("Relatório baixado")).catch(() => toast.error("Não foi possível gerar o relatório."));
}
