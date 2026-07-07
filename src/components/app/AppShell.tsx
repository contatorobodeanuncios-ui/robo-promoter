import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Plus, Settings, LogOut, Bot } from "lucide-react";
import { Logo } from "./Logo";
import { SupportWidget } from "./SupportWidget";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";


const nav = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/create" as const, label: "Novo Anúncio", icon: Plus },
  { to: "/settings" as const, label: "Configurações", icon: Settings },
];

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  useEffect(() => {
    import("@/lib/sentry-browser").then((m) => m.initSentryClient()).catch(() => { /* noop */ });
    import("@/lib/pwa-register").then((m) => m.registerPWA()).catch(() => { /* noop */ });
  }, []);

  const onLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await supabase.auth.signOut();
    // Ao sair, volta para a abertura (regra: só volta pra abertura via "Sair").
    try { window.sessionStorage.removeItem("boot_seen"); } catch { /* ignore */ }
    navigate({ to: "/power-on", replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
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
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 glass-strong border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <Logo size={22} />
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sair"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">
        <Outlet />
      </main>
      <SupportWidget />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-white/5 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to === "/dashboard" && path === "/");
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          );
        })}
      </nav>
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

export function useUserDisplayName() {
  const storeName = useAppStore((s) => s.displayName);
  const [authName, setAuthName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (meta.given_name as string) ||
        (u.email ? u.email.split("@")[0] : null);
      setAuthName(name ?? null);
    });
  }, []);
  return storeName || authName || "amigo";
}
