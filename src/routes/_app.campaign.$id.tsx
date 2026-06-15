import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, MousePointerClick, Percent, DollarSign, Sparkles,
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

function CampaignDetail() {
  const { id } = Route.useParams();
  const c = useAppStore((s) => s.campaigns.find((x) => x.id === id));
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const nav = useNavigate();
  void nav;

  if (!c) {
    return (
      <div className="p-10">
        <p>Campanha não encontrada.</p>
        <Link to="/dashboard" className="text-primary text-sm">← voltar</Link>
      </div>
    );
  }

  const isRunning = c.status === "running";
  const hasRealMetrics = isRunning && (c.clicks > 0 || c.impressions > 0);

  const togglePause = () => {
    const next = c.status === "paused" ? "running" : "paused";
    updateCampaign(c.id, { status: next });
    toast.success(next === "paused" ? "Campanha pausada" : "Campanha retomada");
  };

  const metrics = [
    { label: "Impressões reais", value: hasRealMetrics ? c.impressions.toLocaleString("pt-BR") : "—", icon: Eye },
    { label: "Cliques reais", value: hasRealMetrics ? c.clicks.toLocaleString("pt-BR") : "—", icon: MousePointerClick },
    { label: "CTR real", value: hasRealMetrics ? `${c.ctr.toFixed(2)}%` : "—", icon: Percent },
    { label: "Gasto (Facebook)", value: hasRealMetrics ? fmtBRL(c.spent) : "—", icon: DollarSign },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">{c.name}</h1>
          <p className="text-sm text-muted-foreground">{c.headline}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" onClick={togglePause}>{c.status === "paused" ? "Retomar" : "Pausar"}</Button>
        </div>
      </header>

      {/* Bloco de valor pago — sempre visível, separado do saldo */}
      <section className="glass-strong rounded-2xl p-5 grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor pago pelo anúncio</p>
          <p className="text-2xl font-bold text-primary tabular-nums">{fmtBRL(c.total_paid)}</p>
          <p className="text-[11px] text-muted-foreground">não conta como saldo do app</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Orçamento programado</p>
          <p className="text-2xl font-bold tabular-nums">{fmtBRL(c.budget * c.days)}</p>
          <p className="text-[11px] text-muted-foreground">{c.days} dias × {fmtBRL(c.budget)}/dia</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
          <p className="text-2xl font-bold tabular-nums capitalize">
            {c.status === "running" ? "Ativa" : c.status === "analyzing" ? "Em análise" : "Pausada"}
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
            {c.image && <img src={c.image} alt="" className="w-full aspect-square object-cover" />}
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
                <p className="text-xl font-bold mt-2 tabular-nums">{m.value}</p>
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
                  Enquanto a campanha está {c.status === "analyzing" ? "em análise" : "pausada"} ou sem dados reais reportados,
                  nenhuma estimativa ou número simulado é exibido aqui.
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
    </div>
  );
}
