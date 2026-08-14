import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  UploadCloud, ScanLine, Check, Sparkles, MapPin, Users, Target,
  Rocket, ChevronLeft, ChevronRight, Loader2, CalendarDays, AlertTriangle, X, Clock, Wrench,
  Image as ImageIcon, Video, Images,
} from "lucide-react";
import { MapPreview } from "@/components/app/MapPreview";
import { reachRange, fmtRange } from "@/lib/mock-data";
import { analyzeCreative, type CreativeAnalysis } from "@/lib/ai-analysis.functions";
import { getCreativeUploadPath, getMaintenanceMode } from "@/lib/data.functions";
import { useAppStore } from "@/lib/store";
import { campaignPricing, mediaBudgetForViews, isCreditsLike, MIN_DAYS, packagePriceFor, clicksForViews } from "@/lib/pricing";
import { CopyModal } from "@/components/app/ProMaxMenu";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Criar Anúncio — Robô de Lucro" },
      { name: "description", content: "Lance um anúncio em 8 passos guiados com a IA do Robô de Lucro." },
    ],
  }),
  component: CreateWizard,
});

const steps = [
  { n: 1, title: "Boas-vindas", desc: "Como funciona" },
  { n: 2, title: "Criativo", desc: "Upload + análise IA" },
  { n: 3, title: "Copy", desc: "Texto e link" },
  { n: 4, title: "Localização", desc: "Cidade e bairro" },
  { n: 5, title: "Visualizações e duração", desc: `Alcance e dias (mín. ${MIN_DAYS})` },
  { n: 6, title: "Seus anúncios", desc: "Resumo" },
  { n: 7, title: "Pagamento", desc: "Ativar anúncio" },
  { n: 8, title: "Confirmação", desc: "Revisão final" },
];

// Limite real do Facebook para imagem de anúncio (não é um teto do app).
const META_MAX_IMAGE_MB = 30;

