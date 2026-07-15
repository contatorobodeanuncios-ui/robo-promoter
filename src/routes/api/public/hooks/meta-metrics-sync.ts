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
            .select("id, meta_campaign_id, started_at, status")
            .not("meta_campaign_id", "is", null)
            .in("status", ["running", "rodando", "analyzing", "em_revisao", "paused"]);
          if (cErr) throw new Error(cErr.message);

          const mapEffectiveStatus = (
            eff: string | undefined | null,
          ): string | null => {
            switch ((eff ?? "").toUpperCase()) {
              case "ACTIVE": return "rodando";
              case "PAUSED":
              case "CAMPAIGN_PAUSED": return "paused";
              case "ARCHIVED":
              case "DELETED": return "encerrada_saldo_consumido";
              case "PENDING_REVIEW":
              case "IN_PROCESS":
              case "WITH_ISSUES": return "em_revisao";
              default: return null;
            }
          };

          for (const c of campaigns ?? []) {
            if (!c.meta_campaign_id) continue;
            const nowIso = new Date().toISOString();
            try {
              // 1) Insights (métricas)
              const insUrl = `https://graph.facebook.com/v20.0/${c.meta_campaign_id}/insights?fields=spend,clicks,impressions,ctr,cpc&access_token=${encodeURIComponent(token)}`;
              const insRes = await fetch(insUrl);
              if (!insRes.ok) {
                const errTxt = await insRes.text();
                throw new Error(`Meta Insights ${insRes.status}: ${errTxt.slice(0, 200)}`);
              }
              const insJson = (await insRes.json()) as { data?: Array<Record<string, string>> };
              const row = insJson.data?.[0];

              // 2) Effective status
              const stUrl = `https://graph.facebook.com/v20.0/${c.meta_campaign_id}?fields=effective_status&access_token=${encodeURIComponent(token)}`;
              const stRes = await fetch(stUrl);
              const stJson = (await stRes.json()) as { effective_status?: string };
              const effective = stJson.effective_status ?? null;
              const mappedStatus = mapEffectiveStatus(effective);

              const spend = Number(row?.spend ?? 0);
              const clicks = Number(row?.clicks ?? 0);
              const impressions = Number(row?.impressions ?? 0);
              const hasDelivery = spend > 0 || clicks > 0 || impressions > 0;

              const update: Record<string, unknown> = {
                metrics_last_synced_at: nowIso,
                metrics_last_error: null,
                meta_effective_status: effective,
                updated_at: nowIso,
              };
              if (row) {
                update.spent = spend;
                update.clicks = clicks;
                update.impressions = impressions;
                update.ctr = Number(row.ctr ?? 0);
                update.cpc = Number(row.cpc ?? 0);
              }
              // Primeira detecção de entrega → grava started_at
              if (hasDelivery && !c.started_at) {
                update.started_at = nowIso;
                if (!update.started_running_at) update.started_running_at = nowIso;
              }
              // Só atualiza status via Meta se não for "aguardando_vinculo_meta" (fluxo de pagamento)
              if (mappedStatus && c.status !== "aguardando_vinculo_meta") {
                update.status = mappedStatus;
                if (mappedStatus === "paused") update.paused_at = nowIso;
                if (mappedStatus === "encerrada_saldo_consumido") update.ended_at = nowIso;
              }

              await supabaseAdmin.from("campaigns").update(update).eq("id", c.id);
              processed++;
            } catch (err) {
              errors++;
              const msg = err instanceof Error ? err.message : String(err);
              await supabaseAdmin
                .from("campaigns")
                .update({
                  metrics_last_error: msg,
                  metrics_last_synced_at: nowIso,
                })
                .eq("id", c.id);
              console.error("meta-metrics-sync campaign error", c.id, msg);
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
