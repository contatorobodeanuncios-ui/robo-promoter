import { createFileRoute } from "@tanstack/react-router";

// Cron: analisa todas as campanhas com IA e grava veredicto em campaign_ai_reviews.
// Chamado por pg_cron a cada 3h. Autenticado via CRON_SECRET (secret dedicado,
// para não depender de qual formato/valor de publishable key o projeto usa).
export const Route = createFileRoute("/api/public/hooks/ai-review-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.CRON_SECRET;
        if (!expected || !apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { reviewAllCampaigns } = await import("@/lib/ai-metrics.functions");
          const r = await reviewAllCampaigns();
          return Response.json({ ok: true, ...r });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});
