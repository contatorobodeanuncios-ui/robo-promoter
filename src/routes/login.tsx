import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Sparkles, Zap } from "lucide-react";

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
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground">Entre no painel do seu robô de anúncios.</p>
          </div>

          <Button variant="glass" className="w-full h-11" onClick={() => nav({ to: "/power-on" })}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.92h5.51c-.25 1.37-1.7 4.03-5.51 4.03-3.31 0-6.01-2.74-6.01-6.13s2.7-6.13 6.01-6.13c1.87 0 3.13.8 3.85 1.48l2.84-2.76C17.09 2.84 14.97 2 12.18 2 6.92 2 2.68 6.24 2.68 11.5S6.92 21 12.18 21c7.03 0 9.41-4.92 9.41-7.5 0-.5-.05-.88-.24-2.4Z"/></svg>
            Entrar com Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou com e-mail</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); nav({ to: "/power-on" }); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="voce@empresa.com" defaultValue="demo@robo-de-lucro.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" placeholder="••••••••" defaultValue="demo1234" />
            </div>
            <Button type="submit" variant="neon" className="w-full h-11">
              Entrar no painel
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Novo por aqui? <span className="text-primary cursor-pointer hover:underline">Criar conta</span>
          </p>
        </div>
      </div>
    </div>
  );
}
