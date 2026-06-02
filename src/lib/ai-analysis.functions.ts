import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(10),
  headline: z.string().default(""),
  body: z.string().default(""),
  link: z.string().default(""),
});

export type CreativeAnalysis = {
  compliant: boolean;
  policy_issues: string[];
  text_ratio_ok: boolean;
  face_detected: boolean;
  visual_score: number; // 0-100
  engagement_lift: number; // -30..50 (percentual previsto)
  summary: string;
  error?: string;
};

const fallback = (note: string): CreativeAnalysis => ({
  compliant: true,
  policy_issues: [],
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

    const prompt = `Você é um auditor de Meta/Facebook Ads. Avalie o anúncio abaixo. Considere políticas: sem promessas enganosas, sem conteúdo proibido (armas, drogas, adulto), sem "antes/depois" agressivo, sem atributos pessoais sensíveis.

TÍTULO: ${data.headline}
TEXTO: ${data.body}
LINK: ${data.link}

Responda APENAS um JSON válido com este schema:
{
  "compliant": boolean,
  "policy_issues": string[],
  "text_ratio_ok": boolean,
  "face_detected": boolean,
  "visual_score": number (0-100),
  "engagement_lift": number (-30 a 50, percentual previsto vs média),
  "summary": string (1 frase em pt-BR)
}`;

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: data.imageDataUrl },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return fallback(`AI ${res.status}: ${txt.slice(0, 120)}`);
      }
      const j = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = j.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as CreativeAnalysis;
      return {
        compliant: !!parsed.compliant,
        policy_issues: parsed.policy_issues ?? [],
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