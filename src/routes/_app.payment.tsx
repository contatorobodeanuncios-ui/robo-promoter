import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, Loader2, Copy, Check, AlertTriangle, RefreshCw, CreditCard, QrCode, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentRequest, getPaymentRequestStatus } from "@/lib/payment.functions";

const search = z.object({
  topup: z.coerce.number().int().min(20).optional(),
  campaignId: z.string().optional(),
  budget: z.coerce.number().min(1).optional(),
  days: z.coerce.number().min(1).optional(),
  name: z.string().optional(),
});

export const Route = createFileRoute("/_app/payment")({
  ssr: false,
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Pagamento — Robô de Lucro" },
      { name: "description", content: "Pagamento via PIX ou cartão." },
    ],
  }),
  component: PaymentPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type BillingType = "PIX" | "CREDIT_CARD";
type Stage = "loading" | "ready" | "fallback" | "error" | "paid";

function PaymentPage() {
  const { topup, budget, days, name, campaignId } = useSearch({ from: "/_app/payment" });
  const nav = useNavigate();
  const amount = topup ?? (budget && days ? Math.round(budget * days) : 0);
  const isCampaign = !!campaignId;
  const createFn = useServerFn(createPaymentRequest);
  const statusFn = useServerFn(getPaymentRequestStatus);

  const [billing, setBilling] = useState<BillingType>("PIX");
  const [stage, setStage] = useState<Stage>("loading");
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ key: string; beneficiary: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const runCharge = useCallback(async (bt: BillingType) => {
    if (!amount) {
      setStage("error");
      setErrorMsg("Valor inválido");
      return;
    }
    const rid = ++runIdRef.current;
    setStage("loading");
    setErrorMsg(null);
    setPixCode(null);
    setInvoiceUrl(null);
    setFallback(null);
    try {
      const r = await createFn({
        data: { amount, campaignId: campaignId || undefined, billingType: bt },
      });
      if (rid !== runIdRef.current) return;
      setRequestId(r.id);
      if (bt === "PIX" && r.pixCode) {
        setPixCode(r.pixCode);
        setStage("ready");
      } else if (bt === "CREDIT_CARD" && r.invoiceUrl) {
        setInvoiceUrl(r.invoiceUrl);
        setStage("ready");
      } else if (r.fallbackPix) {
        setFallback(r.fallbackPix);
        setStage("fallback");
      } else {
        setErrorMsg(r.errorMessage ?? "Não foi possível gerar o pagamento agora.");
        setStage("error");
      }
    } catch (e) {
      if (rid !== runIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStage("error");
      toast.error("Falha ao gerar cobrança", { description: msg });
    }
  }, [amount, campaignId, createFn]);

  // Primeira execução
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runCharge("PIX");
  }, [runCharge]);

  // Polling do status: quando confirmar, redireciona.
  useEffect(() => {
    if (!requestId || stage === "paid" || stage === "error") return;
    const t = setInterval(async () => {
      try {
        const s = await statusFn({ data: { id: requestId } });
        if (s.status === "paid") {
          setStage("paid");
          toast.success("Pagamento confirmado!");
          setTimeout(() => nav({ to: "/dashboard" }), 1200);
        }
      } catch {
        /* silencia; segue tentando */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [requestId, stage, statusFn, nav]);

  const copyPix = async () => {
    const value = pixCode ?? fallback?.key ?? "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copiado! Cole no seu app do banco para pagar.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const switchTo = (bt: BillingType) => {
    if (bt === billing && stage === "ready") return;
    setBilling(bt);
    void runCharge(bt);
  };

  if (!amount) {
    return (
      <div className="p-10 text-center text-sm">
        Valor inválido. <Link to="/dashboard" className="text-primary">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {isCampaign ? "Pagamento da campanha" : "Adicionar saldo"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {isCampaign ? (name ? `Pagar "${name}"` : "Pagar campanha") : "Pagamento"}
        </h1>
      </header>

      <div className="glass-strong rounded-2xl p-6 space-y-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor</p>
          <p className="text-4xl font-bold text-gradient tabular-nums">{fmtBRL(amount)}</p>
        </div>

        {/* Seletor de forma de pagamento */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => switchTo("PIX")}
            className={`rounded-xl border px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
              billing === "PIX"
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
            }`}
          >
            <QrCode className="h-4 w-4" /> PIX
          </button>
          <button
            type="button"
            onClick={() => switchTo("CREDIT_CARD")}
            className={`rounded-xl border px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
              billing === "CREDIT_CARD"
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
            }`}
          >
            <CreditCard className="h-4 w-4" /> Cartão
          </button>
        </div>

        {stage === "loading" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            {billing === "PIX" ? "Gerando código PIX..." : "Gerando link de pagamento..."}
          </div>
        )}

        {stage === "paid" && (
          <div className="rounded-xl border border-success/40 bg-success/10 p-5 text-center text-sm">
            <Check className="h-6 w-6 text-success mx-auto mb-2" />
            Pagamento confirmado. Redirecionando...
          </div>
        )}

        {stage === "ready" && billing === "PIX" && pixCode && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                PIX Copia e Cola
              </p>
              <div className="rounded-xl border border-primary/30 bg-background/50 p-4 font-mono text-xs break-all select-all">
                {pixCode}
              </div>
            </div>
            <Button variant="neon" className="w-full" onClick={copyPix}>
              {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar código PIX</>}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Abra o app do seu banco → PIX → Copia e Cola → cole o código → confirme.
              Esta tela detecta o pagamento automaticamente.
            </p>
            <Button variant="glass" size="sm" className="w-full" onClick={() => runCharge("PIX")}>
              <RefreshCw className="h-4 w-4" /> Gerar PIX novamente
            </Button>
          </div>
        )}

        {stage === "ready" && billing === "CREDIT_CARD" && invoiceUrl && (
          <div className="space-y-3">
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="neon" className="w-full">
                <ExternalLink className="h-4 w-4" /> Abrir checkout do cartão
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground text-center">
              Preencha os dados do cartão na página segura do Asaas. Voltamos aqui automaticamente
              quando o pagamento for aprovado.
            </p>
          </div>
        )}

        {stage === "fallback" && fallback && (
          <div className="space-y-3">
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              A API automática está indisponível. Use a chave PIX manual
              {fallback.beneficiary ? ` (${fallback.beneficiary})` : ""}. Após pagar, o
              administrador libera o crédito manualmente.
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Chave PIX</p>
              <div className="rounded-xl border border-primary/30 bg-background/50 p-4 font-mono text-xs break-all select-all">
                {fallback.key}
              </div>
            </div>
            <Button variant="neon" className="w-full" onClick={copyPix}>
              <Copy className="h-4 w-4" /> Copiar chave PIX
            </Button>
            <Button variant="glass" size="sm" className="w-full" onClick={() => runCharge(billing)}>
              <RefreshCw className="h-4 w-4" /> Tentar API automática novamente
            </Button>
          </div>
        )}

        {stage === "error" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-semibold mb-1">Não foi possível gerar o pagamento.</p>
              <p className="font-mono break-all">{errorMsg ?? "Erro desconhecido"}</p>
            </div>
            <Button variant="neon" className="w-full" onClick={() => runCharge(billing)}>
              <RefreshCw className="h-4 w-4" />
              {billing === "PIX" ? "Gerar PIX novamente" : "Tentar novamente"}
            </Button>
            <Button variant="glass" className="w-full" onClick={() => nav({ to: "/dashboard" })}>
              Voltar ao dashboard
            </Button>
          </div>
        )}

        <div className="glass rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <span>
            {isCampaign
              ? "Este valor é registrado como pagamento do anúncio — não entra no saldo do app."
              : "Assim que confirmado, o saldo será creditado automaticamente."}
          </span>
        </div>

        {requestId && (
          <p className="text-[10px] text-muted-foreground text-center font-mono">
            #{requestId.slice(0, 8)}
          </p>
        )}
      </div>
    </div>
  );
}
