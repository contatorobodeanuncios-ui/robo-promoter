import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, Users, Zap, DollarSign, PieChart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExecDashboard } from "@/lib/support.functions";

export const Route = createFileRoute("/_app/admindev/exec")({
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

function ExecPage() {
  const fn = useServerFn(getExecDashboard);
  const q = useQuery({ queryKey: ["admin-exec"], queryFn: () => fn(), refetchInterval: 60_000 });
  const d = q.data;

  const Card = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) => (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admindev" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Dashboard Executivo</h1>
        <span className="text-xs text-muted-foreground ml-auto">Janela: últimos 30 dias</span>
      </div>

      {q.isLoading || !d ? (
        <div className="text-sm text-muted-foreground">Carregando métricas...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={DollarSign} label="Receita (30d)" value={fmtBRL(d.revenue_30d)} sub={`Ticket médio ${fmtBRL(d.avg_ticket)}`} />
          <Card icon={TrendingUp} label="Conversão" value={`${(d.conversion_rate * 100).toFixed(1)}%`} sub="pagamentos aprovados / total" />
          <Card icon={Users} label="Usuários" value={String(d.total_users)} sub={`${d.active_users} aprovados`} />
          <Card icon={Zap} label="Campanhas rodando" value={String(d.campaigns_running)} />
          <Card icon={PieChart} label="Gasto em anúncios (30d)" value={fmtBRL(d.total_spent_30d)} />
          <Card icon={MessageCircle} label="Suporte aberto" value={String(d.open_support)} />
        </div>
      )}
    </div>
  );
}
