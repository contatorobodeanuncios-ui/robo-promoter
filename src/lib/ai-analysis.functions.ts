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
  // Novos campos (item 5) — opcionais, não quebram quem já consumia o formato antigo.
  looks_like_stock_photo?: boolean;
  sharpness_ok?: boolean;
  contrast_ok?: boolean;
  has_visual_cta?: boolean;
  score_breakdown?: {
    sharpness: number;
    framing: number;
    contrast: number;
    authenticity: number;
    text_balance: number;
    call_to_action: number;
  };
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
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { rateLimit, ipFromRequest } = await import("@/lib/rate-limit");
      const req = getRequest();
      const ip = req ? ipFromRequest(req) : "unknown";
      const rl = rateLimit(`analyze-creative:${ip}`, 60, 5 * 60 * 1000);
      if (!rl.ok) return fallback("Limite de análises atingido. Tente novamente em alguns minutos.");
    } catch { /* getRequest indisponível em alguns contextos — segue */ }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return fallback("LOVABLE_API_KEY ausente");

    // Prompt reforçado (item 5): antes pedia uma nota solta de 0-100, o que a IA
    // tende a responder com números "redondos" e genéricos (70, 80...) sem
    // analisar a imagem de verdade. Agora exige uma nota por critério
    // específico e mensurável, com a nota final sendo a média deles — isso
    // obriga o modelo a realmente olhar pra imagem em vez de "chutar".
    const prompt = `Você é um auditor sênior de Meta/Facebook Ads, especializado em performance criativa E compliance de políticas. Seja crítico e específico — não dê notas genéricas ou arredondadas sem justificativa.

## 1. Compliance de políticas
Classifique CADA problema em uma de duas severidades:
- "hard_block": viola políticas reais da Meta (promessa enganosa de dinheiro/renda, antes/depois agressivo, conteúdo adulto/proibido, atributos pessoais sensíveis, armas, drogas). Bloqueia a publicação.
- "soft_warning": apenas qualidade visual ou recomendação de design. NÃO bloqueia.

## 2. Qualidade visual — avalie CADA critério abaixo separadamente, com nota de 0 a 100:
- **sharpness** (nitidez): a imagem está nítida e sem pixelização, adequada pra tela de celular? Imagem borrada ou de baixa resolução recebe nota baixa.
- **framing** (enquadramento): o assunto principal está bem centralizado, sem cortes acidentais de rosto/produto/texto importante?
- **contrast** (contraste/legibilidade): as cores e qualquer texto na imagem se destacam bem contra o fundo azul/branco do feed do Facebook? Fundo muito claro ou cores lavadas recebem nota baixa.
- **authenticity** (autenticidade): a imagem parece uma foto real de uso/produto, ou parece banco de imagens genérico, clipart óbvio, ou renderização artificial mal feita? Isso reduz a confiança de quem vê o anúncio — seja rigoroso aqui.
- **text_balance** (proporção de texto): pouco ou nenhum texto embutido na própria imagem é ideal (a Meta penaliza excesso de texto na imagem). Nota baixa se houver muito texto sobreposto.
- **call_to_action** (apelo visual): existe algum elemento visual (seta, botão, destaque, direção do olhar) guiando a atenção para a ação desejada? Nota baixa se a composição não direciona o olhar em nenhum lugar específico.

O "visual_score" final deve ser a MÉDIA desses 6 critérios — não invente um número separado.

Se houver rosto humano na imagem, avalie também se a expressão parece genuína/natural ou parece pose forçada de banco de imagens (isso conta para "authenticity").

TÍTULO: ${data.headline}
TEXTO: ${data.body}
LINK: ${data.link}

Responda APENAS JSON válido com este schema exato:
{
  "compliant": boolean (false APENAS se houver algum hard_block),
  "issues": [{ "severity": "hard_block" | "soft_warning", "message": string (pt-BR, curto e específico sobre O QUE exatamente está errado) }],
  "policy_issues": string[] (apenas mensagens dos hard_block, para compatibilidade),
  "text_ratio_ok": boolean,
  "face_detected": boolean,
  "looks_like_stock_photo": boolean,
  "sharpness_ok": boolean,
  "contrast_ok": boolean,
  "has_visual_cta": boolean,
  "score_breakdown": {
    "sharpness": number (0-100),
    "framing": number (0-100),
    "contrast": number (0-100),
    "authenticity": number (0-100),
    "text_balance": number (0-100),
    "call_to_action": number (0-100)
  },
  "visual_score": number (0-100, média dos 6 critérios acima),
  "engagement_lift": number (-30 a 50, estimativa realista de impacto no engajamento comparado a um anúncio mediano do mesmo nicho),
  "summary": string (1-2 frases em pt-BR, específicas sobre o principal ponto forte E o principal ponto fraco da imagem)
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

      const breakdown = parsed.score_breakdown;
      const computedScore =
        breakdown &&
        typeof breakdown.sharpness === "number" &&
        typeof breakdown.framing === "number" &&
        typeof breakdown.contrast === "number" &&
        typeof breakdown.authenticity === "number" &&
        typeof breakdown.text_balance === "number" &&
        typeof breakdown.call_to_action === "number"
          ? (breakdown.sharpness + breakdown.framing + breakdown.contrast +
             breakdown.authenticity + breakdown.text_balance + breakdown.call_to_action) / 6
          : Number(parsed.visual_score) || 0;

      return {
        compliant: parsed.compliant === false ? false : !hasHard,
        issues,
        policy_issues:
          parsed.policy_issues ?? issues.filter((i) => i.severity === "hard_block").map((i) => i.message),
        text_ratio_ok: parsed.text_ratio_ok ?? true,
        face_detected: !!parsed.face_detected,
        looks_like_stock_photo: !!parsed.looks_like_stock_photo,
        sharpness_ok: parsed.sharpness_ok ?? true,
        contrast_ok: parsed.contrast_ok ?? true,
        has_visual_cta: !!parsed.has_visual_cta,
        score_breakdown: breakdown,
        visual_score: Math.max(0, Math.min(100, Math.round(computedScore))),
        engagement_lift: Math.max(-30, Math.min(50, Number(parsed.engagement_lift) || 0)),
        summary: String(parsed.summary ?? ""),
      };
    } catch (err) {
      return fallback(err instanceof Error ? err.message : "erro desconhecido");
    }
  });
