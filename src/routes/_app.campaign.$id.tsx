import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { dailyClicks, ageDistribution } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ArrowLeft, Eye, MousePointerClick, Percent, DollarSign, Sparkles,
  ThumbsUp, MessageCircle, Share2, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/campaign/$id")({
  head: () => ({
    meta: [
      { title: `Campanha — Robô de Lucro` },
      { name: "description", content: "Métricas detalhadas e insights do robô para sua campanha." },
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
const COLORS = ["oklch(0.65 0.21 265)", "oklch(0.62 0.24 300)", "oklch(0.72 0.18 155)", "oklch(0.78 0.17 75)", "oklch(0.7 0.2 200)"];

function CampaignDetail() {
  const { id } = Route.useParams();
  const c = useAppStore((s) => s.campaigns.find((x) => x.id === id));
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const nav = useNavigate();
  const [optimizing, setOptimizing] = useState(false);

  if (!c) {
    return (
      <div className="p-10">
        <p>Campanha não encontrada.</p>
        <Link to="/dashboard" className="text-primary text-sm">← voltar</Link>
      </div>
    );
  }

  const togglePause = () => {
    const next = c.status === "paused" ? "running" : "paused";
    updateCampaign(c.id, { status: next });
    toast.success(next === "paused" ? "Campanha pausada" : "Campanha retomada");
  };

  const optimize = () => {
    setOptimizing(true);
    setTimeout(() => {
      const ctr = Math.min(7, c.ctr * 1.12);
      const clicks = Math.round(c.clicks * 1.08);
      const impressions = Math.round(c.impressions * 1.05);
      updateCampaign(c.id, { ctr: Number(ctr.toFixed(2)), clicks, impressions, status: "running" });
      setOptimizing(false);
      toast.success("IA reotimizou a campanha", { description: `CTR projetado: ${ctr.toFixed(2)}%` });
    }, 1400);
  };

  const metrics = [
    { label: "Impressões", value: c.impressions.toLocaleString("pt-BR"), icon: Eye },
    { label: "Cliques no link", value: c.clicks.toLocaleString("pt-BR"), icon: MousePointerClick },
    { label: "CTR", value: `${c.ctr.toFixed(2)}%`, icon: Percent },
    { label: "Valor gasto", value: fmtBRL(c.spent), icon: DollarSign },
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
          <Button variant="neon" onClick={optimize} disabled={optimizing}>{optimizing ? "Otimizando..." : "Otimizar com IA"}</Button>
        </div>
      </header>

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
            <img src={c.image} alt="" className="w-full aspect-square object-cover" />
            <div className="p-3 flex items-center justify-between bg-white/[0.02] border-t border-white/5">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase">{new URL(c.link.startsWith("http") ? c.link : "https://" + c.link).hostname}</p>
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

          <div className="glass rounded-2xl p-5 relative overflow-hidden border border-primary/30">
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Dica do Robô
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              A IA notou que este anúncio tem <span className="text-foreground font-medium">20% mais cliques entre 19h e 23h</span>. Sugerimos manter a campanha ativa nesse período.
            </p>
          </div>
        </div>

        {/* Charts column */}
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

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Cliques nos últimos 7 dias</h3>
                <p className="text-xs text-muted-foreground">Evolução diária</p>
              </div>
              <span className="text-xs text-success">▲ +18%</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyClicks}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="oklch(0.65 0.21 265)" />
                      <stop offset="100%" stopColor="oklch(0.62 0.24 300)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                  <XAxis dataKey="day" stroke="oklch(0.7 0.03 260)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.03 260)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.21 0.035 260)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="url(#grad)"
                    strokeWidth={3}
                    dot={{ fill: "oklch(0.65 0.21 265)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Distribuição por idade</h3>
            <p className="text-xs text-muted-foreground mb-4">Quem clicou no seu anúncio</p>
            <div className="grid sm:grid-cols-2 items-center gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ageDistribution} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                      {ageDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.21 0.035 260)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {ageDistribution.map((a, i) => (
                  <li key={a.name} className="flex items-center gap-3 text-sm">
                    <span className="h-3 w-3 rounded" style={{ background: COLORS[i] }} />
                    <span className="flex-1">{a.name} anos</span>
                    <span className="tabular-nums text-muted-foreground">{a.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
