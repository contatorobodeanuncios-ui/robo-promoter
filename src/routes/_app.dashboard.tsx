import { reachRange, fmtRange } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, MousePointerClick, DollarSign, TrendingDown, Plus, Sparkles, MapPin, CalendarDays, Users } from "lucide-react";
import { EnergyOrb } from "@/components/app/EnergyOrb";
import { RobotMascot } from "@/components/app/RobotMascot";
import { SafeImage } from "@/components/app/SafeImage";
import { useUserDisplayName } from "@/components/app/AppShell";
import { useAppStore, computeSummary } from "@/lib/store";
import { PushNotificationBanner } from "@/components/app/PushNotificationBanner";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Robô de Lucro" },
      { name: "description", content: "Visão geral das suas campanhas automatizadas." },
    ],
  }),
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  running: { label: "Rodando", cls: "text-success bg-success/10 border-success/30", dot: "bg-success" },
  rodando: { label: "Rodando", cls: "text-success bg-success/10 border-success/30", dot: "bg-success" },
  analyzing: { label: "IA analisando", cls: "text-primary bg-primary/10 border-primary/30", dot: "bg-primary animate-pulse" },
  aguardando_vinculo_meta: { label: "Aguardando PIX/Meta", cls: "text-warning bg-warning/10 border-warning/30", dot: "bg-warning animate-pulse" },
  paused: { label: "Pausado", cls: "text-muted-foreground bg-white/5 border-white/10", dot: "bg-muted-foreground" },
  encerrada_saldo_consumido: { label: "Encerrada", cls: "text-muted-foreground bg-white/5 border-white/10", dot: "bg-muted-foreground" },
};

function Dashboard() {
  const campaigns = useAppStore((s) => s.campaigns);
  const balance = useAppStore((s) => s.balance);
  const displayName = useUserDisplayName();
  const summary = computeSummary(campaigns);
  const running = campaigns.filter((c) => c.status === "running");
  const hasRunning = running.length > 0;
  const cards = [
    { label: "Saldo no app", value: fmtBRL(balance), icon: DollarSign, hint: balance > 0 ? "creditado após pagamento" : "Aguardando pagamento Asaas" },
    { label: "Cliques reais", value: hasRunning ? summary.totalClicks.toLocaleString("pt-BR") : "—", icon: MousePointerClick, hint: hasRunning ? `CTR ${summary.avgCtr.toFixed(2)}% · Facebook/Pixel` : "Sem campanhas ativas" },
    { label: "CPC real", value: hasRunning ? fmtBRL(summary.avgCpc) : "—", icon: TrendingDown, hint: hasRunning ? `${summary.totalImpressions.toLocaleString("pt-BR")} impressões` : "Sem dados do Facebook ainda" },
    { label: "Status do Robô", value: hasRunning ? "Operando" : "Parado", icon: Bot, hint: `monitorando ${running.length} campanha(s) ativa(s)`, live: hasRunning },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Olá, <span translate="no">{displayName}</span> 👋
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Painel do Robô</h1>
        </div>
        <Link to="/create">
          <Button variant="neon" size="lg">
            <Plus /> Criar novo anúncio
          </Button>
        </Link>
      </header>

      <PushNotificationBanner />


      {/* Núcleo da IA */}
      <section className="glass-strong rounded-3xl p-6 lg:p-10 grid lg:grid-cols-[auto_1fr] gap-8 items-center relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute -top-20 -left-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col items-center justify-center gap-4 py-10 lg:py-14 mx-auto w-full">
          <EnergyOrb state={campaigns.length ? "ok" : "analyzing"} size={260} label="Sistema ligado" labelPosition="bottom" />
        </div>
        <div className="relative space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Núcleo de IA · Robô de Lucro</p>
          <h2 className="text-2xl lg:text-3xl font-bold leading-tight">
            O robô está <span className="text-gradient">otimizando {campaigns.length} campanha{campaigns.length === 1 ? "" : "s"}</span> em tempo real.
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Análise de criativos, segmentação automática e ajuste de lances acontecem 24/7 — você só acompanha os resultados.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="glass rounded-full px-3 py-1 text-[11px] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> {summary.running} rodando
            </span>
            <span className="glass rounded-full px-3 py-1 text-[11px] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> {summary.analyzing} em análise
            </span>
            <span className="glass rounded-full px-3 py-1 text-[11px] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> {summary.paused} pausada(s)
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-white/5">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-2xl font-bold">{c.value}</span>
              {c.live && <span className="h-2 w-2 rounded-full bg-success animate-pulse mb-2" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Campanhas ativas</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} campanhas</span>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {campaigns.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha ativa. <Link to="/create" className="text-primary">Criar uma agora</Link>.
            </div>
          )}
          {campaigns.map((c) => {
            const s = statusMeta[c.status];
            const range = reachRange(c.budget, c.days);
            const isRunning = c.status === "running";
            return (
              <Link
                to="/campaign/$id"
                params={{ id: c.id }}
                key={c.id}
                className="block px-5 py-4 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <SafeImage src={c.image} alt="" className="h-14 w-14 rounded-lg object-cover border border-white/10 shrink-0" fallbackClassName="h-14 w-14 rounded-lg border border-white/10 shrink-0 grid place-items-center bg-white/5 text-muted-foreground" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.headline}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border shrink-0 ${s.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" />
                        {c.neighborhood}, {c.city} · {c.radius} km
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 text-primary" />
                        {c.days} dias · R$ {c.budget}/dia
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" />
                        alcance estimado {fmtRange(range)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1">
                      <span className="tabular-nums">
                        <span className="text-muted-foreground">Pago pelo anúncio</span>{" "}
                        <span className="font-semibold text-primary">{fmtBRL(c.total_paid)}</span>
                      </span>
                      {isRunning ? (
                        <>
                          <span className="tabular-nums">
                            <span className="text-muted-foreground">Gasto (FB)</span>{" "}
                            <span className="font-semibold">{fmtBRL(c.spent)}</span>
                          </span>
                          <span className="tabular-nums">
                            <span className="text-muted-foreground">Cliques reais</span>{" "}
                            <span className="font-semibold">{c.clicks.toLocaleString("pt-BR")}</span>
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Métricas aparecem aqui assim que a campanha ficar ativa (Facebook/Pixel).
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {hasRunning && summary.totalClicks > 0 && (
        <RobotMascot
          tone="success"
          message={`Você tem ${running.length} campanha(s) rodando com ${summary.totalClicks.toLocaleString("pt-BR")} cliques reais reportados pelo Facebook.`}
        />
      )}
    </div>
  );
}
