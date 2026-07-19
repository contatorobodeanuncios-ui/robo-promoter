import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Sparkles, Loader2, Copy, Check, AlertTriangle, RefreshCw, CreditCard, QrCode, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  createPaymentRequest,
  getPaymentRequestStatus,
  getBillingProfile,
  setBillingCpfCnpj,
} from "@/lib/payment.functions";

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
      { name: "description", content: "Pagamento via PIX ou cartão dentro do app." },
    ],
  }),
  component: PaymentPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type BillingType = "PIX" | "CREDIT_CARD";
type Stage = "loading" | "needsCpf" | "needsCard" | "ready" | "fallback" | "error" | "paid";

function formatCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCpfCnpj(digitsOnly: string): string {
  if (!digitsOnly) return "";
  if (digitsOnly.length === 11) return `${digitsOnly.slice(0, 3)}.•••.•••-${digitsOnly.slice(-2)}`;
  if (digitsOnly.length === 14) return `${digitsOnly.slice(0, 2)}.•••.•••/••••-${digitsOnly.slice(-2)}`;
  return "••••••";
}

function PaymentPage() {
  const { topup, budget, days, name, campaignId } = useSearch({ from: "/_app/payment" });
  const nav = useNavigate();
  const amount = topup ?? (budget && days ? Math.round(budget * days) : 0);
  const isCampaign = !!campaignId;

  const createFn = useServerFn(createPaymentRequest);
  const statusFn = useServerFn(getPaymentRequestStatus);
  const profileFn = useServerFn(getBillingProfile);
  const saveCpfFn = useServerFn(setBillingCpfCnpj);

  const profileQ = useQuery({
    queryKey: ["billing-profile"],
    queryFn: () => profileFn(),
    staleTime: 30_000,
  });

  const [billing, setBilling] = useState<BillingType>("PIX");
  const [stage, setStage] = useState<Stage>("loading");
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ key: string; beneficiary: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cpfRetry, setCpfRetry] = useState(false);
  const runIdRef = useRef(0);

  const runCharge = useCallback(async (bt: BillingType, card?: {
    holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string;
    postalCode: string; addressNumber: string;
  }) => {
    if (!amount) { setStage("error"); setErrorMsg("Valor inválido"); return; }
    const rid = ++runIdRef.current;
    setStage("loading");
    setErrorMsg(null);
    setPixCode(null);
    setFallback(null);
    try {
      const r = await createFn({
        data: { amount, campaignId: campaignId || undefined, billingType: bt, card },
      });
      if (rid !== runIdRef.current) return;
      if (r.needsCpf) { setStage("needsCpf"); return; }
      if (r.id) setRequestId(r.id);
      if (r.needsCard) { setStage("needsCard"); return; }
      if (r.cardCharged) { setStage("paid"); toast.success("Pagamento aprovado!"); setTimeout(() => nav({ to: "/dashboard" }), 1200); return; }
      if (bt === "PIX" && r.pixCode) { setPixCode(r.pixCode); setStage("ready"); return; }
      if (r.fallbackPix) { setFallback(r.fallbackPix); setStage("fallback"); return; }
      setErrorMsg(r.errorMessage ?? "Não foi possível gerar o pagamento agora.");
      setStage("error");
    } catch (e) {
      if (rid !== runIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStage("error");
      toast.error("Falha ao gerar cobrança", { description: msg });
    }
  }, [amount, campaignId, createFn, nav]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (profileQ.isLoading) return;
    startedRef.current = true;
    if (!profileQ.data?.cpf_cnpj) { setStage("needsCpf"); return; }
    void runCharge("PIX");
  }, [profileQ.isLoading, profileQ.data, runCharge]);

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
      } catch { /* silencia */ }
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
    } catch { toast.error("Não foi possível copiar automaticamente."); }
  };

  const switchTo = (bt: BillingType) => {
    if (bt === billing && (stage === "ready" || stage === "needsCard")) return;
    setBilling(bt);
    if (bt === "CREDIT_CARD") setStage("needsCard");
    else void runCharge("PIX");
  };

  const openCpfEdit = (retry: boolean) => {
    setCpfRetry(retry);
    setStage("needsCpf");
  };

  if (!amount) {
    return (
      <div className="p-10 text-center text-sm">
        Valor inválido. <Link to="/dashboard" className="text-primary">Voltar</Link>
      </div>
    );
  }

  const cpfDigits = (profileQ.data?.cpf_cnpj ?? "").replace(/\D/g, "");

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

        {cpfDigits && stage !== "needsCpf" && (
          <button
            type="button"
            onClick={() => openCpfEdit(true)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground rounded-lg border border-white/10 px-3 py-2 hover:border-white/20 transition"
          >
            <span>CPF/CNPJ cadastrado: <span className="font-mono">{maskCpfCnpj(cpfDigits)}</span></span>
            <span className="flex items-center gap-1 text-primary"><Pencil className="h-3 w-3" /> Trocar</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => switchTo("PIX")}
            className={`rounded-xl border px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
              billing === "PIX" ? "border-primary/60 bg-primary/10 text-primary"
                : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
            }`}><QrCode className="h-4 w-4" /> PIX</button>
          <button type="button" onClick={() => switchTo("CREDIT_CARD")}
            className={`rounded-xl border px-3 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
              billing === "CREDIT_CARD" ? "border-primary/60 bg-primary/10 text-primary"
                : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
            }`}><CreditCard className="h-4 w-4" /> Cartão</button>
        </div>

        {stage === "needsCpf" && (
          <CpfForm
            initial={profileQ.data?.cpf_cnpj ?? ""}
            initialName={profileQ.data?.display_name ?? ""}
            initialPhone={profileQ.data?.phone ?? ""}
            isRetry={cpfRetry}
            onCancel={cpfRetry ? () => setStage(errorMsg ? "error" : "ready") : undefined}
            onSubmit={async (v) => {
              try {
                await saveCpfFn({ data: { ...v, reset_asaas_customer: cpfRetry } });
                await profileQ.refetch();
                toast.success(cpfRetry ? "CPF/CNPJ atualizado" : "Dados salvos");
                setCpfRetry(false);
                void runCharge(billing);
              } catch (e) {
                toast.error("Falha ao salvar", { description: e instanceof Error ? e.message : String(e) });
              }
            }}
          />
        )}

        {stage === "loading" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            {billing === "PIX" ? "Gerando código PIX..." : "Processando pagamento..."}
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
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">PIX Copia e Cola</p>
              <div className="rounded-xl border border-primary/30 bg-background/50 p-4 font-mono text-xs break-all select-all">{pixCode}</div>
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

        {stage === "needsCard" && (
          <CardForm
            onSubmit={(card) => runCharge("CREDIT_CARD", card)}
          />
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
              <div className="rounded-xl border border-primary/30 bg-background/50 p-4 font-mono text-xs break-all select-all">{fallback.key}</div>
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
            <Button variant="glass" className="w-full" onClick={() => openCpfEdit(true)}>
              <Pencil className="h-4 w-4" /> Trocar CPF/CNPJ e tentar de novo
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
          <p className="text-[10px] text-muted-foreground text-center font-mono">#{requestId.slice(0, 8)}</p>
        )}
      </div>
    </div>
  );
}

function CpfForm({
  initial, initialName, initialPhone, isRetry, onCancel, onSubmit,
}: {
  initial: string;
  initialName: string;
  initialPhone: string;
  isRetry?: boolean;
  onCancel?: () => void;
  onSubmit: (v: { cpf_cnpj: string; display_name?: string; phone?: string }) => Promise<void>;
}) {
  const [cpf, setCpf] = useState(initial && !isRetry ? formatCpfCnpj(initial) : "");
  const [name, setName] = useState(initialName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);

  const digitsOnly = cpf.replace(/\D/g, "");
  const valid = digitsOnly.length === 11 || digitsOnly.length === 14;

  const submit = async () => {
    if (!valid) { toast.error("Informe um CPF (11) ou CNPJ (14) válido"); return; }
    if (!name.trim()) { toast.error("Informe seu nome completo"); return; }
    setSaving(true);
    try {
      await onSubmit({ cpf_cnpj: digitsOnly, display_name: name.trim(), phone: phone.trim() || undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
        <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
        {isRetry
          ? "Corrija o CPF/CNPJ abaixo — vamos tentar gerar o pagamento de novo com o documento certo."
          : "O Asaas exige CPF ou CNPJ do pagador para emitir a cobrança. Preencha uma vez — usamos nas próximas cobranças automaticamente."}
      </div>
      <div>
        <Label className="text-xs">Nome completo</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como está no documento" />
      </div>
      <div>
        <Label className="text-xs">CPF ou CNPJ</Label>
        <Input value={cpf} onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
      </div>
      <div>
        <Label className="text-xs">Celular (opcional)</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
      </div>
      <Button variant="neon" className="w-full" disabled={!valid || saving} onClick={submit}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e continuar"}
      </Button>
      {onCancel && (
        <Button variant="glass" className="w-full" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      )}
    </div>
  );
}

function CardForm({
  onSubmit,
}: {
  onSubmit: (card: {
    holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string;
    postalCode: string; addressNumber: string;
  }) => void;
}) {
  const [holderName, setHolderName] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [ccv, setCcv] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");

  const numberDigits = number.replace(/\D/g, "");
  const [mm, yy] = exp.split("/");
  const valid =
    holderName.trim().length >= 2 &&
    numberDigits.length >= 12 &&
    !!mm && mm.length === 2 && Number(mm) >= 1 && Number(mm) <= 12 &&
    !!yy && (yy.length === 2 || yy.length === 4) &&
    ccv.length >= 3 && ccv.length <= 4 &&
    cep.replace(/\D/g, "").length === 8 &&
    addressNumber.trim().length > 0;

  const submit = () => {
    if (!valid) { toast.error("Preencha os dados do cartão corretamente"); return; }
    onSubmit({
      holderName: holderName.trim(),
      number: numberDigits,
      expiryMonth: mm,
      expiryYear: yy,
      ccv,
      postalCode: cep.replace(/\D/g, ""),
      addressNumber: addressNumber.trim(),
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 inline mr-1 text-success" />
        Pagamento processado dentro do app. Você não sai desta tela.
      </div>
      <div>
        <Label className="text-xs">Nome impresso no cartão</Label>
        <Input value={holderName} onChange={(e) => setHolderName(e.target.value.toUpperCase())} placeholder="JOAO DA SILVA" />
      </div>
      <div>
        <Label className="text-xs">Número do cartão</Label>
        <Input
          value={number.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim()}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          maxLength={23}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Validade (MM/AA)</Label>
          <Input
            value={exp}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExp(d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`);
            }}
            placeholder="12/28"
            inputMode="numeric"
            maxLength={5}
          />
        </div>
        <div>
          <Label className="text-xs">CCV</Label>
          <Input value={ccv} onChange={(e) => setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">CEP</Label>
          <Input
            value={cep.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2")}
            onChange={(e) => setCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
          />
        </div>
        <div>
          <Label className="text-xs">Número do endereço</Label>
          <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="123" />
        </div>
      </div>
      <Button variant="neon" className="w-full" disabled={!valid} onClick={submit}>
        <CreditCard className="h-4 w-4" /> Pagar com cartão
      </Button>
    </div>
  );
}
