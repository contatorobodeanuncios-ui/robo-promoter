import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "prototipospremium@gmail.com";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/power-on" });
    }
    // Admin fixo: nunca é bloqueado.
    if ((data.user.email ?? "").toLowerCase() === ADMIN_EMAIL) return;
    // Verifica status do perfil. Pending/banned não acessa o app.
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    const status = (profile?.status ?? "pending") as "pending" | "approved" | "banned";
    if (status !== "approved") {
      throw redirect({ to: "/aguardando" });
    }
  },
  component: AppShell,
});

