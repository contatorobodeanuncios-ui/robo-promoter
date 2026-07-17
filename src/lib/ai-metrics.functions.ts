import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "prototipospremium@gmail.com";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function assertAdmin(claims: { email?: string } | undefined) {
  const email = (claims?.email ?? "").toLowerCase();
  if (email !== ADMIN_EMAIL) throw new Error("Forbidden: admin only");
}

export type Verdict = "good" | "warn" | "bad" | "no_data";

interface CampaignForReview {
  id: string;
  name: string;
  headline: string;
  copy: string;
  budget: number;
  days: number;
  spent: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  results: number;
  cost_per_result: number;
  status: string;
  meta_effective_status: string | null;
  started_running_at: string | null;
}

async function callAI(prompt: string): Promise<{
  verdict: Verdict;
  summary: string;
  recommendations: string[];
} | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = j.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      verdict?: string;
      summary?: string;
      recommendations?: string[];
    };
    const v = (parsed.verdict ?? "").toLowerCase();
    const verdict: Verdict =
      v === "good" || v === "bom" ? "good"
        : v === "bad" || v === "ruim" ? "bad"
        : v === "warn" || v === "atencao" || v === "atenção" ? "warn"
        : "no_data";
    return {
      verdict,
      summary: String(parsed.summary ?? "").slice(0, 500),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 6).map((s) => String(s).slice(0, 200))
        : [],
    };
  } catch { return null; }
}

function buildPrompt(c: CampaignForReview): string {
  const budgetTotal = c.budget * c.days;
  const consumed = budgetTotal > 0 ? (c.spent / budgetTotal) * 100 : 0;
  const ageDays = c.started_running_at
    ? Math.max(0, Math.floor((Date.now() - new Date(c.started_running_at).getTime()) / 86400000))
    : 0;
  return `Você é um especialista sênior em Meta Ads. Avalie o desempenho desta campanha e responda APENAS JSON.

CAMPANHA: "${c.name}"
Título: ${c.headline}
Texto: ${c.copy}
Orçamento: R$ ${c.budget}/dia por ${c.days} dias (total R$ ${budgetTotal})
Rodando há: ${ageDays} dias
Status no Meta: ${c.meta_effective_status ?? "?"}

MÉTRICAS ATUAIS:
- Gasto: R$ ${c.spent.toFixed(2)} (${consumed.toFixed(0)}% do orçamento)
- Impressões: ${c.impressions}
- Cliques: ${c.clicks}
- CTR: ${c.ctr.toFixed(2)}%
- CPC: R$ ${c.cpc.toFixed(2)}
- CPM: R$ ${c.cpm.toFixed(2)}
- Frequência: ${c.frequency.toFixed(2)}
- Resultados: ${c.results}
- Custo/resultado: R$ ${c.cost_per_result.toFixed(2)}

BENCHMARKS Meta Brasil 2025 (referência):
- CTR bom: > 1.5%; ruim: < 0.6%
- CPC bom: < R$ 1,50; ruim: > R$ 4,00
- Frequência saudável: 1.2–3.0; acima de 4 indica fadiga do criativo
- Custo/resultado deve tender a cair com tempo

Classifique o desempenho em UMA de 4 categorias:
- "good": performa acima da média, escala é recomendada
- "warn": performa ok, mas há sinais de atenção (CTR caindo, frequência alta, CPC subindo)
- "bad": performa mal — precisa de ação imediata (trocar criativo, pausar, refazer público)
- "no_data": ainda não gerou dados suficientes para julgar (< 500 impressões OU < 24h no ar)

Responda JSON exato:
{
  "verdict": "good" | "warn" | "bad" | "no_data",
  "summary": "1 frase em pt-BR com o veredicto e o motivo principal",
  "recommendations": ["ação 1 concreta", "ação 2", ... até 4]
}`;
}

