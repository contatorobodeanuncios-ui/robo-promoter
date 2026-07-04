import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    // Regra: abertura só aparece na primeira visita da sessão
    // (após login/logout ou refresh completo). Se o usuário já viu nesta
    // sessão do navegador, vai direto para o dashboard.
    if (typeof window !== "undefined") {
      const seen = window.sessionStorage.getItem("boot_seen") === "1";
      if (seen) throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/power-on" });
  },
  component: () => null,
});