function CreateWizard() {
  const nav = useNavigate();
  const addCampaign = useAppStore((s) => s.addCampaign);
  const analyzeFn = useServerFn(analyzeCreative);
  const uploadPathFn = useServerFn(getCreativeUploadPath);
  const maintenanceFn = useServerFn(getMaintenanceMode);

  const maintenanceQ = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: () => maintenanceFn(),
    staleTime: 30_000,
  });

  const [step, setStep] = useState(1);
  // Criativo: imagem única, vídeo ou carrossel (várias imagens, em ordem).
  const [mediaMode, setMediaMode] = useState<"image" | "video" | "carousel">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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
  const clampRadius = (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    if (n > 199) return "199";
    return v;
  };
  const [budget, setBudget] = useState(15);
  const [days, setDays] = useState(7);
  const [copyOpen, setCopyOpen] = useState(false);
  const [fundingType, setFundingType] = useState<"wallet" | "pix_dedicated">("wallet");
  // Verba de veiculação + taxa (mesma regra para PIX e saldo do app).
  const plan = useAppStore((s) => s.plan);
  // Plano CRÉDITOS: o cliente escolhe dias (1 crédito = 1 dia) + potência de
  // visualizações. O preço do pacote já embute tudo — nenhuma taxa é exibida.
  const isCredits = isCreditsLike(plan);
  const [views, setViews] = useState(5000);
  const creditsDaily = Math.max(1, Math.round(mediaBudgetForViews(views) / days));
  const effBudget = isCredits ? creditsDaily : budget;
  const pricing = campaignPricing(effBudget, days, plan);
  // Preço real do pacote (créditos) considerando a potência de visualizações escolhida.
  const packageTotal = isCredits ? packagePriceFor(days, views) : pricing.total;
  const estClicks = clicksForViews(views);
  const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const [launching, setLaunching] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  // Item novo: horário exato de início/fim escolhido pelo cliente (opcional).
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startAt, setStartAt] = useState(""); // formato datetime-local
  const [endAt, setEndAt] = useState("");

  const resetMedia = (mode?: "image" | "video" | "carousel") => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviews([]);
    setImageDataUrl(null);
    setScanState("idle");
    setAnalysis(null);
    if (mode) setMediaMode(mode);
  };

  const analyzeFirstImage = (f: File) => {
    setScanState("scanning");
    setAnalysis(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);
      try {
        const result = await analyzeFn({ data: { imageDataUrl: dataUrl, headline, body, link } });
        setAnalysis(result);
        setScanState("done");
        if (!result.compliant) {
          toast.error("Bloqueado pela IA — ajuste o criativo para avançar.");
        } else if (result.issues.some((i) => i.severity === "soft_warning")) {
          toast.warning("A IA sugeriu ajustes de design (não bloqueia).");
        }
      } catch {
        toast.error("Falha ao analisar criativo");
        setScanState("done");
      }
    };
    reader.readAsDataURL(f);
  };

  // Recebe os arquivos conforme o modo escolhido.
  const handleFiles = (list: FileList | null, mode: "image" | "video" | "carousel") => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;

    if (mode === "image" || mode === "carousel") {
      const invalid = picked.find((f) => !f.type.startsWith("image/"));
      if (invalid) {
        toast.error("Só imagens aqui", { description: "Para vídeo, use a aba Vídeo." });
        return;
      }
      const tooBig = picked.find((f) => f.size > META_MAX_IMAGE_MB * 1024 * 1024);
      if (tooBig) {
        toast.error(`Imagem maior que ${META_MAX_IMAGE_MB}MB`, {
          description: "Esse é o limite máximo aceito pelo próprio Facebook — não é uma restrição do app.",
        });
        return;
      }
    } else if (!picked[0].type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }

    if (mode === "carousel") {
      // Carrossel: acumula quantas imagens o cliente quiser, na ordem enviada.
      const next = [...files, ...picked].slice(0, 30);
      setFiles(next);
      setPreviews((p) => [...p, ...picked.map((f) => URL.createObjectURL(f))].slice(0, 30));
      if (!imageDataUrl) analyzeFirstImage(next[0]);
      return;
    }

    previews.forEach((u) => URL.revokeObjectURL(u));
    const f = picked[0];
    setFiles([f]);
    setPreviews([URL.createObjectURL(f)]);
    if (mode === "image") {
      analyzeFirstImage(f);
    } else {
      // Vídeo: a análise de imagem da IA não se aplica, segue direto.
      setImageDataUrl(null);
      setAnalysis(null);
      setScanState("done");
    }
  };

  const removeAt = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    const nf = files.filter((_, idx) => idx !== i);
    setFiles(nf);
    setPreviews(previews.filter((_, idx) => idx !== i));
    if (nf.length === 0) setScanState("idle");
  };


  const launch = async () => {
    if (files.length === 0) return;
    setLaunching(true);
    try {
      // Sobe todos os arquivos do criativo (imagem, vídeo ou carrossel) para o
      // Storage, na ordem em que o cliente enviou.
      const media: { path: string; kind: "image" | "video"; name: string; mime: string; size: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setUploadProgress(`Enviando ${i + 1} de ${files.length}...`);
        const { path } = await uploadPathFn({ data: { filename: f.name } });
        const { error: upErr } = await supabase.storage
          .from("campaign-creatives")
          .upload(path, f, { contentType: f.type || "application/octet-stream" });
        if (upErr) throw new Error(`Falha ao enviar ${f.name}: ${upErr.message}`);
        media.push({
          path,
          kind: f.type.startsWith("video/") ? "video" : "image",
          name: f.name,
          mime: f.type,
          size: f.size,
        });
      }
      setUploadProgress(null);
      const firstImage = media.find((m) => m.kind === "image");
      const persistedImage = firstImage
        ? supabase.storage.from("campaign-creatives").getPublicUrl(firstImage.path).data.publicUrl
        : "";

      const scheduledStartIso = scheduleEnabled && startAt ? new Date(startAt).toISOString() : null;
      const scheduledEndIso = scheduleEnabled && endAt ? new Date(endAt).toISOString() : null;
      if (scheduledStartIso && scheduledEndIso && new Date(scheduledEndIso) <= new Date(scheduledStartIso)) {
        toast.error("O horário de término precisa ser depois do horário de início");
        setLaunching(false);
        return;
      }

      const result = await addCampaign({
        name: headline || "Nova campanha",
        image: persistedImage,
        media_type: mediaMode,
        media,

        status: "analyzing",
        spent: 0,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        cpc: 0,
        copy: body,
        headline,
        link,
        budget: effBudget,
        days,
        city,
        neighborhood,
        radius: Number(radius) || 1,
        funding_type: fundingType,
        pix_total_budget: fundingType === "pix_dedicated" ? effBudget * days : 0,
        pix_remaining_budget: 0,
        reach: 0,
        results: 0,
        revenue: 0,
        frequency: 0,
        cpm: 0,
        cost_per_result: 0,
        invoice_url: null,
        paused_at: null,
        started_running_at: null,
        ended_at: null,
        created_at: new Date().toISOString(),
        scheduled_start_at: scheduledStartIso,
        scheduled_end_at: scheduledEndIso,
        credits_total: isCredits ? days : null,
      });
      if (result.paid) {
        toast.success("Anúncio pago com saldo do app!", {
          description: isCredits
            ? `${fmtMoney(result.totalCost)} debitados. ${days} créditos liberados — robô em análise.`
            : `${fmtMoney(result.totalCost)} debitados (${fmtMoney(result.metaBudget)} de veiculação + ${fmtMoney(result.serviceFee)} de taxas). Robô em análise.`,
        });
        nav({ to: "/dashboard" });
      } else {
        toast.info(
          fundingType === "pix_dedicated"
            ? "Campanha criada — pagamento PIX 100% para Meta Ads."
            : "Saldo insuficiente — redirecionando ao pagamento.",
          {
            description:
              fundingType === "pix_dedicated"
                ? isCredits
                  ? `Total do pacote: ${fmtMoney(result.totalCost)} — ${days} créditos.`
                  : `${fmtMoney(result.metaBudget)} vão diretamente para o anúncio (sem reembolso). Total do PIX: ${fmtMoney(result.totalCost)}.`
                : `Faltam ${fmtMoney(result.remainingDue)} para ativar a campanha.`,
          },
        );

        nav({
          to: "/payment",
          search: { budget: effBudget, days, name: headline || "Nova campanha", campaignId: result.campaign.id },
        });
      }
    } catch (e) {
      toast.error("Falha ao criar campanha", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLaunching(false);
    }
  };

  const canNext =
    step === 1 ||
    (step === 2 && files.length > 0 && scanState === "done" && (analysis?.compliant ?? true)) ||
    (step === 3 && Boolean(headline && body && link)) ||
    (step === 4 && Boolean(city.trim() && neighborhood.trim() && Number(radius) >= 1 && Number(radius) <= 199)) ||
    (step === 5 && days >= MIN_DAYS) ||
    step === 6 ||
    step === 7;

  // Modo de manutenção: bloqueia a criação de novas campanhas pra todo mundo.
  if (maintenanceQ.data?.enabled) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="glass-strong rounded-2xl p-10 text-center space-y-4 border border-warning/30">
          <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 border border-warning/30 grid place-items-center">
            <Wrench className="h-7 w-7 text-warning" />
          </div>
          <h1 className="text-2xl font-bold">Em manutenção</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {maintenanceQ.data.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Criador de campanha
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Lançar novo anúncio</h1>
      </header>

      {/* Stepper */}
      <div className="space-y-3">
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Etapa {step} de {steps.length}</p>
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold">Bem-vindo ao criador guiado</h2>
              <p className="text-sm text-muted-foreground">
                Em 8 passos rápidos o robô monta, valida e coloca seu anúncio no ar.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {steps.slice(1).map((st) => (
                <li key={st.n} className="flex items-center gap-3 glass rounded-lg px-3 py-2">
                  <span className="grid place-items-center h-6 w-6 rounded-full bg-white/5 text-xs">{st.n - 1}</span>
                  <span className="text-foreground font-medium">{st.title}</span>
                  <span className="ml-auto text-[11px]">{st.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Você pode voltar em qualquer etapa antes de confirmar o pagamento.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Envie o criativo</h2>
              <p className="text-sm text-muted-foreground">A IA verifica conformidade com as políticas do Facebook.</p>
            </div>

            {files.length === 0 && (
              <label className="block">
                <input
                  type="file"
                  accept={mediaMode === "video" ? "video/*" : "image/*"}
                  multiple={mediaMode === "carousel"}
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files, mediaMode)}
                />
                <div className="border-2 border-dashed border-white/15 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-white/[0.02] transition-all">
                  <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3 animate-float" />
                  <p className="font-medium">
                    {mediaMode === "video"
                      ? "Clique para enviar um vídeo"
                      : mediaMode === "carousel"
                        ? "Clique para enviar as imagens do carrossel"
                        : "Arraste uma imagem ou clique para enviar"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mediaMode === "video"
                      ? "Qualquer formato de vídeo (MP4, MOV, etc.) · resolução original preservada"
                      : mediaMode === "carousel"
                        ? `Quantas imagens quiser (até 30), na ordem que você escolher · até ${META_MAX_IMAGE_MB}MB cada`
                        : `PNG ou JPG até ${META_MAX_IMAGE_MB}MB (limite do próprio Facebook) · Recomendado 1080×1080`}
                  </p>
                </div>
              </label>
            )}

            {/* Botões de tipo de criativo, logo abaixo do upload */}
            <div className="flex flex-wrap gap-2">
              {([
                { id: "image", label: "Imagem", icon: ImageIcon },
                { id: "video", label: "Vídeo", icon: Video },
                { id: "carousel", label: "Carrossel", icon: Images },
              ] as const).map((m) => {
                const Icon = m.icon;
                const active = mediaMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { if (!active) resetMedia(m.id); }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-all ${
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground border-glow"
                        : "border-white/10 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {m.label}
                  </button>
                );
              })}
            </div>

            {files.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {mediaMode === "video" ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black">
                      <video src={previews[0]} controls className="h-full w-full object-contain" />
                    </div>
                  ) : mediaMode === "carousel" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {previews.map((p, i) => (
                        <div key={p} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                          <img src={p} alt={`imagem ${i + 1}`} className="h-full w-full object-cover" />
                          <span className="absolute top-1 left-1 rounded-md bg-background/80 px-1.5 text-[11px] font-semibold">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAt(i)}
                            className="absolute top-1 right-1 rounded-md bg-background/80 p-1 hover:bg-destructive/80"
                            aria-label={`remover imagem ${i + 1}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square rounded-xl border-2 border-dashed border-white/15 grid place-items-center cursor-pointer hover:border-primary/50">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(e) => handleFiles(e.target.files, "carousel")}
                        />
                        <UploadCloud className="h-5 w-5 text-primary" />
                      </label>
                    </div>
                  ) : (
                    <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                      <img
                        src={imageDataUrl || previews[0]}
                        alt="preview"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
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
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
                  </p>
                </div>

                {mediaMode === "video" ? (
                  <div className="glass rounded-2xl p-5 border border-white/5 space-y-3">
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" /> Vídeo pronto para envio
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A análise automática de conformidade só roda em imagens. O vídeo será revisado
                      manualmente pela equipe antes de subir no Meta.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => resetMedia("video")}>
                      Trocar vídeo
                    </Button>
                  </div>
                ) : (
                  <AiAnalysisPanel
                    scanState={scanState}
                    analysis={analysis}
                    onReset={() => resetMedia(mediaMode)}
                  />
                )}
              </div>
            )}
          </div>
        )}


        {step === 3 && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold">Copy & oferta</h2>
              <p className="text-sm text-muted-foreground">A IA refinará seu texto antes de publicar.</p>
            </div>
            {plan === "pro_max" && (
              <Button variant="glass" onClick={() => setCopyOpen(true)}>
                <Sparkles className="h-4 w-4" /> Copy Inteligente
              </Button>
            )}
            {copyOpen && (
              <CopyModal
                initialText={body}
                onClose={() => setCopyOpen(false)}
                onApply={(r) => {
                  if (r.headline) setHeadline(r.headline);
                  if (r.copy) setBody(r.copy);
                  setCopyOpen(false);
                }}
              />
            )}
            <div className="space-y-1.5">
              <Label>Título do anúncio</Label>
              <Input placeholder="Ex: 🔥 Pizza grande por R$29,90" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{headline.length} caracteres — sem limite do app (o Facebook recomenda até ~255 para exibição completa)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Texto principal</Label>
              <Textarea rows={4} placeholder="Descreva sua oferta de forma irresistível..." value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{body.length} caracteres — sem limite do app (o Facebook mostra os primeiros ~125 antes de "ver mais")</p>
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

        {step === 4 && (
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

            <div className="glass rounded-2xl p-5 space-y-4 border border-white/5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">Localização <span className="text-destructive">*</span></p>
                <span className="text-[11px] text-muted-foreground ml-auto">Obrigatório mesmo com IA</span>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                A IA precisa saber onde rodar o anúncio. Cidade, bairro e raio são sempre obrigatórios.
              </p>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-foreground/90 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Dica:</strong> se você quiser anunciar para a <strong>cidade inteira</strong>,
                  escreva o nome da cidade <strong>também no campo Bairro</strong>. Assim o robô não
                  limita o anúncio a um bairro específico e sim a toda a cidade.
                </span>
              </div>
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
                  <Input type="number" min={1} max={199} value={radius} onChange={(e) => setRadius(clampRadius(e.target.value))} />
                  <p className="text-[11px] text-muted-foreground">Máximo 199 km</p>
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

        {step === 5 && (
          <div className="space-y-5 max-w-xl">
            <div>
              <h2 className="text-xl font-semibold">Visualizações e duração</h2>
              <p className="text-sm text-muted-foreground">
                {isCredits
                  ? "Escolha a potência de alcance e por quantos dias o robô vai rodar."
                  : "Defina o investimento diário e por quantos dias o robô vai rodar."}
              </p>
            </div>

            {isCredits ? (
              <div className="glass rounded-2xl p-6 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Potência de visualizações</Label>
                  </div>
                  <Slider value={[views]} min={2500} max={200000} step={500} onValueChange={(v) => setViews(v[0])} />
                  <p className="text-center text-2xl font-bold tabular-nums text-gradient">{views.toLocaleString("pt-BR")}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Dias de veiculação</Label>
                    <span className="text-sm font-semibold tabular-nums">{days} dia{days === 1 ? "" : "s"}</span>
                  </div>
                  <Slider value={[days]} min={MIN_DAYS} max={60} step={1} onValueChange={(v) => setDays(v[0])} />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 text-center border-t border-white/5">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor do pacote</p>
                    <p className="font-semibold text-gradient text-sm">{fmtMoney(packageTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cliques estimados</p>
                    <p className="font-semibold text-sm">{estClicks.min.toLocaleString("pt-BR")} a {estClicks.max.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Créditos</p>
                    <p className="font-semibold text-sm">{days}</p>
                    <p className="text-[10px] text-muted-foreground">1 crédito = 24h</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 space-y-5">
                <div className="space-y-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Investimento por dia</p>
                    <p className="text-4xl font-bold tabular-nums mt-1">R$ <span className="text-gradient">{budget}</span></p>
                  </div>
                  <Slider value={[budget]} min={7} max={300} step={1} onValueChange={(v) => setBudget(v[0])} />
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Dias de veiculação</Label>
                    <span className="text-sm font-semibold tabular-nums">{days} dia{days === 1 ? "" : "s"}</span>
                  </div>
                  <Slider value={[days]} min={MIN_DAYS} max={60} step={1} onValueChange={(v) => setDays(v[0])} />
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-1 border-t border-white/5">
                  Total estimado: {fmtMoney(packageTotal)}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5 max-w-xl">
            <div>
              <h2 className="text-xl font-semibold">Seus anúncios</h2>
              <p className="text-sm text-muted-foreground">
                Você estará recebendo {days} anúncios, referente à quantidade de dias que o Robô irá rodar seus anúncios.
              </p>
            </div>
            <div
              className="glass rounded-2xl p-5 border space-y-2"
              style={{ borderColor: "rgba(230,180,34,0.4)", background: "rgba(230,180,34,0.06)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "#e6b422" }}>
                Novidade para os assinantes Pro Max
              </p>
              <p className="text-sm text-foreground/90">
                Se você já está no plano Pro Max e estiver com uma boa performance no anúncio, poderá
                aumentar a quantidade de visualizações pelo botão <strong>Turbinar Visualizações</strong> —
                disponível apenas para o plano Pro Max. Não é necessário agora, pode prosseguir.
              </p>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h2 className="text-xl font-semibold">
                {isCredits ? "Pacote de créditos e lançamento" : "Orçamento e lançamento"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isCredits
                  ? "Escolha quantos dias o robô vai rodar (1 crédito = 24h no ar) e a potência de visualizações. Sem honorários de gestor e sem taxas extras."
                  : "Mínimo de R$ 7/dia e 7 dias de veiculação — tempo que o robô precisa para otimizar."}
              </p>
            </div>

            {isCredits ? (
              <div className="glass rounded-2xl p-6 space-y-5">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Pacote</p>
                  <p className="text-5xl font-bold tabular-nums mt-1">
                    <span className="text-gradient">{fmtMoney(packageTotal)}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {days} crédito{days === 1 ? "" : "s"} · robô rodando por {days} dia{days === 1 ? "" : "s"}
                  </p>
                </div>


                <div className="grid grid-cols-4 gap-3 pt-4 text-center border-t border-white/5">
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground">Visualizações</p>
                    <p className="font-semibold text-gradient text-sm">
                      {views.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground">Cliques estimados</p>
                    <p className="font-semibold text-sm">
                      {estClicks.min.toLocaleString("pt-BR")} a {estClicks.max.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground">Créditos</p>
                    <p className="font-semibold">{days}</p>
                    <p className="text-[10px] text-muted-foreground">1 crédito = 24h</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground">Valor do pacote</p>
                    <p className="font-semibold">{fmtMoney(packageTotal)}</p>
                    <p className="text-[10px] text-muted-foreground">tudo incluso</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 space-y-5">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Orçamento diário</p>
                  <p className="text-5xl font-bold tabular-nums mt-1">
                    R$ <span className="text-gradient">{budget}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Mínimo: R$ 7,00 / dia</p>
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
                    <p className="text-xs text-muted-foreground">Total a ser cobrado</p>
                    <p className="font-semibold">{fmtMoney(packageTotal)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-background/30 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Orçamento Meta Ads</span>
                    <span className="tabular-nums font-medium">{fmtMoney(pricing.metaBudget)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">{pricing.feeLabel}</span>
                    <span className="tabular-nums font-medium">{fmtMoney(pricing.feesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="font-semibold">
                      {fundingType === "wallet" ? "Total a ser debitado" : "Total a ser cobrado"}
                    </span>
                    <span className="tabular-nums font-bold">{fmtMoney(packageTotal)}</span>
                  </div>
                </div>
              </div>
            )}





            {/* Item novo: horário exato de início/fim */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> Agendar horário exato (opcional)
                </p>
                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
              </div>
              <p className="text-xs text-muted-foreground">
                Sem isso, o anúncio começa assim que for aprovado e pago. Se você quer que comece
                (ou termine) num dia e horário específico, ative e preencha abaixo.
              </p>
              {scheduleEnabled && (
                <div className="grid sm:grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início</Label>
                    <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Término</Label>
                    <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                {isCredits ? (
                  <>
                    Com {days} crédito{days === 1 ? "" : "s"} o robô roda por {days} dia
                    {days === 1 ? "" : "s"} e deve gerar cerca de{" "}
                    <span className="text-foreground font-semibold">
                      {views.toLocaleString("pt-BR")}
                    </span>{" "}
                    visualizações ({estClicks.min.toLocaleString("pt-BR")} a {estClicks.max.toLocaleString("pt-BR")} cliques)
                    em {neighborhood || "sua região"}{city ? `, ${city}` : ""} (raio de {radius} km).
                  </>
                ) : (
                  <>
                    Com R$ {budget}/dia por {days} dias o anúncio deve impactar entre{" "}
                    <span className="text-foreground font-semibold">{fmtRange(reachRange(budget, days))}</span>{" "}
                    pessoas em {neighborhood || "sua região"}{city ? `, ${city}` : ""} (raio de {radius} km).
                  </>
                )}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3 flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Duração</p>
                  <p className="font-semibold">
                    {isCredits ? `${days} dias · ${days} créditos` : `${days} dias · R$ ${budget}/dia`}
                  </p>
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

            <div className="glass rounded-2xl p-5 space-y-3">
              <p className="text-sm font-medium">Como você quer pagar esta campanha?</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFundingType("wallet")}
                  className={`text-left rounded-xl p-4 border transition-all ${fundingType === "wallet" ? "border-primary/70 bg-primary/5 border-glow" : "border-white/10 hover:border-white/20"}`}
                >
                  <p className="font-semibold text-sm">Saldo do app</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Debita {fmtMoney(packageTotal)} do seu saldo pré-pago.
                    {isCredits ? " Valor do pacote, tudo incluso." : " Sobra vira crédito para a próxima campanha."}
                  </p>

                </button>
                <button
                  type="button"
                  onClick={() => setFundingType("pix_dedicated")}
                  className={`text-left rounded-xl p-4 border transition-all ${fundingType === "pix_dedicated" ? "border-primary/70 bg-primary/5 border-glow" : "border-white/10 hover:border-white/20"}`}
                >
                  <p className="font-semibold text-sm">
                    {isCredits ? "PIX do pacote" : "PIX dedicado (100% Meta Ads)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isCredits ? (
                      <>
                        PIX de {fmtMoney(packageTotal)} para liberar os {days} créditos desta
                        campanha. Não entra no saldo.
                      </>
                    ) : (
                      <>
                        PIX de {fmtMoney(packageTotal)}: {fmtMoney(pricing.metaBudget)} vão
                        <strong> direto</strong> para esta campanha. Não entra no saldo.
                      </>
                    )}
                  </p>

                </button>
              </div>
              {fundingType === "pix_dedicated" && (
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] text-warning-foreground/90 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <span>
                    <strong>Sem reembolso.</strong> O PIX dedicado é enviado 100% para
                    veiculação no Meta Ads. Se sobrar verba ao final ou a campanha for
                    encerrada antes, o valor não retorna e não vira saldo no app.
                  </span>
                </div>
              )}
            </div>

            <Button variant="neon" size="lg" className="w-full h-14 text-base" onClick={() => setStep(8)}>
              <ChevronRight /> Ativar anúncio
            </Button>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-5 max-w-xl">
            <div>
              <h2 className="text-xl font-semibold">Confirmação final</h2>
              <p className="text-sm text-muted-foreground">
                Revise tudo antes do robô colocar seu anúncio no ar.
              </p>
            </div>
            <div className="glass rounded-2xl p-5 space-y-3 text-sm">
              <Row label="Título" value={headline || "—"} />
              <Row label="Localização" value={`${neighborhood || "—"}${city ? `, ${city}` : ""} · raio ${radius} km`} />
              <Row label="Duração" value={`${days} dia${days === 1 ? "" : "s"}`} />
              <Row
                label={isCredits ? "Visualizações" : "Investimento por dia"}
                value={isCredits ? views.toLocaleString("pt-BR") : fmtMoney(budget)}
              />
              {isCredits && (
                <Row label="Créditos utilizados" value={`${days}`} />
              )}
              <Row
                label="Forma de pagamento"
                value={fundingType === "wallet" ? "Saldo do app" : "PIX"}
              />
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-gradient">{fmtMoney(packageTotal)}</span>
              </div>
            </div>
            <Button variant="neon" size="lg" className="w-full h-14 text-base animate-pulse-glow" onClick={launch} disabled={launching}>
              {launching ? <><Loader2 className="animate-spin" /> {uploadProgress ?? "Ativando robô..."}</> : <><Rocket /> {fundingType === "pix_dedicated" ? "Gerar PIX e Lançar" : "Ativar Robô e Lançar Anúncio"}</>}
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="glass" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft /> Voltar
        </Button>
        {step < 8 && (
          <Button variant="neon" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continuar <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
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