// Analisa UMA campanha e salva review. Retorna a review criada.
export const aiReviewCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as { email?: string });
    const admin = await getAdmin();
    const { data: c, error } = await admin
      .from("campaigns")
      .select("id, name, headline, copy, budget, days, spent, clicks, impressions, ctr, cpc, cpm, frequency, results, cost_per_result, status, meta_effective_status, started_running_at")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Campanha não encontrada");

    const camp: CampaignForReview = {
      id: c.id, name: c.name, headline: c.headline, copy: c.copy,
      budget: Number(c.budget), days: Number(c.days),
      spent: Number(c.spent), clicks: Number(c.clicks), impressions: Number(c.impressions),
      ctr: Number(c.ctr), cpc: Number(c.cpc), cpm: Number(c.cpm ?? 0),
      frequency: Number(c.frequency ?? 0), results: Number(c.results ?? 0),
      cost_per_result: Number(c.cost_per_result ?? 0),
      status: c.status, meta_effective_status: c.meta_effective_status,
      started_running_at: c.started_running_at,
    };

    let result = await callAI(buildPrompt(camp));
    if (!result) {
      // Sem IA — decide heurísticamente
      const enoughData = camp.impressions >= 500;
      result = enoughData
        ? {
            verdict: camp.ctr >= 1.5 ? "good" : camp.ctr >= 0.7 ? "warn" : "bad",
            summary: `CTR de ${camp.ctr.toFixed(2)}% com ${camp.impressions} impressões.`,
            recommendations: [],
          }
        : { verdict: "no_data", summary: "Poucas impressões — aguarde 24h.", recommendations: [] };
    }

    const { data: ins, error: iErr } = await admin
      .from("campaign_ai_reviews")
      .insert({
        campaign_id: camp.id,
        verdict: result.verdict,
        summary: result.summary,
        recommendations: result.recommendations as unknown as never,
        metrics_snapshot: {
          spent: camp.spent, clicks: camp.clicks, impressions: camp.impressions,
          ctr: camp.ctr, cpc: camp.cpc, cpm: camp.cpm, frequency: camp.frequency,
        } as unknown as never,
        model: "google/gemini-2.5-flash",
      })
      .select("id, verdict, summary, recommendations, created_at")
      .single();
    if (iErr) throw new Error(iErr.message);
    return {
      id: ins.id,
      verdict: ins.verdict as Verdict,
      summary: ins.summary,
      recommendations: Array.isArray(ins.recommendations) ? (ins.recommendations as unknown as string[]) : [],
      created_at: ins.created_at,
    };
  });

// Roda para TODAS campanhas com meta_campaign_id (usado pelo cron).
export async function reviewAllCampaigns(): Promise<{ processed: number; errors: number }> {
  const admin = await getAdmin();
  const { data: camps } = await admin
    .from("campaigns")
    .select("id, name, headline, copy, budget, days, spent, clicks, impressions, ctr, cpc, cpm, frequency, results, cost_per_result, status, meta_effective_status, started_running_at, meta_campaign_id")
    .not("meta_campaign_id", "is", null)
    .in("status", ["running", "rodando", "paused", "em_revisao"]);
  let processed = 0, errors = 0;
  for (const c of camps ?? []) {
    try {
      const camp: CampaignForReview = {
        id: c.id, name: c.name, headline: c.headline, copy: c.copy,
        budget: Number(c.budget), days: Number(c.days),
        spent: Number(c.spent), clicks: Number(c.clicks), impressions: Number(c.impressions),
        ctr: Number(c.ctr), cpc: Number(c.cpc), cpm: Number(c.cpm ?? 0),
        frequency: Number(c.frequency ?? 0), results: Number(c.results ?? 0),
        cost_per_result: Number(c.cost_per_result ?? 0),
        status: c.status, meta_effective_status: c.meta_effective_status,
        started_running_at: c.started_running_at,
      };
      const result = (await callAI(buildPrompt(camp))) ?? {
        verdict: (camp.impressions < 500 ? "no_data" : camp.ctr >= 1.5 ? "good" : camp.ctr >= 0.7 ? "warn" : "bad") as Verdict,
        summary: `CTR ${camp.ctr.toFixed(2)}% / ${camp.impressions} impr.`,
        recommendations: [],
      };
      await admin.from("campaign_ai_reviews").insert({
        campaign_id: camp.id,
        verdict: result.verdict,
        summary: result.summary,
        recommendations: result.recommendations as unknown as never,
        metrics_snapshot: {
          spent: camp.spent, clicks: camp.clicks, impressions: camp.impressions,
          ctr: camp.ctr, cpc: camp.cpc, cpm: camp.cpm, frequency: camp.frequency,
        } as unknown as never,
        model: "google/gemini-2.5-flash",
      });
      processed++;
    } catch (e) {
      errors++;
      console.error("aiReviewAllCampaigns error", c.id, e);
    }
  }
  return { processed, errors };
}
