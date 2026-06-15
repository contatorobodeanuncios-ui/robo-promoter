import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, ArrowRight, ExternalLink, Loader2, Hourglass } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EnergyOrb } from "@/components/app/EnergyOrb";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentRequest } from "@/lib/payment.functions";

const search = z.object({
  // Top-up flow
  topup: z.coerce.number().int().min(20).optional(),
  // Campaign flow
  campaignId: z.string().optional(),
  budget: z.coerce.number().min(7).optional(),
  days: z.coerce.number().min(7).optional(),
  name: z.string().optional(),
});

export const Route = createFileRoute("/_app/payment")({
  ssr: false,
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Pagamento — Robô de Lucro" },
      { name: "description", content: "Pagamento seguro via Asaas." },
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

  const [state, setState] = useState<"loading" | "ready" | "no-config" | "error">("loading");
  const [link, setLink] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!amount) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await createFn({ data: { amount } });
        if (cancelled) return;
        setRequestId(r.id);
        setLink(r.link || null);
        setState(r.configured ? "ready" : "no-config");
      } catch (e) {
        console.error(e);
        toast.error("Falha ao criar a cobrança", { description: String(e) });
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, createFn]);

  if (!amount) {
    return (
      <div className="p-10 text-center text-sm">
        Valor inválido. <Link to="/dashboard" className="text-primary">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {isCampaign ? "Pagamento da campanha" : "Adicionar saldo"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {isCampaign ? `Pagar campanha "${name ?? ""}"` : "Pagamento via Asaas"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isCampaign
            ? "Este valor é registrado como pagamento do anúncio — não entra no saldo do app."
            : "Após a confirmação do pagamento, o saldo será creditado no app."}
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <div className="glass-strong rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total a pagar</p>
            <p className="text-4xl font-bold text-gradient tabular-nums">{fmtBRL(amount)}</p>
          </div>

          {state === "loading" && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Gerando link de pagamento...
            </div>
          )}

          {state === "ready" && link && (
            <>
              <a href={link} target="_blank" rel="noreferrer noopener" className="block">
                <Button variant="neon" className="w-full">
                  Pagar agora no Asaas <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Você será redirecionado para o checkout seguro do Asaas.
              </p>
            </>
          )}

          {state === "no-config" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
                <p className="font-semibold text-warning">Link do Asaas ainda não configurado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua solicitação <span className="font-mono">{requestId?.slice(0, 8)}</span> foi registrada como{" "}
                  <strong>pendente</strong>. O administrador irá liberar manualmente assim que confirmar o pagamento.
                </p>
              </div>
              <Link to="/dashboard">
                <Button variant="glass" className="w-full">Voltar ao dashboard</Button>
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">Não foi possível gerar o pagamento. Tente novamente.</p>
              <Button variant="glass" onClick={() => nav({ to: "/dashboard" })}>Voltar</Button>
            </div>
          )}

          <div className="glass rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span>
              {isCampaign
                ? "O saldo do app só aparece após confirmação. Pagamentos de campanhas ficam registrados como 'valor pago pelo anúncio' separadamente do saldo."
                : "Cobrança segura via Asaas. O saldo só será creditado após confirmação do pagamento."}
            </span>
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6 flex flex-col items-center justify-center gap-6">
          <EnergyOrb state="analyzing" size={220} label="Aguardando pagamento" />
          <div className="text-center max-w-xs">
            <p className="text-sm font-semibold flex items-center justify-center gap-2">
              <Hourglass className="h-4 w-4" /> Pendente
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Assim que o Asaas confirmar o pagamento (ou o admin liberar manualmente), {isCampaign ? "a campanha entra no ar" : "o saldo aparece no app"}.
            </p>
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-primary mt-3">
              Ir para o dashboard <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
