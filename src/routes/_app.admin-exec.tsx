import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, TrendingUp, Users, Zap, DollarSign, PieChart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExecDashboard } from "@/lib/support.functions";

export const Route = createFileRoute("/_app/admin-exec")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Dashboard Executivo — AdminDev" }] }),
  component: ExecPage,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Period = "7d" | "30d" | "90d";

function ExecPage() {
  const fn = useServerFn(getExecDashboard);
  const [period, setPeriod] = useState<Period>("30d");
  const q = useQuery({
    queryKey: ["admin-exec", period],
    queryFn: () => fn({ data: { period } }),
    refetchInterval: 60_000,
  });
  const d = q.data;

  const Card = ({
    icon: Icon,
    label,
    value,
    sub,
    tone = "default",
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    tone?: "default" | "positive" | "negative" | "info";
  }) => {
    const tones = {
      default: "border-white/10",
      positive: "border-emerald-500/30 bg-emerald-500/5",
      negative: "border-red-500/30 bg-red-500/5",
      info: "border-sky-500/30 bg-sky-500/5",
    };
    return (
      <div className={`glass rounded-xl p-4 border ${tones[tone]}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admindev" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Dashboard Executivo</h1>
        <div className="ml-auto flex items-center gap-1">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                period === p ? "bg-primary text-primary-foreground border-primary" : "border-white/10 hover:bg-white/5"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading || !d ? (
        <div className="text-sm text-muted-foreground">Carregando métricas...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={DollarSign} tone="positive" label="Receita" value={fmtBRL(d.revenue)} sub={`Ticket médio ${fmtBRL(d.avg_ticket)}`} />
          <Card icon={TrendingUp} tone="info" label="Conversão" value={`${(d.conversion_rate * 100).toFixed(1)}%`} sub="aprovados / total" />
          <Card icon={Users} label="Usuários" value={String(d.total_users)} sub={`${d.active_users} aprovados`} />
          <Card icon={Zap} tone="positive" label="Campanhas rodando" value={String(d.campaigns_running)} />
          <Card icon={PieChart} tone="negative" label="Gasto em anúncios" value={fmtBRL(d.total_spent)} />
          <Card icon={MessageCircle} label="Suporte aberto" value={String(d.open_support)} />
        </div>
      )}
    </div>
  );
}
