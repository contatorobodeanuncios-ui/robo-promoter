import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  UploadCloud, ScanLine, Check, Sparkles, MapPin, Users, Target,
  Rocket, ChevronLeft, ChevronRight, Loader2, CalendarDays, AlertTriangle, X,
} from "lucide-react";
import { MapPreview } from "@/components/app/MapPreview";
import { reachRange, fmtRange } from "@/lib/mock-data";
import { analyzeCreative, type CreativeAnalysis } from "@/lib/ai-analysis.functions";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Criar Anúncio — Robô de Lucro" },
      { name: "description", content: "Lance um anúncio em 4 passos com a IA do Robô de Lucro." },
    ],
  }),
  component: CreateWizard,
});

const steps = [
  { n: 1, title: "Criativo", desc: "Upload + análise IA" },
  { n: 2, title: "Copy & Oferta", desc: "Texto e link" },
  { n: 3, title: "Público", desc: "Segmentação" },
  { n: 4, title: "Lançar", desc: "Orçamento e robô" },
];

function CreateWizard() {
  const nav = useNavigate();
  const addCampaign = useAppStore((s) => s.addCampaign);
  const analyzeFn = useServerFn(analyzeCreative);
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done">("idle");
  const [analysis, setAnalysis] = useState<CreativeAnalysis | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [aiTargeting, setAiTargeting] = useState(true);
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [radius, setRadius] = useState("15");
  const [budget, setBudget] = useState(15);
  const [days, setDays] = useState(7);
  const [launching, setLaunching] = useState(false);

  const handleFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    setImage(url);
    setScanState("scanning");
    setAnalysis(null);
    // Lê base64 para enviar ao AI gateway
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);
      try {
        const result = await analyzeFn({
          data: {
            imageDataUrl: dataUrl,
            headline,
            body,
            link,
          },
        });
        setAnalysis(result);
        setScanState("done");
        if (!result.compliant) {
          toast.error("Bloqueado pela IA — ajuste o criativo para avançar.");
        } else if (result.issues.some((i) => i.severity === "soft_warning")) {
          toast.warning("A IA sugeriu ajustes de design (não bloqueia).");
        }
      } catch (err) {
        toast.error("Falha ao analisar criativo");
        setScanState("done");
      }
    };
    reader.readAsDataURL(f);
  };

  const launch = () => {
    if (!image) return;
    setLaunching(true);
    const id = `c_${Date.now().toString(36)}`;
    const range = reachRange(budget, days);
    // Métricas iniciais derivadas da análise da IA
    const lift = analysis?.engagement_lift ?? 0;
    const score = analysis?.visual_score ?? 70;
    const ctrBase = 2.8 + (score - 50) * 0.04 + lift * 0.02; // ~ 2-5%
    const ctr = Math.max(0.8, Math.min(7, ctrBase));
    const impressions = Math.round((range.min + range.max) / 2 * 0.05); // estimativa inicial
    const clicks = Math.round(impressions * (ctr / 100));
    const cpc = budget * days > 0 && clicks > 0 ? (budget * days * 0.1) / Math.max(1, clicks) : 0;
    const spent = Math.round(clicks * cpc * 100) / 100;

    setTimeout(() => {
      addCampaign({
        id,
        name: headline || "Nova campanha",
        image: image,
        status: "analyzing",
        spent,
        clicks,
        impressions,
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2)),
        copy: body,
        headline,
        link,
        budget,
        days,
        city,
        neighborhood,
        radius: Number(radius) || 1,
      });
      toast.success("Robô preparado!", { description: "Finalize o pagamento via PIX para colocar o anúncio no ar." });
      nav({
        to: "/payment",
        search: { budget, days, name: headline || "Nova campanha", campaignId: id },
      });
    }, 1200);
  };

  const canNext =
    (step === 1 && scanState === "done" && (analysis?.compliant ?? true)) ||
    (step === 2 && headline && body && link) ||
    (step === 3 && city.trim() && neighborhood.trim() && Number(radius) > 0) ||
    step === 4;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Criador de campanha
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Lançar novo anúncio</h1>
      </header>

      {/* Stepper */}
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n} className={`glass rounded-xl p-3 border transition-all ${active ? "border-primary/60 border-glow" : done ? "border-success/40" : "border-white/5"}`}>
              <div className="flex items-center gap-2">
                <span className={`grid place-items-center h-6 w-6 rounded-full text-xs font-semibold ${done ? "bg-success text-background" : active ? "bg-gradient-to-br from-primary to-accent text-white" : "bg-white/5 text-muted-foreground"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.desc}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="glass-strong rounded-2xl p-6 lg:p-8 min-h-[420px]">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Envie o criativo</h2>
              <p className="text-sm text-muted-foreground">A IA verifica conformidade com as políticas do Facebook.</p>
            </div>

            {!image && (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="border-2 border-dashed border-white/15 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-white/[0.02] transition-all">
                  <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3 animate-float" />
                  <p className="font-medium">Arraste uma imagem ou clique para enviar</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 10MB · Recomendado 1080×1080</p>
                </div>
              </label>
            )}

            {image && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                  <img src={image} alt="preview" className="absolute inset-0 h-full w-full object-cover" />
                  {scanState === "scanning" && (
                    <>
                      <div className="absolute inset-0 bg-primary/10" />
                      <div className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-primary/70 to-transparent animate-scan" />
                      <div className="absolute inset-4 border border-primary/60 rounded-xl" />
                      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs">
                        <ScanLine className="h-3.5 w-3.5 text-primary animate-pulse" />
                        Robô analisando criativo...
                      </div>
                    </>
                  )}
                  {scanState === "done" && (
                    <div className="absolute top-3 left-3 right-3 flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-success">
                      <Check className="h-3.5 w-3.5" /> Imagem aprovada
                    </div>
                  )}
                </div>

                <AiAnalysisPanel
                  scanState={scanState}
                  analysis={analysis}
                  onReset={() => { setImage(null); setImageDataUrl(null); setScanState("idle"); setAnalysis(null); }}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold">Copy & oferta</h2>
              <p className="text-sm text-muted-foreground">A IA refinará seu texto antes de publicar.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Título do anúncio</Label>
              <Input placeholder="Ex: 🔥 Pizza grande por R$29,90" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Texto principal</Label>
              <Textarea rows={4} placeholder="Descreva sua oferta de forma irresistível..." value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Dica do robô: comece com um benefício claro nos primeiros 60 caracteres.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Link de destino (WhatsApp ou site)</Label>
              <Input placeholder="https://wa.me/55..." value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold">Inteligência de público</h2>
              <p className="text-sm text-muted-foreground">Deixe a IA escolher quem verá seu anúncio.</p>
            </div>

            <div className={`glass rounded-2xl p-5 border transition-all ${aiTargeting ? "border-primary/50 border-glow" : "border-white/5"}`}>
              <div className="flex items-start gap-4">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Segmentação Inteligente da IA</p>
                    <Switch checked={aiTargeting} onCheckedChange={setAiTargeting} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    O robô analisa seu copy e criativo para encontrar o público com maior probabilidade de conversão.
                  </p>
                </div>
              </div>
            </div>

            {/* Localização SEMPRE obrigatória, mesmo com IA ativa */}
            <div className="glass rounded-2xl p-5 space-y-4 border border-white/5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">Localização <span className="text-destructive">*</span></p>
                <span className="text-[11px] text-muted-foreground ml-auto">Obrigatório mesmo com IA</span>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                A IA precisa saber onde rodar o anúncio. Cidade, bairro e raio são sempre obrigatórios.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Ex: São Paulo, SP" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input placeholder="Ex: Pinheiros" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Raio (km)</Label>
                  <Input type="number" min={1} max={80} value={radius} onChange={(e) => setRadius(e.target.value)} />
                </div>
              </div>

              <div className="pt-2">
                <MapPreview
                  city={city}
                  neighborhood={neighborhood}
                  radius={Number(radius) || 1}
                  className="aspect-[16/9] w-full"
                />
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Pré-visualização da área onde o robô vai veicular o anúncio.
                </p>
              </div>
            </div>

            {!aiTargeting && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Faixa etária</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="18" />
                    <Input placeholder="55" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> 3 interesses</Label>
                  <Input placeholder="Ex: gastronomia" />
                  <Input placeholder="Ex: delivery" />
                  <Input placeholder="Ex: cervejaria" />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h2 className="text-xl font-semibold">Orçamento e lançamento</h2>
              <p className="text-sm text-muted-foreground">Mínimo de R$ 7/dia e 7 dias de veiculação — tempo que o robô precisa para otimizar.</p>
            </div>

            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Orçamento diário</p>
                <p className="text-5xl font-bold tabular-nums mt-1">
                  R$ <span className="text-gradient">{budget}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Mínimo: R$ 7,00 / dia</p>
              </div>
              <Slider value={[budget]} min={7} max={300} step={1} onValueChange={(v) => setBudget(v[0])} />

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Duração do anúncio</Label>
                  <span className="text-sm font-semibold tabular-nums">{days} dias</span>
                </div>
                <Slider value={[days]} min={7} max={60} step={1} onValueChange={(v) => setDays(v[0])} />
                <p className="text-[11px] text-muted-foreground">Mínimo de 7 dias — período necessário para o robô aprender e otimizar a campanha.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 text-center border-t border-white/5">
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground">Público alcançado</p>
                  <p className="font-semibold text-gradient text-sm">
                    {fmtRange(reachRange(budget, days))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">faixa estimada</p>
                </div>
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground">Cliques esperados</p>
                  <p className="font-semibold">{Math.round(budget * days * 2.6).toLocaleString("pt-BR")}</p>
                </div>
                <div className="pt-3">
                  <p className="text-xs text-muted-foreground">Investimento total</p>
                  <p className="font-semibold">R$ {(budget * days).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                Com R$ {budget}/dia por {days} dias o anúncio deve impactar entre{" "}
                <span className="text-foreground font-semibold">{fmtRange(reachRange(budget, days))}</span>{" "}
                pessoas em {neighborhood || "sua região"}{city ? `, ${city}` : ""} (raio de {radius} km).
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3 flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Duração</p>
                  <p className="font-semibold">{days} dias · R$ {budget}/dia</p>
                </div>
              </div>
              <div className="glass rounded-xl p-3 flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="text-xs min-w-0">
                  <p className="text-muted-foreground">Localização · raio {radius} km</p>
                  <p className="font-semibold truncate">
                    {neighborhood || "—"}{city ? `, ${city}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <Button variant="neon" size="lg" className="w-full h-14 text-base animate-pulse-glow" onClick={launch} disabled={launching}>
              {launching ? <><Loader2 className="animate-spin" /> Ativando robô...</> : <><Rocket /> Ativar Robô e Lançar Anúncio</>}
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="glass" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft /> Voltar
        </Button>
        {step < 4 && (
          <Button variant="neon" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continuar <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function AiAnalysisPanel({
  scanState,
  analysis,
  onReset,
}: {
  scanState: "idle" | "scanning" | "done";
  analysis: CreativeAnalysis | null;
  onReset: () => void;
}) {
  const rows = [
    {
      label: "Conformidade com políticas",
      ok: analysis?.compliant ?? true,
      note: analysis?.policy_issues?.length
        ? analysis.policy_issues.slice(0, 2).join(" · ")
        : analysis
          ? "Sem violações detectadas"
          : undefined,
    },
    {
      label: "Quantidade de texto na imagem",
      ok: analysis?.text_ratio_ok ?? true,
      note: analysis
        ? analysis.text_ratio_ok
          ? "Dentro do limite recomendado (<20%)"
          : "Acima de 20% — pode reduzir entrega"
        : undefined,
    },
    {
      label: "Atratividade visual estimada",
      ok: (analysis?.visual_score ?? 0) >= 50,
      note: analysis ? `Score: ${analysis.visual_score}/100` : undefined,
    },
    {
      label: "Engajamento previsto",
      ok: (analysis?.engagement_lift ?? 0) >= 0,
      note: analysis
        ? `${analysis.engagement_lift >= 0 ? "+" : ""}${analysis.engagement_lift}% vs média ${analysis.face_detected ? "· rosto humano detectado" : ""}`
        : undefined,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Análise da IA (real-time)
      </h3>
      {rows.map((r, i) => (
        <div key={i} className="glass rounded-lg p-3 flex items-center gap-3">
          {scanState !== "done" ? (
            <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
          ) : r.ok ? (
            <Check className="h-4 w-4 text-success shrink-0" />
          ) : (
            <X className="h-4 w-4 text-destructive shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm">{r.label}</p>
            {scanState === "done" && r.note && (
              <p className="text-xs text-muted-foreground">{r.note}</p>
            )}
          </div>
        </div>
      ))}
      {scanState === "done" && analysis?.summary && (
        <div className="glass rounded-lg p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{analysis.summary}</p>
        </div>
      )}
      {scanState === "done" && analysis && !analysis.compliant && (
        <div className="rounded-lg p-3 border border-destructive/40 bg-destructive/5 space-y-1">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive font-semibold">
              Bloqueado: viola política da Meta. Envie outra imagem.
            </p>
          </div>
          {analysis.issues.filter((i) => i.severity === "hard_block").map((i, idx) => (
            <p key={idx} className="text-[11px] text-destructive/90 pl-6">• {i.message}</p>
          ))}
        </div>
      )}
      {scanState === "done" && analysis?.compliant &&
        analysis.issues.some((i) => i.severity === "soft_warning") && (
          <div className="rounded-lg p-3 border border-warning/50 bg-warning/10 space-y-1">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning font-semibold">
                Sugestões de design (não obrigatórias)
              </p>
            </div>
            {analysis.issues.filter((i) => i.severity === "soft_warning").map((i, idx) => (
              <p key={idx} className="text-[11px] text-warning/90 pl-6">• {i.message}</p>
            ))}
          </div>
        )}
      <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground">
        Trocar imagem
      </button>
    </div>
  );
}
