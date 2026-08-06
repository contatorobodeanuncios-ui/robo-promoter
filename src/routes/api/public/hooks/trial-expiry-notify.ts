import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

// Cron diário: avisa usuários no Teste Pro quando faltam 3 dias, 1 dia
// e quando o período acabou. Evita duplicidade guardando os marcos já
// notificados em profiles.notification_prefs.trial_notified.

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/public/hooks/trial-expiry-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = ipFromRequest(request);
        const rl = rateLimit(`trial-expiry:${ip}`, 30, 5 * 60 * 1000);
        if (!rl.ok) return new Response("Too many requests", { status: 429 });

        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.functions");

        const { data: users } = await supabaseAdmin
          .from("profiles")
          .select("id, plan, trial_days, trial_started_at, notification_prefs")
          .eq("plan", "trial_pro");

        let notified = 0;
        for (const u of users ?? []) {
          if (!u.trial_started_at || !u.trial_days) continue;
          const end = new Date(u.trial_started_at).getTime() + Number(u.trial_days) * DAY;
          const daysLeft = Math.ceil((end - Date.now()) / DAY);

          let milestone: string | null = null;
          let title = "";
          let body = "";
          if (daysLeft <= 0) {
            milestone = "end";
            title = "Seu Teste Pro terminou";
            body = "Adquira o PRO para continuar com taxas reduzidas nas suas campanhas.";
          } else if (daysLeft === 1) {
            milestone = "d1";
            title = "Falta 1 dia de Teste Pro";
            body = "Seu período de teste PRO termina amanhã. Garanta o PRO e não perca os benefícios.";
          } else if (daysLeft === 3) {
            milestone = "d3";
            title = "Faltam 3 dias de Teste Pro";
            body = "Seu período de teste PRO está acabando. Adquira o PRO para manter as taxas reduzidas.";
          }
          if (!milestone) continue;

          const prefs = (u.notification_prefs ?? {}) as {
            trial_notified?: string[];
            alerts?: boolean;
          };
          const already = Array.isArray(prefs.trial_notified) ? prefs.trial_notified : [];
          if (already.includes(milestone)) continue;

          try {
            await sendPushToUser(u.id, { title, body, url: "/dashboard" });
          } catch {
            /* ignora falha de push, marca mesmo assim para não repetir em loop */
          }

          await supabaseAdmin
            .from("profiles")
            .update({
              notification_prefs: {
                ...prefs,
                trial_notified: [...already, milestone],
              } as unknown as Record<string, unknown>,
            })
            .eq("id", u.id);
          notified++;
        }

        return Response.json({ ok: true, notified, checked: (users ?? []).length });
      },
    },
  },
});
