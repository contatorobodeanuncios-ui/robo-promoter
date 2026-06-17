import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Sparkles, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Robô de Lucro" },
      { name: "description", content: "Acesse o painel de automação de anúncios Robô de Lucro." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Após login (Google/email), entra direto no app. A abertura só é vista
      // antes do login (quando o usuário acessa o app pela primeira vez ou após sair).
      if (event === "SIGNED_IN" && session?.user) {
        nav({ to: "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar o acesso." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error("Falha", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error("Falha no login com Google", { description: String(result.error.message ?? result.error) });
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
            Seu robô lança e <span className="text-gradient">otimiza anúncios</span> enquanto você atende clientes.
          </h1>
          <p className="text-muted-foreground">
            Crie campanhas em 4 passos. A IA analisa criativos, escolhe o público e ajusta lances em tempo real.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Bot, label: "Análise IA de criativos" },
              { icon: Zap, label: "Lançamento em 60s" },
            ].map(({ icon: I, label }) => (
              <div key={label} className="glass rounded-xl p-4">
                <I className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm">{label}</p>
              </div>
            ))}
          </div>
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
              {mode === "signin" ? "Entre no painel do seu robô." : "Comece com R$ 50 de saldo de boas-vindas."}
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
            <Button type="submit" variant="neon" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar no painel" : "Criar conta"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>Novo por aqui? <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">Criar conta</button></>
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
