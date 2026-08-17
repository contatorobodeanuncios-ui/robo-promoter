import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Sparkles, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitAccessRequest } from "@/lib/admin.functions";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { guardAuthAttempt } from "@/lib/security.functions";
import { friendlyMessage } from "@/lib/errors";
import { fbTrackOnce } from "@/lib/fbq";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Robô de Lucro" },
      { name: "description", content: "Acesse o painel de automação de anúncios Robô de Lucro." },
    ],
  }),
  component: LoginPage,
});

const ADMIN_EMAIL = "prototipospremium@gmail.com";

async function routeAfterLogin(
  userId: string,
  email: string | null,
  displayName: string | null,
  nav: ReturnType<typeof useNavigate>,
) {
  fbTrackOnce("CompleteRegistration", "fb_registration_tracked");
  const isAdmin = (email ?? "").toLowerCase() === ADMIN_EMAIL;
  if (isAdmin) {
    nav({ to: "/dashboard", replace: true });
    return;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  const status = (profile?.status ?? "pending") as "pending" | "approved" | "banned";
  if (status === "approved") {
    nav({ to: "/dashboard", replace: true });
    return;
  }
  // Registra/atualiza o pedido de acesso. Se o admin deixou as "entradas abertas",
  // o servidor aprova na hora e o usuário entra direto no painel.
  try {
    const res = await submitAccessRequest({ data: { display_name: displayName } });
    if (res?.approved) {
      nav({ to: "/dashboard", replace: true });
      return;
    }
  } catch {
    await supabase.from("access_requests").upsert(
      {
        user_id: userId,
        email,
        display_name: displayName,
        status: status === "banned" ? "rejected" : "pending",
      },
      { onConflict: "user_id" },
    );
  }
  nav({ to: "/aguardando", replace: true });
}

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        void routeAfterLogin(
          data.user.id,
          data.user.email ?? null,
          (data.user.user_metadata?.full_name as string | undefined) ?? null,
          nav,
        );
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        void routeAfterLogin(
          session.user.id,
          session.user.email ?? null,
          (session.user.user_metadata?.full_name as string | undefined) ?? null,
          nav,
        );
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Camada de proteção que roda ANTES da lógica de login/cadastro.
      const guard = await guardAuthAttempt({
        data: { action: mode === "signup" ? "signup" : "login", email },
      }).catch(() => ({ ok: true, message: null as string | null }));
      if (!guard.ok) {
        toast.error("Aguarde", { description: guard.message ?? "Muitas tentativas, tente novamente em alguns minutos." });
        setLoading(false);
        return;
      }
      if (mode === "signup") {
        if (!acceptedTerms) {
          toast.error("Aceite necessário", { description: "Você precisa aceitar os Termos e a Política de Privacidade." });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: name,
              terms_accepted_at: new Date().toISOString(),
              terms_version: "2026-07-05",
            },
          },
        });
        if (error) throw error;
        toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar o acesso." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      void guardAuthAttempt({
        data: { action: mode === "signup" ? "signup" : "login", email, failed: true },
      }).catch(() => {});
      toast.error("Falha", { description: friendlyMessage(err, "Não foi possível entrar. Tente novamente.") });
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
    });
    if (result.error) {
      toast.error("Falha no login com Google", { description: friendlyMessage(result.error, "Não foi possível entrar com o Google. Tente novamente.") });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative grid-bg overflow-hidden p-12 flex-col justify-between border-r border-white/5">
        <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
        <Logo size={36} />
        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" /> IA + Facebook Ads
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Pare de perder dinheiro tentando <span className="text-gradient">entender de tráfego</span>.
          </h1>
          <p className="text-muted-foreground">
            Envie seu criativo, escolha o público e o robô cuida do resto: análise, lançamento e
            otimização automática das suas campanhas — sem Gerenciador confuso, sem Pixel, sem
            agência cobrando caro.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Bot, label: "Análise IA de criativos" },
              { icon: Zap, label: "Anúncio no ar em minutos" },
              { icon: Sparkles, label: "Sem precisar entender de tráfego" },
            ].map(({ icon: I, label }) => (
              <div key={label} className="glass rounded-xl p-4">
                <I className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Pagamento seguro · Suporte rápido · Cancele quando quiser
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Robô de Lucro — Automação inteligente de anúncios</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex justify-center"><Logo /></div>
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Entre no painel do seu robô."
                : "Novas contas passam por aprovação do administrador antes de acessar o painel."}
            </p>
          </div>

          <Button variant="glass" className="w-full h-11" onClick={onGoogle} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.92h5.51c-.25 1.37-1.7 4.03-5.51 4.03-3.31 0-6.01-2.74-6.01-6.13s2.7-6.13 6.01-6.13c1.87 0 3.13.8 3.85 1.48l2.84-2.76C17.09 2.84 14.97 2 12.18 2 6.92 2 2.68 6.24 2.68 11.5S6.92 21 12.18 21c7.03 0 9.41-4.92 9.41-7.5 0-.5-.05-.88-.24-2.4Z"/></svg>
            Continuar com Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou com e-mail</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required />
            </div>
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  required
                />
                <span>
                  Li e aceito os{" "}
                  <Link to="/termos" target="_blank" className="text-primary hover:underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  (LGPD).
                </span>
              </label>
            )}
            <Button type="submit" variant="neon" className="w-full h-11" disabled={loading || (mode === "signup" && !acceptedTerms)}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar e ver minhas campanhas" : "Criar conta"}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            {" · "}
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>Ainda não tem robô? <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">Criar minha conta grátis</button></>
            ) : (
              <>Já tem conta? <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">Entrar</button></>
            )}
          </p>

          <p className="text-center text-[11px] text-muted-foreground">
            <Link to="/power-on" className="hover:text-foreground">Ver animação de abertura</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
