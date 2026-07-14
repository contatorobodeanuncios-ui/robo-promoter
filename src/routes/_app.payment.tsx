import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
      { name: "description", content: "Pagamento via PIX." },
    ],
  }),
  component: PaymentPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PaymentPage() {
  const { topup, budget, days, name, campaignId } = useSearch({ from: "/_app/payment" });
  const nav = useNavigate();
  const amount = topup ?? (budget && days ? Math.round(budget * days) : 0);
  const isCampaign = !!campaignId;
  const createFn = useServerFn(createPaymentRequest);
  const statusFn = useServerFn(getPaymentRequestStatus);

  const [state, setState] = useState<"loading" | "ready" | "fallback" | "error" | "paid">("loading");
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ key: string; beneficiary: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!amount) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const r = await createFn({ data: { amount, campaignId: campaignId || undefined } });
        setRequestId(r.id);
        if (r.pixCode) {
          setPixCode(r.pixCode);
          setState("ready");
        } else if (r.fallbackPix) {
          setFallback(r.fallbackPix);
          setState("fallback");
        } else {
          setState("error");
        }
      } catch (e) {
        console.error(e);
        toast.error("Falha ao gerar cobrança", { description: String(e) });
        setState("error");
      }
    })();
  }, [amount, campaignId, createFn]);

  // Polling do status: quando confirmar, redireciona.
  useEffect(() => {
    if (!requestId || state === "paid" || state === "error") return;
    const t = setInterval(async () => {
      try {
        const s = await statusFn({ data: { id: requestId } });
        if (s.status === "paid") {
          setState("paid");
          toast.success("Pagamento confirmado!");
          setTimeout(() => nav({ to: "/dashboard" }), 1200);
        }
      } catch {
        /* silencia; segue tentando */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [requestId, state, statusFn, nav]);

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

  if (!amount) {
    return (
      <div className="p-10 text-center text-sm">
        Valor inválido. <Link to="/dashboard" className="text-primary">Voltar</Link>
      </div>
    );
  }

  const codeToShow = pixCode ?? fallback?.key ?? "";

  return (
    <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {isCampaign ? "Pagamento da campanha" : "Adicionar saldo"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {isCampaign ? (name ? `Pagar "${name}"` : "Pagar campanha") : "Pagamento via PIX"}
        </h1>
      </header>

      <div className="glass-strong rounded-2xl p-6 space-y-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor</p>
          <p className="text-4xl font-bold text-gradient tabular-nums">{fmtBRL(amount)}</p>
        </div>

        {state === "loading" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Gerando código PIX...
          </div>
        )}

        {state === "paid" && (
          <div className="rounded-xl border border-success/40 bg-success/10 p-5 text-center text-sm">
            <Check className="h-6 w-6 text-success mx-auto mb-2" />
            Pagamento confirmado. Redirecionando...
          </div>
        )}

        {(state === "ready" || state === "fallback") && codeToShow && (
          <div className="space-y-3">
            {state === "fallback" && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                A API automática está indisponível no momento. Use a chave PIX manual abaixo
                {fallback?.beneficiary ? ` (${fallback.beneficiary})` : ""}. Após pagar,
                o administrador libera o crédito manualmente.
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                PIX Copia e Cola
              </p>
              <div className="rounded-xl border border-primary/30 bg-background/50 p-4 font-mono text-xs break-all select-all">
                {codeToShow}
              </div>
            </div>

            <Button variant="neon" className="w-full" onClick={copyPix}>
              {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar código PIX</>}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Abra o app do seu banco → PIX → Copia e Cola → cole o código → confirme.
              Esta tela detecta o pagamento automaticamente.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">Não foi possível gerar o pagamento agora.</p>
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
