import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/app/Logo";
import { supabase } from "@/integrations/supabase/client";

// Entrada direta por link de acesso gerado pelo admin.
// Recebe ?th=<hashed_token> e faz verifyOtp — o cliente entra sem digitar nada.
export const Route = createFileRoute("/entrar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrando — Robô de Lucro" },
      { name: "description", content: "Acesso direto ao painel do Robô de Lucro pelo seu link exclusivo." },
    ],
  }),
  component: EntrarPage,
});

function EntrarPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const th = params.get("th") ?? params.get("token_hash");
      if (!th) {
        setError("Link inválido ou incompleto.");
        return;
      }
      const { error: err } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: th,
      });
      if (cancelled) return;
      if (err) {
        setError("Este link expirou ou já foi usado. Peça um novo ao suporte.");
        return;
      }
      window.history.replaceState({}, "", "/entrar");
      nav({ to: "/dashboard", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="space-y-4">
        <Logo />
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Não foi possível entrar</h1>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
            <a href="/login" className="text-primary text-sm underline">
              Ir para o login
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Entrando no seu painel...</h1>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
          </>
        )}
      </div>
    </main>
  );
}
