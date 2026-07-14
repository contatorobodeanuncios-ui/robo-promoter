import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Hourglass, LogOut, RefreshCw, Rocket, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/aguardando")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aguardando aprovação — Robô de Lucro" },
      { name: "description", content: "Sua conta está em análise pelo administrador." },
    ],
  }),
  component: WaitingApprovalPage,
});

function WaitingApprovalPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<"pending" | "banned" | "approved" | "unknown">("unknown");
  const [email, setEmail] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const timerRef = useRef<number | null>(null);

  const check = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setChecking(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { nav({ to: "/login", replace: true }); return; }
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", u.user.id)
        .maybeSingle();
      const s = (p?.status ?? "pending") as "pending" | "banned" | "approved";
      setStatus(s);
    } finally {
      if (!opts?.silent) {
        setChecking(false);
        setJustChecked(true);
        window.setTimeout(() => setJustChecked(false), 2500);
      }
    }
  };

  useEffect(() => {
    void check({ silent: true });
    // Polling automático a cada 15s enquanto aguarda
    timerRef.current = window.setInterval(() => {
      void check({ silent: true });
    }, 15_000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    try { window.sessionStorage.removeItem("boot_seen"); } catch { /* ignore */ }
    nav({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <div className="glass-strong rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <Logo />
        {status === "approved" ? (
          <>
            <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-success/15 shadow-[0_0_30px_-5px_var(--color-success)]">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold">Acesso liberado!</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta ({email}) foi aprovada. Clique no botão abaixo para entrar no app.
            </p>
            <Button
              variant="neon"
              size="lg"
              className="w-full text-base font-bold"
              onClick={() => nav({ to: "/dashboard", replace: true })}
            >
              <Rocket className="h-5 w-5" /> ACESSAR AGORA
            </Button>
          </>
        ) : status === "banned" ? (
          <>
            <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-destructive/15">
              <LogOut className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Acesso bloqueado</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta ({email}) foi bloqueada pelo administrador. Se acredita que isto é um engano,
              entre em contato pelo suporte.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="glass" onClick={signOut}><LogOut className="h-4 w-4" /> Sair</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-primary/15 animate-pulse">
              <Hourglass className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Aguardando aprovação</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta ({email}) foi registrada e está aguardando liberação do administrador.
              A liberação costuma ser rápida — você receberá acesso assim que for aprovado.
            </p>
            {justChecked && status === "pending" && (
              <p className="text-xs text-warning">
                Ainda não foi liberado. Aguarde um instante — verificamos automaticamente a cada 15s.
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button variant="glass" onClick={() => check()} disabled={checking}>
                <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Verificar status
              </Button>
              <Button variant="glass" onClick={signOut}><LogOut className="h-4 w-4" /> Sair</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
