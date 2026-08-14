import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Plus, Settings, LogOut, Bot, Menu, X, ArrowUp } from "lucide-react";
import { Logo } from "./Logo";
import { SupportWidget } from "./SupportWidget";
import { ProMaxMenu } from "./ProMaxMenu";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { startSession, endSession, trackClick } from "@/lib/activity";

const nav = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/create" as const, label: "Novo Anúncio", icon: Plus },
  { to: "/settings" as const, label: "Configurações", icon: Settings },
];

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    import("@/lib/sentry-browser").then((m) => m.initSentryClient()).catch(() => { /* noop */ });
    import("@/lib/pwa-register").then((m) => m.registerPWA()).catch(() => { /* noop */ });
  }, []);

  useEffect(() => {
    startSession();
    const onUnload = () => endSession();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      endSession();
    };
  }, []);

  const onLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    trackClick("logout");
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
                onClick={() => trackClick(`nav:${label}`)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all min-w-0 ${
                  active
                    ? "bg-gradient-to-r from-primary/20 to-accent/20 text-foreground border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
        <ProMaxMenu />
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Mais opções"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">
        <Outlet />
      </main>
      <SupportWidget />
      <OnboardingHint />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-white/5 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to === "/dashboard" && path === "/");
          return (
            <Link
              key={to}
              id={to === "/create" ? "nav-novo-anuncio" : undefined}
              to={to}
              onClick={() => trackClick(`nav:${label}`)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors min-w-0 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sheet "Mais" — garante acesso a tudo no mobile sem cortar nada */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="glass-strong w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/10 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Mais opções</p>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => { trackClick(`nav:${label}`); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm min-w-0 hover:bg-white/5"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/10">
              <ProMaxMenu compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Notificação flutuante de onboarding, exibida uma vez por sessão. */
function OnboardingHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = window.sessionStorage.getItem("onboarding_hint_seen");
    if (seen) return;
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { window.sessionStorage.setItem("onboarding_hint_seen", "1"); } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <>
      {/* Desktop: aponta pro item "Novo Anúncio" na sidebar */}
      <div className="hidden md:flex fixed left-72 top-[4.7rem] z-50 items-start gap-2 animate-in fade-in slide-in-from-left-2">
        <ArrowUp className="h-5 w-5 text-primary -rotate-90 -ml-1 mt-3" />
        <div className="glass-strong rounded-2xl border border-primary/30 p-3 max-w-[220px] shadow-[0_0_24px_-8px_hsl(var(--primary))]">
          <button type="button" onClick={dismiss} className="absolute -right-1.5 -top-1.5 p-0.5 rounded-full bg-background border border-white/10">
            <X className="h-3 w-3" />
          </button>
          <p className="text-xs">Que tal colocar seu anúncio no ar agora? Comece por aqui.</p>
        </div>
      </div>

      {/* Mobile: aponta pra barra inferior */}
      <div className="md:hidden fixed inset-x-0 bottom-20 z-50 flex justify-center px-6">
        <div className="glass-strong rounded-2xl border border-primary/30 p-3 max-w-xs w-full relative shadow-[0_0_24px_-8px_hsl(var(--primary))]">
          <button type="button" onClick={dismiss} className="absolute -right-1.5 -top-1.5 p-0.5 rounded-full bg-background border border-white/10">
            <X className="h-3 w-3" />
          </button>
          <p className="text-xs text-center">Que tal colocar seu anúncio no ar agora? Comece por aqui.</p>
          <ArrowUp className="h-4 w-4 text-primary rotate-180 mx-auto mt-1" />
        </div>
      </div>
    </>
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
