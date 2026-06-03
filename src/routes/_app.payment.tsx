import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Check, ShieldCheck, Sparkles, ArrowRight, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EnergyOrb } from "@/components/app/EnergyOrb";
import { useAppStore } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { submitCampaignToMeta } from "@/lib/admin.functions";

const search = z.object({
  campaignId: z.string().optional(),
  budget: z.coerce.number().min(7).default(15),
  days: z.coerce.number().min(7).default(7),
  name: z.string().optional(),
});

export const Route = createFileRoute("/_app/payment")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Pagamento PIX — Robô de Lucro" },
      { name: "description", content: "Pague via PIX para o robô iniciar sua campanha." },
    ],
  }),
  component: PaymentPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PaymentPage() {
  const { budget, days, name, campaignId } = useSearch({ from: "/_app/payment" });
  const total = budget * days;
  const topup = useAppStore((s) => s.topup);
  const nav = useNavigate();

  // Placeholder PIX copy-paste payload (real one virá do Asaas)
  const pixCode = useMemo(
    () =>
      `00020126580014BR.GOV.BCB.PIX0136robo-de-lucro-${Math.random()
        .toString(36)
        .slice(2, 10)}5204000053039865802BR5912ROBO DE LUCRO ROBOT6009SAO PAULO62070503***6304`,
    [],
  );

  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [seconds, setSeconds] = useState(15 * 60);

  useEffect(() => {
    if (paid) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [paid]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const copy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("Código PIX copiado");
    setTimeout(() => setCopied(false), 2200);
  };

  const submitFn = useServerFn(submitCampaignToMeta);

  const simulatePaid = async () => {
    setPaid(true);
    topup(total);
    let result: { status: "running" | "analyzing"; mode: string; fallback?: boolean } | null = null;
    if (campaignId) {
      try {
        result = await submitFn({ data: { campaignId } });
      } catch (e) {
        console.error(e);
      }
    }
    if (!result || result.status === "analyzing") {
      toast.success("Pagamento confirmado", {
        description:
          result?.fallback
            ? "O robô está preparando os motores (fallback automático para análise)."
            : "O robô está preparando os motores. Sua campanha entrou em análise.",
      });
    } else {
      toast.success("Anúncio no ar! 🚀", { description: "Enviado para a Meta com sucesso." });
    }
    setTimeout(() => nav({ to: "/dashboard" }), 1500);
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Última etapa
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Pague via PIX para ativar o robô</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {name ? <>Campanha <span className="text-foreground">"{name}"</span> · </> : null}
          {days} dias × {fmtBRL(budget)}/dia
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        {/* QR + código */}
        <div className="glass-strong rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total a pagar</p>
              <p className="text-4xl font-bold text-gradient tabular-nums">{fmtBRL(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" /> Expira em
              </p>
              <p className="font-mono text-lg tabular-nums">{mm}:{ss}</p>
            </div>
          </div>

          <div className="grid place-items-center p-5 rounded-2xl bg-white">
            {/* Mock QR (visual). Substituído pelo QR real do Asaas após integração */}
            <div className="grid grid-cols-21 gap-[2px]" style={{ gridTemplateColumns: "repeat(21, 1fr)", width: 220, height: 220 }}>
              {Array.from({ length: 21 * 21 }).map((_, i) => {
                const row = Math.floor(i / 21);
                const col = i % 21;
                const corner =
                  (row < 7 && col < 7) ||
                  (row < 7 && col > 13) ||
                  (row > 13 && col < 7);
                const on = corner
                  ? (row === 0 || row === 6 || col === 0 || col === 6 ||
                     (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
                     (row === 0 || row === 6 ? false : false))
                  : ((i * 31 + row * 7 + col * 13) % 3 === 0);
                return <div key={i} style={{ background: on ? "#0F172A" : "transparent" }} />;
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <QrCode className="h-3 w-3" /> Ou copie o código PIX abaixo
            </p>
            <div className="flex gap-2">
              <code className="flex-1 glass rounded-lg px-3 py-2 text-[11px] truncate font-mono">{pixCode}</code>
              <Button variant="glass" size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          <div className="glass rounded-xl p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span>
              Pagamento processado de forma segura via Asaas. Assim que o PIX for confirmado, o robô lança a campanha automaticamente.
            </span>
          </div>

          {!paid ? (
            <Button variant="neon" className="w-full" onClick={simulatePaid}>
              Já paguei — confirmar
            </Button>
          ) : (
            <Link to="/dashboard" className="block">
              <Button variant="neon" className="w-full">
                Ir para o Dashboard <ArrowRight />
              </Button>
            </Link>
          )}
        </div>

        {/* Status do robô */}
        <div className="glass-strong rounded-2xl p-6 flex flex-col items-center justify-center gap-6">
          <EnergyOrb
            state={paid ? "ok" : "analyzing"}
            size={240}
            label={paid ? "Campanha ativada" : "Aguardando pagamento"}
          />
          <div className="text-center max-w-xs">
            <p className="text-sm font-semibold">
              {paid ? "Tudo pronto! 🚀" : "O robô está pronto para decolar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paid
                ? "Sua campanha entrará no ar nos próximos minutos. Acompanhe pelo dashboard."
                : "Após a confirmação do PIX o robô envia o anúncio para o Facebook Ads e começa a otimização."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}