import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plus, Settings, LogOut, Bot } from "lucide-react";
import { Logo } from "./Logo";
import { useAppStore } from "@/lib/store";

const nav = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/create" as const, label: "Novo Anúncio", icon: Plus },
  { to: "/settings" as const, label: "Configurações", icon: Settings },
];

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col glass-strong border-r border-white/5 p-5 sticky top-0 h-screen">
        <Logo />
        <nav className="mt-10 flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to || (to === "/dashboard" && path === "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-gradient-to-r from-primary/20 to-accent/20 text-foreground border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1">
          <div className="glass rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 text-xs">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Robô</span>
              <span className="ml-auto flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Online
              </span>
            </div>
            <BalanceLine />
          </div>
          <Link
            to="/login"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" /> Sair
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function BalanceLine() {
  const balance = useAppStore((s) => s.balance);
  return (
    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
      <span>Saldo</span>
      <span className="font-semibold text-foreground tabular-nums">
        R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
