import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(10),
  headline: z.string().default(""),
  body: z.string().default(""),
  link: z.string().default(""),
});

export type Severity = "hard_block" | "soft_warning";

export interface CreativeIssue {
  severity: Severity;
  message: string;
}

export type CreativeAnalysis = {
  compliant: boolean;
  policy_issues: string[];
  issues: CreativeIssue[];
  text_ratio_ok: boolean;
  face_detected: boolean;
  visual_score: number;
  engagement_lift: number;
  summary: string;
  error?: string;
};

const fallback = (note: string): CreativeAnalysis => ({
  compliant: true,
  policy_issues: [],
  issues: [],
  text_ratio_ok: true,
  face_detected: false,
  visual_score: 70,
  engagement_lift: 5,
  summary: "Análise offline (sem IA).",
  error: note,
});

export const analyzeCreative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<CreativeAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return fallback("LOVABLE_API_KEY ausente");

    const prompt = `Você é um auditor de Meta/Facebook Ads. Avalie o anúncio.

Classifique CADA problema em uma de duas severidades:
- "hard_block": viola POLÍTICAS reais da Meta (promessa enganosa de dinheiro/renda, antes/depois agressivo, conteúdo adulto/proibido, atributos pessoais sensíveis, armas, drogas). Bloqueia a publicação.
- "soft_warning": apenas qualidade visual ou recomendação de design (imagem escura, texto desalinhado, excesso de texto, baixo contraste, foto borrada). NÃO bloqueia.

TÍTULO: ${data.headline}
TEXTO: ${data.body}
LINK: ${data.link}

Responda APENAS JSON válido com este schema:
{
  "compliant": boolean (false APENAS se houver algum hard_block),
  "issues": [{ "severity": "hard_block" | "soft_warning", "message": string (pt-BR, curto) }],
  "policy_issues": string[] (apenas mensagens dos hard_block, para compatibilidade),
  "text_ratio_ok": boolean,
  "face_detected": boolean,
  "visual_score": number (0-100),
  "engagement_lift": number (-30 a 50),
  "summary": string (1 frase pt-BR)
}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return fallback(`AI ${res.status}: ${txt.slice(0, 120)}`);
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = j.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as Partial<CreativeAnalysis>;
      const issues = Array.isArray(parsed.issues)
        ? parsed.issues
            .filter((i) => i && (i.severity === "hard_block" || i.severity === "soft_warning") && i.message)
            .map((i) => ({ severity: i.severity, message: String(i.message) }))
        : [];
      const hasHard = issues.some((i) => i.severity === "hard_block");
      return {
        compliant: parsed.compliant === false ? false : !hasHard,
        issues,
        policy_issues:
          parsed.policy_issues ?? issues.filter((i) => i.severity === "hard_block").map((i) => i.message),
        text_ratio_ok: parsed.text_ratio_ok ?? true,
        face_detected: !!parsed.face_detected,
        visual_score: Math.max(0, Math.min(100, Number(parsed.visual_score) || 0)),
        engagement_lift: Math.max(-30, Math.min(50, Number(parsed.engagement_lift) || 0)),
        summary: String(parsed.summary ?? ""),
      };
    } catch (err) {
      return fallback(err instanceof Error ? err.message : "erro desconhecido");
    }
  });
