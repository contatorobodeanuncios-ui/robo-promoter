import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

// Cron: envia resumo diário para usuários com notification_prefs.daily = true
// e status = 'approved'/'active'. Chamado por pg_cron via apikey header.

export const Route = createFileRoute("/api/public/hooks/send-push-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = ipFromRequest(request);
        const rl = rateLimit(`push-daily:${ip}`, 60, 5 * 60 * 1000);
        if (!rl.ok) return new Response("Too many requests", { status: 429 });

        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.functions");

        const { data: users } = await supabaseAdmin
          .from("profiles")
          .select("id, notification_prefs")
          .in("status", ["approved", "active"]);

        let sent = 0, skipped = 0;
        for (const u of users ?? []) {
          const prefs = (u.notification_prefs ?? {}) as { daily?: boolean };
          if (prefs.daily === false) { skipped++; continue; }
          try {
            const r = await sendPushToUser(u.id, {
              title: "Resumo diário",
              body: "Confira o desempenho das suas campanhas hoje.",
              url: "/dashboard",
            });
            sent += r.sent;
          } catch { /* ignore */ }
        }
        return Response.json({ ok: true, sent, skipped });
      },
    },
  },
});
