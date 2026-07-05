import { createFileRoute } from "@tanstack/react-router";

// Cron job: sincroniza métricas do Meta Ads (Insights API) para todas as campanhas
// com meta_campaign_id definido. Registra a execução em meta_metrics_runs.
// Chamado pelo pg_cron. Autenticação via apikey header (anon key).

export const Route = createFileRoute("/api/public/hooks/meta-metrics-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const started = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: runRow, error: runErr } = await supabaseAdmin
          .from("meta_metrics_runs")
          .insert({ status: "running" })
          .select("id")
          .single();
        if (runErr || !runRow) {
          return Response.json({ ok: false, error: runErr?.message }, { status: 500 });
        }
        const runId = runRow.id;

        let processed = 0;
        let errors = 0;
        let errorMessage: string | null = null;

        try {
          const token = process.env.META_ACCESS_TOKEN;
          if (!token) throw new Error("META_ACCESS_TOKEN não configurado");

          const { data: campaigns, error: cErr } = await supabaseAdmin
            .from("campaigns")
            .select("id, meta_campaign_id")
            .not("meta_campaign_id", "is", null)
            .in("status", ["running", "rodando", "analyzing"]);
          if (cErr) throw new Error(cErr.message);

          for (const c of campaigns ?? []) {
            if (!c.meta_campaign_id) continue;
            try {
              const url = `https://graph.facebook.com/v20.0/${c.meta_campaign_id}/insights?fields=spend,clicks,impressions,ctr,cpc&access_token=${encodeURIComponent(token)}`;
              const res = await fetch(url);
              if (!res.ok) throw new Error(`Meta Insights ${res.status}`);
              const json = (await res.json()) as { data?: Array<Record<string, string>> };
              const row = json.data?.[0];
              if (!row) { processed++; continue; }
              await supabaseAdmin
                .from("campaigns")
                .update({
                  spent: Number(row.spend ?? 0),
                  clicks: Number(row.clicks ?? 0),
                  impressions: Number(row.impressions ?? 0),
                  ctr: Number(row.ctr ?? 0),
                  cpc: Number(row.cpc ?? 0),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", c.id);
              processed++;
            } catch (err) {
              errors++;
              console.error("meta-metrics-sync campaign error", c.id, err);
            }
          }

          await supabaseAdmin
            .from("meta_metrics_runs")
            .update({
              status: errors > 0 && processed === 0 ? "error" : "ok",
              finished_at: new Date().toISOString(),
              processed_count: processed,
              error_count: errors,
              duration_ms: Date.now() - started,
            })
            .eq("id", runId);

          return Response.json({ ok: true, processed, errors });
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : String(err);
          await supabaseAdmin
            .from("meta_metrics_runs")
            .update({
              status: "error",
              finished_at: new Date().toISOString(),
              processed_count: processed,
              error_count: errors + 1,
              error_message: errorMessage,
              duration_ms: Date.now() - started,
            })
            .eq("id", runId);
          return Response.json({ ok: false, error: errorMessage }, { status: 500 });
        }
      },
    },
  },
});
