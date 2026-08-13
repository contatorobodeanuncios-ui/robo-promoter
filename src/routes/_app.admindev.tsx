import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  adminListCampaigns,
  adminSetCampaignStatus,
  adminSetMetaCampaignId,
  getCampaignMode,
  setCampaignMode,
  checkIsAdmin,
  adminListWipeEvents,
  getMetaMetricsHealth,
  adminExportCampaignsCSV,
  adminSetUserPlan,
  adminListAccessRequests,
  getAutoApproveAccess,
  setAutoApproveAccess,
  adminApproveAccessRequest,
  adminDenyAccessRequest,
  adminListAllClients,
  adminArchiveCampaign,
  adminSetUserStatus,
  adminAdjustBalance,
  adminUpdateProfile,
  adminUpdateCampaignMetrics,
  adminListPixAttempts,
  adminListMetaAdAccountCampaigns,
  adminGenerateAccessLink,
  adminListMetaLinkAudit,
  adminListAIReviews,
  adminGetCampaignMediaUrls,
  type AdminCampaignRow,
  type AdminClientRow,
  type PixAttemptRow,
  type MetaAdAccountCampaign,
  type MetaLinkAuditRow,
  type AIReviewRow,
} from "@/lib/admin.functions";
import { aiReviewCampaign } from "@/lib/ai-metrics.functions";

import {
  getPaymentSettings,
  setAsaasConfig,
  setManualPixConfig,
  setPaymentConfirmMode,
  adminListPayments,
  adminApprovePayment,
  adminRejectPayment,
} from "@/lib/payment.functions";
import { adminListConversations } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Zap, Hand, Eye, X, Rocket, Loader2, Link2, Check, Ban, CreditCard, AlertTriangle, Trash2, PowerOff, UserPlus, Copy, Settings, Users, Megaphone, Wallet, Pencil, UserCheck, KeyRound, Sparkles, History, ThumbsUp, ThumbsDown, HelpCircle, RefreshCw, Download, Clock, Archive, ArchiveRestore, Search, Crown, Timer } from "lucide-react";

export const Route = createFileRoute("/_app/admindev")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Admin Dev — Robô de Lucro" }] }),
  component: AdminDevPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ============ Item 13: mensagens de erro mais didáticas ============
// Mapeia trechos comuns de erro do Meta/Asaas para uma causa provável e uma
// ação recomendada, em vez de só mostrar a string crua da API.
function explainError(msg: string | null | undefined): { cause: string; action: string } | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (m.includes("190") || m.includes("invalid oauth") || m.includes("access token")) {
    return {
      cause: "O token de acesso do Meta expirou ou foi revogado.",
      action: "Gere um novo token de sistema no Business Manager e atualize o secret META_ACCESS_TOKEN.",
    };
  }
  if (m.includes("meta_ad_account_id") || m.includes("ad_account_id")) {
    return {
      cause: "A conta de anúncios não está configurada corretamente no servidor.",
      action: "Confira o secret META_AD_ACCOUNT_ID (só números, separado por vírgula se houver mais de uma conta).",
    };
  }
  if (m.includes("permiss") || m.includes("(#200)") || m.includes("(#10)")) {
    return {
      cause: "O token do Meta não tem permissão suficiente para essa ação (ex: falta ads_read ou ads_management).",
      action: "No Business Manager, gere o token de sistema novamente marcando as permissões corretas.",
    };
  }
  if (m.includes("cpfcnpj") || m.includes("cpf") || m.includes("cnpj")) {
    return {
      cause: "O CPF/CNPJ do cliente foi rejeitado pelo Asaas (inválido ou não corresponde ao titular).",
      action: "Peça para o cliente usar o botão \"Trocar CPF/CNPJ\" na tela de pagamento e reenviar.",
    };
  }
  if (m.includes("user_agent") || m.includes("user-agent")) {
    return {
      cause: "A chamada para o Asaas não enviou o cabeçalho User-Agent exigido por eles.",
      action: "Isso já deveria estar corrigido no código — se voltar a acontecer, avise que o header sumiu de novo.",
    };
  }
  if (m.includes("asaas_api_key") || m.includes("api_key não configurada")) {
    return {
      cause: "A chave da API do Asaas não está configurada no servidor.",
      action: "Cadastre o secret ASAAS_API_KEY no Lovable Cloud → Secrets.",
    };
  }
  if (m.includes("customer") && (m.includes("obrigat") || m.includes("required"))) {
    return {
      cause: "Faltou algum dado obrigatório do cliente (nome, e-mail ou CPF/CNPJ) ao criar o cadastro no Asaas.",
      action: "Confirme se o perfil do cliente tem nome, e-mail e CPF/CNPJ preenchidos.",
    };
  }
  if (m.includes("id do meta inválido") || m.includes("meta inválido")) {
    return {
      cause: "O ID de campanha colado não tem o formato esperado (só números).",
      action: "Use o botão \"Buscar no Meta\" em vez de colar o ID manualmente, para evitar erro de digitação.",
    };
  }
  if (m.includes("insights") && m.includes("400")) {
    return {
      cause: "O ID da campanha vinculado não existe (mais) na conta de anúncios, ou foi digitado errado.",
      action: "Revise o vínculo dessa campanha usando o botão \"Buscar no Meta\".",
    };
  }
  return null;
}

function ErrorHint({ message }: { message: string | null | undefined }) {
  const hint = explainError(message);
  if (!hint) return null;
  return (
    <div className="mt-1.5 rounded-md bg-background/50 border border-white/10 p-2 text-[10px] space-y-1">
      <p><span className="text-muted-foreground">Causa provável:</span> {hint.cause}</p>
      <p><span className="text-muted-foreground">Ação recomendada:</span> {hint.action}</p>
    </div>
  );
}

// ============ Relógio: há quanto tempo o acesso foi liberado ============
// Conta a partir do momento em que o admin aprovou (reviewed_at). Atualiza
// sozinho a cada minuto, mostrando ex.: "22 h 52 min".
function formatElapsed(fromIso: string, nowMs: number) {
  const diff = Math.max(0, nowMs - new Date(fromIso).getTime());
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days} d ${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function AccessElapsedClock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary tabular-nums"
      title={`Acesso liberado em ${new Date(since).toLocaleString("pt-BR")}`}
    >
      <Clock className="h-3 w-3" /> com acesso há {formatElapsed(since, now)}
    </span>
  );
}

// ============ Bolinha de notificação nas abas ============
const seenStorageKey = (tab: string) => `admindev-seen-${tab}`;

function readSeen(tab: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(seenStorageKey(tab)) ?? "";
}

function NotifyDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1 h-2 w-2 rounded-full bg-destructive shadow-[0_0_6px_var(--color-destructive)] inline-block" />
  );
}



// ============ Busca global do admin ============
const AdminSearchContext = createContext("");
const useAdminSearch = () => useContext(AdminSearchContext);

/** Casa o termo digitado com qualquer campo relevante (nome, id, e-mail, telefone, valor). */
function matchesSearch(term: string, fields: Array<string | number | null | undefined>): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return fields.some((f) => {
    if (f === null || f === undefined) return false;
    const raw = String(f).toLowerCase();
    if (raw.includes(q)) return true;
    if (digits.length >= 3) {
      const fd = raw.replace(/\D/g, "");
      if (fd && fd.includes(digits)) return true;
    }
    return false;
  });
}

function AdminDevPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const checkAdminFn = useServerFn(checkIsAdmin);
  const getMode = useServerFn(getCampaignMode);
  const setMode = useServerFn(setCampaignMode);
  const listFn = useServerFn(adminListCampaigns);
  const setStatusFn = useServerFn(adminSetCampaignStatus);
  const getPaySettings = useServerFn(getPaymentSettings);
  const setAsaasFn = useServerFn(setAsaasConfig);
  const setManualPixFn = useServerFn(setManualPixConfig);
  const setConfirmFn = useServerFn(setPaymentConfirmMode);
  const listPaymentsFn = useServerFn(adminListPayments);
  const approvePayFn = useServerFn(adminApprovePayment);
  const rejectPayFn = useServerFn(adminRejectPayment);
  const listWipesFn = useServerFn(adminListWipeEvents);
  const listClientsFn = useServerFn(adminListAllClients);
  const listAccessFn = useServerFn(adminListAccessRequests);
  const listAIFn = useServerFn(adminListAIReviews);
  const listMetaAuditFn = useServerFn(adminListMetaLinkAudit);

  const adminQuery = useQuery({
    queryKey: ["admindev-access"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return { isAdmin: false };
      try {
        return await checkAdminFn();
      } catch {
        return { isAdmin: false };
      }
    },
    retry: false,
  });
  const enabled = adminQuery.data?.isAdmin === true;

  const modeQuery = useQuery({
    queryKey: ["campaign-mode"],
    queryFn: () => getMode(),
    enabled,
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listFn(),
    retry: false,
    enabled,
  });
  const paySettingsQuery = useQuery({
    queryKey: ["pay-settings"],
    queryFn: () => getPaySettings(),
    enabled,
  });
  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => listPaymentsFn(),
    enabled,
    refetchInterval: 15_000,
  });
  const wipesQuery = useQuery({
    queryKey: ["admin-wipes"],
    queryFn: () => listWipesFn(),
    enabled,
    refetchInterval: 30_000,
  });
  const clientsQuery = useQuery({
    queryKey: ["admin-all-clients"],
    queryFn: () => listClientsFn(),
    enabled,
  });

  // Queries compartilhadas (mesma queryKey das seções) só para saber se
  // chegou coisa nova em cada aba e acender a bolinha de notificação.
  const accessDotQuery = useQuery({
    queryKey: ["admin-access-requests"],
    queryFn: () => listAccessFn(),
    enabled,
    refetchInterval: 30_000,
  });
  const aiDotQuery = useQuery({
    queryKey: ["admin-ai-reviews"],
    queryFn: () => listAIFn(),
    enabled,
    refetchInterval: 60_000,
  });
  const metaAuditDotQuery = useQuery({
    queryKey: ["admin-meta-audit"],
    queryFn: () => listMetaAuditFn(),
    enabled,
    refetchInterval: 60_000,
  });

  const maxDate = (list: Array<{ created_at: string }> | undefined) =>
    (list ?? []).reduce<string>((acc, r) => (r.created_at > acc ? r.created_at : acc), "");

  const latestByTab: Record<string, string> = {
    access: maxDate(accessDotQuery.data),
    payments: maxDate(paymentsQuery.data),
    settings: maxDate(wipesQuery.data as Array<{ created_at: string }> | undefined),
    campaigns: maxDate(campaignsQuery.data),
    clients: maxDate(clientsQuery.data),
    ai: maxDate(aiDotQuery.data),
    metaaudit: maxDate(metaAuditDotQuery.data),
  };

  const [tab, setTab] = useState("access");
  const [search, setSearch] = useState("");
  const [seen, setSeen] = useState<Record<string, string>>({});
  useEffect(() => {
    setSeen(
      Object.fromEntries(
        ["access", "payments", "settings", "campaigns", "clients", "ai", "metaaudit"].map((t) => [
          t,
          readSeen(t),
        ]),
      ),
    );
  }, []);

  // A aba aberta é marcada como vista assim que os dados dela chegam.
  const currentLatest = latestByTab[tab] ?? "";
  useEffect(() => {
    if (!currentLatest) return;
    setSeen((prev) => {
      if ((prev[tab] ?? "") >= currentLatest) return prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(seenStorageKey(tab), currentLatest);
      }
      return { ...prev, [tab]: currentLatest };
    });
  }, [tab, currentLatest]);

  const hasNew = (t: string) => {
    const latest = latestByTab[t] ?? "";
    return !!latest && latest > (seen[t] ?? "");
  };

  // ---- Arquivamento de campanhas (apagados / aguardando pagamento) ----
  const archiveFn = useServerFn(adminArchiveCampaign);
  const [campaignView, setCampaignView] = useState<"active" | "awaiting_payment" | "deleted">("active");
  const archiveMutation = useMutation({
    mutationFn: (v: { id: string; reason: "deleted" | "awaiting_payment" | null }) =>
      archiveFn({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success(v.reason ? "Campanha arquivada" : "Campanha restaurada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allCampaigns = campaignsQuery.data ?? [];
  const counts = {
    active: allCampaigns.filter((c) => !c.archived_reason).length,
    awaiting_payment: allCampaigns.filter((c) => c.archived_reason === "awaiting_payment").length,
    deleted: allCampaigns.filter((c) => c.archived_reason === "deleted").length,
  };
  const visibleCampaigns = allCampaigns
    .filter((c) => (campaignView === "active" ? !c.archived_reason : c.archived_reason === campaignView))
    .filter((c) =>
      matchesSearch(search, [
        c.client_name,
        c.client_email,
        c.user_id,
        c.id,
        c.name,
        c.budget,
        c.total_paid,
        c.meta_campaign_id,
      ]),
    );


  const [preview, setPreview] = useState<AdminCampaignRow | null>(null);
  const [metricsTarget, setMetricsTarget] = useState<AdminCampaignRow | null>(null);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [manualPixKey, setManualPixKey] = useState("");
  const [manualPixBeneficiary, setManualPixBeneficiary] = useState("");
  const [manualPixEnabled, setManualPixEnabled] = useState(false);

  useEffect(() => {
    if (paySettingsQuery.data) {
      setApiKeySet(!!paySettingsQuery.data.asaas.api_key_set);
      setManualPixKey(paySettingsQuery.data.manualPix?.key || "");
      setManualPixBeneficiary(paySettingsQuery.data.manualPix?.beneficiary || "");
      setManualPixEnabled(!!paySettingsQuery.data.manualPix?.enabled);
    }
  }, [paySettingsQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (mode: "manual" | "automatic") => setMode({ data: { mode } }),
    onSuccess: (r) => {
      qc.setQueryData(["campaign-mode"], r);
      toast.success(
        r.mode === "automatic" ? "Modo AUTOMÁTICO ativado" : "Modo MANUAL ativado",
      );
    },
    onError: (e) => toast.error("Falha ao alternar modo", { description: String(e) }),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: "running" | "analyzing" | "paused" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Status atualizado");
    },
  });

  const saveAsaas = useMutation({
    mutationFn: () => setAsaasFn({ data: { api_key_set: apiKeySet } }),
    onSuccess: () => {
      toast.success("Configuração do Asaas salva");
      qc.invalidateQueries({ queryKey: ["pay-settings"] });
    },
    onError: (e) => toast.error("Falha ao salvar Asaas", { description: String(e) }),
  });

  const saveManualPix = useMutation({
    mutationFn: () =>
      setManualPixFn({
        data: {
          key: manualPixKey.trim(),
          beneficiary: manualPixBeneficiary.trim(),
          enabled: manualPixEnabled,
        },
      }),
    onSuccess: () => {
      toast.success("Chave PIX manual salva");
      qc.invalidateQueries({ queryKey: ["pay-settings"] });
    },
    onError: (e) => toast.error("Falha ao salvar chave PIX", { description: String(e) }),
  });


  const toggleConfirmMode = useMutation({
    mutationFn: (mode: "manual" | "webhook") => setConfirmFn({ data: { mode } }),
    onSuccess: (r) => {
      qc.setQueryData(["pay-settings"], (prev: ReturnType<typeof getPaymentSettings> extends Promise<infer T> ? T : never) =>
        prev ? { ...prev, confirm: r.mode } : prev,
      );
      qc.invalidateQueries({ queryKey: ["pay-settings"] });
      toast.success(r.mode === "webhook" ? "Confirmação por WEBHOOK ativada" : "Confirmação MANUAL ativada");
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approvePayFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      toast.success("Pagamento aprovado e saldo/orçamento creditado");
    },
    onError: (e) => toast.error("Falha", { description: String(e) }),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectPayFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      toast.info("Pagamento recusado");
    },
  });

  const isAuto = modeQuery.data?.mode === "automatic";
  const confirmMode = paySettingsQuery.data?.confirm ?? "manual";

  if (adminQuery.isLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (adminQuery.error || !adminQuery.data?.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full border border-warning/30 bg-warning/10 grid place-items-center">
          <Shield className="h-6 w-6 text-warning" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta atual não possui permissão de administrador para abrir esta área.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
          Voltar ao dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" /> Painel da Agência
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dev</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link to="/admin-exec" className="text-xs px-3 py-2 rounded-lg glass hover:bg-white/5">📊 Dashboard Executivo</Link>
          <Link to="/admin-support" className="text-xs px-3 py-2 rounded-lg glass hover:bg-white/5 relative">
            💬 Suporte
            <SupportUnreadBadge />
          </Link>
          <Link to="/admin-audit" className="text-xs px-3 py-2 rounded-lg glass hover:bg-white/5">📜 Auditoria</Link>
        </nav>
      </header>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, ID, telefone, e-mail ou valor..."
          className="w-full rounded-xl bg-white/[0.03] border border-white/10 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
      </div>

      <AdminSearchContext.Provider value={search}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start">
          <TabsTrigger value="access" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Solicitações de Acesso
            <NotifyDot show={hasNew("access")} />
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Solicitações de Pagamento
            <NotifyDot show={hasNew("payments")} />
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configurações Internas
            <NotifyDot show={hasNew("settings")} />
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Campanhas dos Clientes
            <NotifyDot show={hasNew("campaigns")} />
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Todos os Clientes
            <NotifyDot show={hasNew("clients")} />
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> IA de Métricas
            <NotifyDot show={hasNew("ai")} />
          </TabsTrigger>
          <TabsTrigger value="metaaudit" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Auditoria Meta
            <NotifyDot show={hasNew("metaaudit")} />
          </TabsTrigger>
        </TabsList>


        {/* ============ Aba: Solicitações de Acesso ============ */}
        <TabsContent value="access" className="space-y-6 mt-6">
          <AccessRequestsSection />
        </TabsContent>

        {/* ============ Aba: Solicitações de Pagamento ============ */}
        <TabsContent value="payments" className="space-y-6 mt-6">
          <section className="glass-strong rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold">Solicitações de pagamento</h2>
              <span className="text-xs text-muted-foreground">
                {paymentsQuery.data?.filter((p) => p.status === "pending").length ?? 0} aguardando
              </span>
            </div>
            {!paymentsQuery.data?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Destino</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Link Asaas</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsQuery.data
                      .filter((p) =>
                        matchesSearch(search, [
                          p.client_name,
                          p.client_email,
                          p.client_phone,
                          p.user_id,
                          p.id,
                          p.amount,
                          p.amount.toFixed(2).replace(".", ","),
                        ]),
                      )
                      .map((p) => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.client_name ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{p.user_id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${
                              p.type === "balance_topup"
                                ? "border-sky-400/40 text-sky-300 bg-sky-400/10"
                                : "border-primary/40 text-primary bg-primary/10"
                            }`}
                          >
                            {p.type === "balance_topup" ? "Saldo no App" : "Campanha"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtBRL(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-1 rounded-full border ${
                            p.status === "paid" ? "border-success/40 text-success bg-success/10" :
                            p.status === "rejected" ? "border-destructive/40 text-destructive bg-destructive/10" :
                            p.status === "approved" ? "border-primary/40 text-primary bg-primary/10" :
                            "border-warning/40 text-warning bg-warning/10"
                          }`}>
                            {p.status === "pending" ? "Aguardando" : p.status === "paid" ? "Pago" : p.status === "rejected" ? "Recusado" : "Aprovado"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.asaas_link ? (
                            <a href={p.asaas_link} target="_blank" rel="noreferrer" className="text-[11px] text-primary truncate inline-block max-w-[220px]">
                              {p.asaas_link}
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">sem link</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="neon"
                                size="sm"
                                onClick={() => approveMut.mutate(p.id)}
                                disabled={approveMut.isPending}
                              >
                                <Check className="h-3.5 w-3.5" /> Aprovar
                              </Button>
                              <Button
                                variant="glass"
                                size="sm"
                                onClick={() => rejectMut.mutate(p.id)}
                                disabled={rejectMut.isPending}
                              >
                                <Ban className="h-3.5 w-3.5" /> Recusar
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        {/* ============ Aba: Configurações Internas ============ */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <MetaHealthCard />
          <PixAttemptsSection />
          <ExportCsvButton />

          {/* Mode toggle */}
          <section
            className={`glass-strong rounded-2xl p-6 border transition-all ${
              isAuto ? "border-success/40 shadow-[0_0_40px_-10px_var(--color-success)]" : "border-warning/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Modo de Criação na BM</p>
                <p className="text-lg font-semibold mt-1">
                  Como as campanhas dos clientes são publicadas
                </p>
              </div>
              <button
                type="button"
                disabled={toggleMutation.isPending || modeQuery.isLoading}
                onClick={() => toggleMutation.mutate(isAuto ? "manual" : "automatic")}
                className={`relative h-14 w-72 rounded-full border-2 transition-all overflow-hidden ${
                  isAuto
                    ? "bg-success/15 border-success/60 shadow-[0_0_30px_-5px_var(--color-success)]"
                    : "bg-warning/15 border-warning/60"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 h-11 w-[140px] rounded-full transition-all flex items-center justify-center gap-2 font-semibold text-sm ${
                    isAuto
                      ? "translate-x-[124px] bg-gradient-to-r from-success to-success/70 text-background"
                      : "translate-x-0 bg-gradient-to-r from-warning to-warning/70 text-background"
                  }`}
                >
                  {isAuto ? (
                    <><Zap className="h-4 w-4" /> AUTOMÁTICO</>
                  ) : (
                    <><Hand className="h-4 w-4" /> MANUAL</>
                  )}
                </span>
                <span className="absolute inset-0 flex items-center justify-between px-5 text-[11px] uppercase tracking-wider opacity-60 pointer-events-none">
                  <span>Manual</span>
                  <span>Auto</span>
                </span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {isAuto
                ? "⚡ Campanhas pagas vão direto para a Meta API com o token da agência. Se a API falhar, cai automaticamente para 'Em Análise'."
                : "✋ Campanhas pagas ficam com status 'Em Análise' aguardando aprovação manual nesta tela."}
            </p>
          </section>

          {/* Asaas config + Confirmação de pagamento */}
          <section className="grid lg:grid-cols-2 gap-6">
            <div className="glass-strong rounded-2xl p-6 space-y-4 border border-primary/20">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Asaas — Integração PIX</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                As cobranças PIX são geradas automaticamente via API do Asaas
                (<code className="text-primary">/v3/customers</code> +{" "}
                <code className="text-primary">/v3/payments</code>). O código copia-e-cola
                é buscado em <code className="text-primary">/v3/payments/&#123;id&#125;/pixQrCode</code>
                e exibido diretamente ao cliente. Nenhum link ou template manual é necessário.
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={apiKeySet}
                  onChange={(e) => setApiKeySet(e.target.checked)}
                />
                Chave da API do Asaas já configurada (informativo)
              </label>
              <Button
                variant="neon"
                size="sm"
                onClick={() => saveAsaas.mutate()}
                disabled={saveAsaas.isPending}
              >
                {saveAsaas.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Salvar
              </Button>


              <div className="pt-4 mt-2 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">Chave PIX manual (fallback)</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Se a API do Asaas falhar em gerar a cobrança, o app mostra esta chave PIX para o cliente
                  copiar. O pagamento entra como manual — depois você aprova em "Solicitações de pagamento".
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chave PIX (CPF/CNPJ/Email/Telefone/Aleatória)</Label>
                  <Input
                    placeholder="ex: 000.000.000-00"
                    value={manualPixKey}
                    onChange={(e) => setManualPixKey(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do beneficiário (opcional)</Label>
                  <Input
                    placeholder="ex: Robô de Lucro LTDA"
                    value={manualPixBeneficiary}
                    onChange={(e) => setManualPixBeneficiary(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={manualPixEnabled}
                    onChange={(e) => setManualPixEnabled(e.target.checked)}
                  />
                  Habilitar fallback manual
                </label>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => saveManualPix.mutate()}
                  disabled={saveManualPix.isPending}
                >
                  {saveManualPix.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Salvar chave PIX
                </Button>
              </div>
            </div>



            <div className="glass-strong rounded-2xl p-6 space-y-4 border border-primary/20">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Modo de confirmação do pagamento</h2>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={confirmMode === "manual" ? "neon" : "glass"}
                  size="sm"
                  onClick={() => toggleConfirmMode.mutate("manual")}
                  disabled={toggleConfirmMode.isPending}
                >
                  <Hand className="h-3.5 w-3.5" /> Manual
                </Button>
                <Button
                  variant={confirmMode === "webhook" ? "neon" : "glass"}
                  size="sm"
                  onClick={() => toggleConfirmMode.mutate("webhook")}
                  disabled={toggleConfirmMode.isPending}
                >
                  <Zap className="h-3.5 w-3.5" /> Webhook Asaas
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {confirmMode === "webhook"
                  ? "⚡ O Asaas notifica o endpoint /api/public/asaas-webhook e o saldo é creditado automaticamente."
                  : "✋ Você aprova cada pagamento manualmente na lista abaixo antes do saldo ser creditado."}
              </p>
              <div className="text-[11px] text-muted-foreground glass rounded p-2 font-mono break-all flex items-center gap-2">
                <span>
                  URL do webhook:{" "}
                  <span className="text-primary">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/public/asaas-webhook
                  </span>
                </span>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-white/10 shrink-0"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${window.location.origin}/api/public/asaas-webhook`)
                      .then(() => toast.success("URL do webhook copiada"));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>

            </div>
          </section>

          {/* Resets — contas que apagaram o app na Zona de Perigo */}
          <section className="rounded-2xl overflow-hidden border-2 border-destructive/50 bg-destructive/5">
            <div className="p-5 border-b border-destructive/30 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="font-semibold">Resets na Zona de Perigo</h2>
              </div>
              <span className="text-xs text-destructive font-semibold uppercase tracking-wider">
                ⚠ Desligue os anúncios na Meta!
              </span>
            </div>
            <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
              <p className="font-bold">
                Cada reset abaixo representa uma conta que APAGOU as campanhas no app.
                Os anúncios ainda podem estar <strong>ATIVOS no Facebook</strong> gastando dinheiro.
                É obrigatório <strong>desligar manualmente cada anúncio relacionado</strong> na Meta Ads Manager.
              </p>
            </div>
            {wipesQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : !wipesQuery.data?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum reset registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-destructive/20">
                {wipesQuery.data.map((w) => (
                  <div key={w.id} className="p-5 space-y-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          {w.user_name ?? "(sem nome)"}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {w.user_email ?? w.user_id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs">
                          <span className="text-destructive font-semibold">{w.active_count}</span>{" "}
                          ativo(s) · {w.total_count} total
                        </p>
                      </div>
                    </div>
                    {w.campaigns_snapshot.length > 0 ? (
                      <div className="rounded-lg bg-background/40 border border-destructive/20 p-3 space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <PowerOff className="h-3 w-3 text-destructive" /> Anúncios que estavam relacionados (desligar na Meta):
                        </p>
                        <ul className="space-y-1.5">
                          {w.campaigns_snapshot.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate flex-1">
                                <span className={`mr-2 inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                  c.status === "running" ? "bg-success/20 text-success" :
                                  c.status === "analyzing" ? "bg-warning/20 text-warning" :
                                  "bg-white/10 text-muted-foreground"
                                }`}>
                                  {c.status}
                                </span>
                                <span className="font-medium">{c.name}</span>
                                {c.headline && <span className="text-muted-foreground"> — {c.headline}</span>}
                              </span>
                              {typeof c.budget === "number" && typeof c.days === "number" && (
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                  {fmtBRL(c.budget)}/dia · {c.days}d
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sem campanhas no momento do reset.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ============ Aba: Campanhas dos Clientes ============ */}
        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <section className="glass-strong rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Campanhas dos Clientes</h2>
              <div className="flex items-center gap-2">
                {([
                  ["active", `Ativas (${counts.active})`],
                  ["awaiting_payment", `Aguardando pagamento (${counts.awaiting_payment})`],
                  ["deleted", `Apagados (${counts.deleted})`],
                ] as const).map(([v, label]) => (
                  <Button
                    key={v}
                    variant={campaignView === v ? "neon" : "glass"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setCampaignView(v)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {campaignsQuery.isLoading ? (
              <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : !visibleCampaigns.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma campanha aqui.</div>
            ) : (
              // Rolagem lateral sempre acessível no computador: o container tem
              // altura limitada, então a barra horizontal fica visível sem
              // precisar descer até o fim da lista. Cabeçalho fica fixo.
              <div className="overflow-auto max-h-[70vh] [scrollbar-width:auto]">
                <table className="w-full text-[13px] min-w-[1180px]">
                  <thead className="text-left text-[10px] uppercase tracking-tight text-muted-foreground border-b border-white/5 sticky top-0 z-10 bg-[#12141a]">

                    <tr>
                      <th className="px-2 py-2">Cliente</th>
                      <th className="px-2 py-2">Campanha</th>
                      <th className="px-2 py-2 text-right">Orç.</th>
                      <th className="px-2 py-2 text-center">Dias</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Datas</th>
                      <th className="px-2 py-2">ID Meta</th>
                      <th className="px-2 py-2">Sinc.</th>
                      <th className="px-2 py-2">Cobrança</th>
                      <th className="px-2 py-2">Métricas Reais (Meta)</th>
                      <th className="px-2 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCampaigns.map((c) => {
                      const isRunning = c.status === "running" || c.status === "rodando";
                      const isPaused = c.status === "paused" || c.status === "encerrada_saldo_consumido";
                      const isPending = c.status === "aguardando_vinculo_meta" || c.status === "analyzing";
                      const rowCls = isRunning
                        ? "bg-success/5 border-l-2 border-l-success"
                        : isPaused
                          ? "bg-destructive/5 border-l-2 border-l-destructive"
                          : "";
                      const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
                      return (
                        <tr key={c.id} className={`border-b border-white/5 hover:bg-white/[0.02] align-top ${rowCls}`}>
                          <td className="px-2 py-2">
                            <p className="font-medium truncate max-w-[140px]">{c.client_name ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{c.client_email ?? c.user_id.slice(0, 8)}</p>
                          </td>
                          <td className="px-2 py-2">
                            <p className="font-medium truncate max-w-[150px]">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{c.headline}</p>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{fmtBRL(c.budget)}</td>
                          <td className="px-2 py-2 text-center tabular-nums">{c.days}</td>
                          <td className="px-2 py-2">
                            <select
                              value={c.status}
                              onChange={(e) =>
                                statusMutation.mutate({
                                  id: c.id,
                                  status: e.target.value as "running" | "analyzing" | "paused",
                                })
                              }
                              className="bg-background border border-white/10 rounded-md px-1.5 py-1 text-[11px]"
                            >
                              <option value="analyzing">⏳ Em Análise</option>
                              <option value="running">🟢 Ativo</option>
                              <option value="paused">🔴 Desativado</option>
                              <option value="aguardando_vinculo_meta">💰 Aguardando pagamento</option>
                              <option value="encerrada_saldo_consumido">⛔ Encerrada</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-[10px] leading-tight text-muted-foreground min-w-[135px]">
                            <div>Criada: <span className="text-foreground">{fmtDate(c.created_at)}</span></div>
                            <div>Iniciou: <span className="text-foreground">{fmtDate(c.started_running_at)}</span></div>
                            <div>Pausada: <span className="text-foreground">{fmtDate(c.paused_at)}</span></div>
                            <div>Encerrada: <span className="text-foreground">{fmtDate(c.ended_at)}</span></div>
                          </td>
                          <td className="px-2 py-2 min-w-[190px] space-y-1">
                            <MetaCampaignIdCell id={c.id} value={c.meta_campaign_id} />
                            <MetaCampaignPickerButton campaignId={c.id} campaignName={c.name} />
                          </td>
                          <td className="px-2 py-2 min-w-[150px]">
                            <SyncIndicator campaign={c} />
                          </td>
                          <td className="px-2 py-2">
                            {c.invoice_url ? (
                              <div className="flex items-center gap-1">
                                <a href={c.invoice_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline truncate inline-block max-w-[120px]">
                                  {c.invoice_url}
                                </a>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-white/10"
                                  onClick={() => {
                                    navigator.clipboard.writeText(c.invoice_url!).then(() => toast.success("Link copiado"));
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                {isPending && c.funding_type === "pix_dedicated" ? "sem cobrança" : "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[10px] min-w-[210px]">
                              <Metric label="Cliques" value={c.clicks.toLocaleString("pt-BR")} />
                              <Metric label="Impr." value={c.impressions.toLocaleString("pt-BR")} />
                              <Metric label="CTR" value={`${c.ctr.toFixed(2)}%`} />
                              <Metric label="CPC" value={fmtBRL(c.cpc)} />
                              <Metric label="Gasto" value={fmtBRL(c.spent)} />
                              <Metric label="CPM" value={c.cpm ? fmtBRL(c.cpm) : "—"} />
                              <Metric label="Freq." value={c.frequency ? c.frequency.toFixed(2) : "—"} />
                              <Metric label="C/Result." value={c.cost_per_result ? fmtBRL(c.cost_per_result) : "—"} />
                              <Metric label="ROI" value={c.revenue && c.spent ? `${(((c.revenue - c.spent) / c.spent) * 100).toFixed(1)}%` : "—"} />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button variant="glass" size="sm" className="h-7 text-[11px]" onClick={() => setPreview(c)} title="Pré-visualizar anúncio">
                                <Eye className="h-3.5 w-3.5" /> Prévia
                              </Button>
                              <Button variant="glass" size="sm" className="h-7 text-[11px]" onClick={() => setMetricsTarget(c)} title="Editar métricas">
                                <Pencil className="h-3.5 w-3.5" /> Métricas
                              </Button>
                              <Button
                                variant="neon"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={c.status === "running" || statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: c.id, status: "running" })}
                              >
                                <Rocket className="h-3.5 w-3.5" /> Ativar
                              </Button>
                              {c.archived_reason ? (
                                <Button
                                  variant="glass"
                                  size="sm"
                                  className="h-7 text-[11px]"
                                  disabled={archiveMutation.isPending}
                                  title="Tirar do arquivo e voltar para a lista"
                                  onClick={() => archiveMutation.mutate({ id: c.id, reason: null })}
                                >
                                  <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    className="h-7 text-[11px]"
                                    disabled={archiveMutation.isPending}
                                    title="Arquivar em 'Aguardando pagamento'"
                                    onClick={() => archiveMutation.mutate({ id: c.id, reason: "awaiting_payment" })}
                                  >
                                    <Archive className="h-3.5 w-3.5" /> Aguardando pagamento
                                  </Button>
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    className="h-7 text-[11px] text-destructive"
                                    disabled={archiveMutation.isPending}
                                    title="Apagar (arquiva em 'Apagados')"
                                    onClick={() => archiveMutation.mutate({ id: c.id, reason: "deleted" })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Apagar
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

              </div>
            )}
          </section>
        </TabsContent>


        {/* ============ Aba: Todos os Clientes ============ */}
        <TabsContent value="clients" className="space-y-6 mt-6">
          <AllClientsSection clientsQuery={clientsQuery} />
        </TabsContent>

        {/* ============ Aba: IA de Métricas (item 6) ============ */}
        <TabsContent value="ai" className="space-y-6 mt-6">
          <AIReviewsSection />
        </TabsContent>

        {/* ============ Aba: Auditoria Meta (item 14) ============ */}
        <TabsContent value="metaaudit" className="space-y-6 mt-6">
          <MetaAuditSection />
        </TabsContent>
      </Tabs>
      </AdminSearchContext.Provider>

      {preview && <FbPreview campaign={preview} onClose={() => setPreview(null)} />}
      {metricsTarget && <EditMetricsDialog campaign={metricsTarget} onClose={() => setMetricsTarget(null)} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded p-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums truncate">{value}</p>
    </div>
  );
}

function MetaCampaignIdCell({ id, value }: { id: string; value: string | null }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(value ?? "");
  useEffect(() => { setVal(value ?? ""); }, [value]);
  const saveFn = useServerFn(adminSetMetaCampaignId);
  const mut = useMutation({
    mutationFn: (v: string) => saveFn({ data: { id, meta_campaign_id: v.trim() || null } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      if (r.synced) toast.success("Vinculado — métricas sincronizadas agora mesmo");
      else if (r.syncError) toast.warning("Vinculado, mas o sync inicial falhou: " + r.syncError);
      else toast.success(r.meta_campaign_id ? "Vinculado ao Meta" : "Vínculo removido");
    },
    onError: (e) => toast.error("Falha ao salvar", { description: String(e) }),
  });
  const dirty = (val ?? "") !== (value ?? "");
  return (
    <div className="flex items-center gap-1">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ex: 120210000012345678"
        className="h-8 text-xs font-mono"
      />
      <Button
        size="sm"
        variant={dirty ? "neon" : "glass"}
        disabled={!dirty || mut.isPending}
        onClick={() => mut.mutate(val)}
        title="Salvar ID do Meta"
      >
        {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// Galeria do criativo: mostra vídeo ou as imagens do carrossel em sequência,
// na mesma ordem em que o cliente enviou, com download em 1 clique (arquivo
// original, resolução intacta).
function CreativeMedia({ campaignId, fallbackImage }: { campaignId: string; fallbackImage: string }) {
  const fn = useServerFn(adminGetCampaignMediaUrls);
  const q = useQuery({
    queryKey: ["admin-campaign-media", campaignId],
    queryFn: () => fn({ data: { campaign_id: campaignId } }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return <div className="w-full aspect-square bg-black/40 grid place-items-center text-xs text-white/50">Carregando criativo...</div>;
  }
  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return fallbackImage ? (
      <img src={fallbackImage} alt="" className="w-full aspect-square object-cover bg-black" />
    ) : (
      <div className="w-full aspect-square bg-black/40 grid place-items-center text-xs text-white/50">Sem criativo enviado</div>
    );
  }

  return (
    <div className="space-y-2 bg-black/40 p-2">
      {items.map((m, i) => (
        <div key={m.path} className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-white/70 bg-white/5">
            <span className="truncate">
              {items.length > 1 ? `${i + 1}/${items.length} · ` : ""}{m.name || m.path.split("/").pop()}
              {m.size ? ` · ${(m.size / 1024 / 1024).toFixed(1)}MB` : ""}
            </span>
            <a
              href={m.downloadUrl}
              download={m.name || undefined}
              className="flex items-center gap-1 text-primary hover:underline shrink-0"
            >
              <Download className="h-3 w-3" /> Baixar
            </a>
          </div>
          {m.kind === "video" ? (
            <video src={m.url} controls preload="metadata" className="w-full max-h-[420px] bg-black" />
          ) : (
            <img src={m.url} alt={m.name} className="w-full object-contain max-h-[420px] bg-black" />
          )}
        </div>
      ))}
    </div>
  );
}

function FbPreview({ campaign, onClose }: { campaign: AdminCampaignRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#18191a] rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-xs text-white/60">
            Prévia · Facebook Feed
            {campaign.media_type === "video"
              ? " · Vídeo"
              : campaign.media_type === "carousel"
                ? ` · Carrossel (${campaign.media.length})`
                : ""}
          </span>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-[#242526] text-white">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent" />
            <div className="text-xs">
              <p className="font-semibold">{campaign.client_name ?? "Anunciante"}</p>
              <p className="text-white/50">Patrocinado · 🌐</p>
            </div>
          </div>
          <p className="px-3 pb-3 text-sm whitespace-pre-wrap break-words">{campaign.copy || campaign.headline}</p>
          <CreativeMedia campaignId={campaign.id} fallbackImage={campaign.image} />
          <div className="px-3 py-2 bg-[#3a3b3c] flex items-center justify-between gap-2">
            <div className="text-xs min-w-0">
              <p className="uppercase text-white/50 text-[10px]">
                {safeHostname(campaign.link)}
              </p>
              <p className="font-semibold text-sm break-words">{campaign.headline || campaign.name}</p>
            </div>
            <button className="bg-[#4e4f50] hover:bg-[#5a5b5c] text-white text-xs font-semibold px-3 py-1.5 rounded shrink-0">
              Saiba mais
            </button>
          </div>
        </div>

        {/* Dados exatos preenchidos pelo cliente */}
        <div className="p-4 space-y-3 text-xs bg-[#18191a] border-t border-white/10">
          <Field label="Nome da campanha" value={campaign.name} />
          <Field label="Título (headline)" value={campaign.headline || "—"} />
          <Field label="Texto do anúncio" value={campaign.copy || "—"} pre />
          <div>
            <p className="text-white/40 uppercase text-[10px] tracking-wider">Link de destino (exato)</p>
            <div className="flex items-start gap-2">
              {campaign.link ? (
                <a
                  href={/^https?:\/\//i.test(campaign.link) ? campaign.link : `https://${campaign.link}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline break-all"
                >
                  {campaign.link}
                </a>
              ) : (
                <span className="text-white/50 italic">não informado</span>
              )}
              {campaign.link && (
                <button
                  type="button"
                  className="p-1 rounded hover:bg-white/10 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(campaign.link).then(() => toast.success("Link copiado"));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <Field
            label="Local de veiculação"
            value={
              [campaign.neighborhood, campaign.city].filter(Boolean).join(" · ") +
              (campaign.radius ? ` — raio de ${campaign.radius} km` : "")
              || "não informado"
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investimento por dia" value={fmtBRL(campaign.budget)} />
            <Field label="Dias de veiculação" value={`${campaign.days} dia(s)`} />
            <Field label="Total a ser veiculado" value={fmtBRL(campaign.budget * campaign.days)} />
            <Field label="Total já pago" value={fmtBRL(campaign.total_paid)} />
          </div>
          {campaign.funding_type === "pix_dedicated" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="PIX total" value={fmtBRL(campaign.pix_total_budget)} />
              <Field label="PIX restante" value={fmtBRL(campaign.pix_remaining_budget)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Início programado"
              value={campaign.scheduled_start_at ? new Date(campaign.scheduled_start_at).toLocaleString("pt-BR") : "—"}
            />
            <Field
              label="Fim programado"
              value={campaign.scheduled_end_at ? new Date(campaign.scheduled_end_at).toLocaleString("pt-BR") : "—"}
            />
          </div>
          <Field label="Cliente" value={`${campaign.client_name ?? "—"} · ${campaign.client_email ?? "—"}`} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div>
      <p className="text-white/40 uppercase text-[10px] tracking-wider">{label}</p>
      <p className={`text-white/90 break-words ${pre ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}



function MetaHealthCard() {
  const fn = useServerFn(getMetaMetricsHealth);
  const q = useQuery({ queryKey: ["meta-health"], queryFn: () => fn(), refetchInterval: 60_000 });
  const h = q.data;
  const stale = !h || h.stale;
  const color = !h?.last_run_at ? "border-muted-foreground/30" : stale ? "border-destructive/60" : "border-success/50";
  return (
    <section className={`glass-strong rounded-2xl p-4 border ${color} flex flex-wrap items-center justify-between gap-3`}>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Saúde: Cron Meta Ads Insights</p>
        <p className="text-sm mt-1">
          {!h?.last_run_at
            ? "Nunca executado"
            : `Última: ${new Date(h.last_run_at).toLocaleString("pt-BR")} — status ${h.last_status} — processadas ${h.processed_count} / erros ${h.error_count}`}
        </p>
      </div>
      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${stale ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
        {stale ? "ATENÇÃO" : "OK"}
      </span>
    </section>
  );
}

function ExportCsvButton() {
  const fn = useServerFn(adminExportCampaignsCSV);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { csv } = await fn();
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `campanhas-${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV exportado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao exportar");
          } finally {
            setBusy(false);
          }
        }}
      >
        Exportar campanhas (CSV)
      </Button>
    </div>
  );
}

function safeHostname(link: string | null | undefined): string {
  if (!link) return "facebook.com";
  try {
    const withProto = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    return new URL(withProto).hostname;
  } catch {
    return "link inválido";
  }
}

// ============ Item 7/8: link de acesso direto (magic link) ============
function AccessLinkButton({ userId, label }: { userId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const fn = useServerFn(adminGenerateAccessLink);
  const mut = useMutation({
    mutationFn: () => fn({ data: { user_id: userId } }),
    onSuccess: (r) => {
      setUrl(r.url);
      setOpen(true);
    },
    onError: (e) => toast.error("Falha ao gerar link", { description: String(e) }),
  });
  return (
    <>
      <Button
        variant="glass"
        size="sm"
        disabled={mut.isPending}
        onClick={() => mut.mutate()}
        title="Gerar link de acesso direto (sem senha)"
      >
        {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
        {label ?? "Link de acesso"}
      </Button>
      {open && url && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link de acesso direto</DialogTitle>
              <DialogDescription>
                Válido por aproximadamente 1 hora e de uso único. Envie por um canal privado (WhatsApp,
                e-mail) — quem tiver esse link entra direto na conta do cliente, sem senha.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-primary/30 bg-background/50 p-3 text-xs font-mono break-all select-all">
              {url}
            </div>
            <DialogFooter>
              <Button
                variant="neon"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar link
              </Button>
              <Button variant="glass" size="sm" onClick={() => setOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function AutoApproveToggle() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAutoApproveAccess);
  const setFn = useServerFn(setAutoApproveAccess);
  const q = useQuery({ queryKey: ["auto-approve-access"], queryFn: () => getFn(), refetchInterval: 60_000 });
  const enabled = q.data?.enabled ?? false;
  const mut = useMutation({
    mutationFn: (v: boolean) => setFn({ data: { enabled: v } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["auto-approve-access"] });
      toast.success(r.enabled ? "Entradas abertas: novos cadastros entram na hora" : "Entradas fechadas: aprovação manual");
    },
    onError: (e) => toast.error("Falha ao alterar", { description: String(e) }),
  });
  return (
    <Button
      variant={enabled ? "neon" : "glass"}
      size="sm"
      disabled={q.isLoading || mut.isPending}
      onClick={() => mut.mutate(!enabled)}
    >
      {enabled ? "Entradas abertas (ON)" : "Entradas abertas (OFF)"}
    </Button>
  );
}

// ============ Nível do usuário: FREE / PRO / TESTE PRO ============
function PlanButtons({
  userId,
  plan,
  trialDays,
  trialStartedAt,
}: {
  userId: string;
  plan: "free" | "pro" | "trial_pro" | "credits" | "pro_max";
  trialDays: number | null;
  trialStartedAt: string | null;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(adminSetUserPlan);
  const mut = useMutation({
    mutationFn: (v: {
      plan: "free" | "pro" | "trial_pro" | "credits" | "pro_max";
      trial_days?: number;
    }) =>
      fn({ data: { user_id: userId, ...v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin-access-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
      toast.success(
        v.plan === "free"
          ? "Usuário definido como FREE"
          : v.plan === "pro"
            ? "Usuário definido como PRO"
            : v.plan === "credits"
              ? "Usuário definido como CRÉDITOS"
              : v.plan === "pro_max"
                ? "Usuário definido como PRO MAX"
                : "Teste PRO liberado",
      );
    },
    onError: (e) => toast.error(String(e)),
  });

  const daysLeft = (() => {
    if (plan !== "trial_pro" || !trialStartedAt || !trialDays) return 0;
    const end = new Date(trialStartedAt).getTime() + trialDays * 86_400_000;
    return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
  })();

  const base = "text-[11px] font-semibold px-3 py-1 rounded-full border transition disabled:opacity-50";
  const off = "border-white/15 text-muted-foreground hover:border-white/30";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate({ plan: "credits" })}
        className={`${base} ${plan === "credits" ? "border-violet-400/60 bg-violet-500/20 text-violet-200" : off}`}
      >
        CRÉDITOS
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate({ plan: "free" })}
        className={`${base} ${plan === "free" ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : off}`}
      >
        FREE
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate({ plan: "pro" })}
        className={`${base} ${plan === "pro" ? "border-[#e6b422]/70 bg-[#e6b422]/20 text-[#f2d377]" : off}`}
      >
        <span className="inline-flex items-center gap-1">
          <Crown className="h-3 w-3" /> PRO
        </span>
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate({ plan: "pro_max" })}
        className={`${base} ${plan === "pro_max" ? "border-[#e6b422] bg-gradient-to-r from-[#f7d774] to-[#c9971b] text-[#2b1c00]" : off}`}
      >
        <span className="inline-flex items-center gap-1">
          <Crown className="h-3 w-3" /> PRO MAX
        </span>
      </button>
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => {
          const raw = window.prompt("Liberar TESTE PRO por quantos dias?", String(trialDays ?? 7));
          if (raw === null) return;
          const n = Math.floor(Number(raw));
          if (!Number.isFinite(n) || n < 1 || n > 365) {
            toast.error("Informe um número de dias entre 1 e 365");
            return;
          }
          mut.mutate({ plan: "trial_pro", trial_days: n });
        }}
        className={`${base} ${plan === "trial_pro" ? "border-[#e6b422]/70 bg-[#e6b422]/20 text-[#f2d377]" : off}`}
      >
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" /> {plan === "trial_pro" ? `TESTE PRO · ${daysLeft}d` : "Liberar Teste"}
        </span>
      </button>
    </div>
  );
}

function AccessRequestsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAccessRequests);
  const approveFn = useServerFn(adminApproveAccessRequest);
  const denyFn = useServerFn(adminDenyAccessRequest);
  const q = useQuery({
    queryKey: ["admin-access-requests"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-access-requests"] });
      toast.success("Acesso liberado");
    },
    onError: (e) => toast.error(String(e)),
  });
  const denyMut = useMutation({
    mutationFn: (id: string) => denyFn({ data: { id, reason: "Recusado pelo admin" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-access-requests"] });
      toast.info("Solicitação recusada");
    },
  });
  const search = useAdminSearch();
  const pending = (q.data ?? []).filter((r) => r.status === "pending");
  const rows = (q.data ?? []).filter((r) =>
    matchesSearch(search, [r.display_name, r.email, r.user_id, r.phone]),
  );
  return (
    <section className="glass-strong rounded-2xl overflow-hidden border border-primary/20">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Solicitações de Acesso</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{pending.length} aguardando</span>
          <AutoApproveToggle />
        </div>
      </div>
      {q.isLoading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : !rows.length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação registrada.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.display_name ?? "(sem nome)"}</p>
                <p className="text-[11px] text-muted-foreground">{r.email ?? r.user_id.slice(0, 8)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                  {r.reviewed_at && r.status !== "pending" && ` · revisado em ${new Date(r.reviewed_at).toLocaleString("pt-BR")}`}
                </p>
                {r.status === "approved" && r.reviewed_at && (
                  <div className="mt-1">
                    <AccessElapsedClock since={r.reviewed_at} />
                  </div>
                )}
                <div className="mt-2">
                  <PlanButtons
                    userId={r.user_id}
                    plan={r.plan}
                    trialDays={r.trial_days}
                    trialStartedAt={r.trial_started_at ?? r.reviewed_at}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-1 rounded-full border ${
                  r.status === "approved" ? "border-success/40 text-success bg-success/10" :
                  r.status === "rejected" ? "border-destructive/40 text-destructive bg-destructive/10" :
                  "border-warning/40 text-warning bg-warning/10"
                }`}>
                  {r.status === "approved" ? "Aprovado" : r.status === "rejected" ? "Recusado" : "Pendente"}
                </span>
                {r.status === "pending" && (
                  <>
                    <Button variant="neon" size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate(r.id)}>
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button variant="glass" size="sm" disabled={denyMut.isPending} onClick={() => denyMut.mutate(r.id)}>
                      <Ban className="h-3.5 w-3.5" /> Recusar
                    </Button>
                  </>
                )}
                {/* Item 7/8: o link fica disponível independente do status — inclusive
                    depois de aprovado, pra reenvio rápido se a pessoa perder o acesso. */}
                <AccessLinkButton userId={r.user_id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type ClientFilter = "active" | "banned";

function AllClientsSection({
  clientsQuery,
}: {
  clientsQuery: { data: AdminClientRow[] | undefined; isLoading: boolean };
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ClientFilter>("active");
  const [balanceTarget, setBalanceTarget] = useState<AdminClientRow | null>(null);
  const [profileTarget, setProfileTarget] = useState<AdminClientRow | null>(null);

  const setStatusFn = useServerFn(adminSetUserStatus);
  const banMut = useMutation({
    mutationFn: (v: { user_id: string; status: "approved" | "banned" }) => setStatusFn({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
      toast.success(v.status === "banned" ? "Usuário banido" : "Acesso devolvido");
    },
    onError: (e) => toast.error("Falha ao atualizar status", { description: String(e) }),
  });

  const search = useAdminSearch();
  const all = clientsQuery.data ?? [];
  const filtered = all
    .filter((c) => (filter === "active" ? c.status !== "banned" : c.status === "banned"))
    .filter((c) => matchesSearch(search, [c.display_name, c.email, c.phone, c.id, c.balance]));

  return (
    <section className="glass-strong rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Todos os Clientes</h2>
        <div className="flex items-center gap-2">
          <Button variant={filter === "active" ? "neon" : "glass"} size="sm" onClick={() => setFilter("active")}>
            Ativos ({all.filter((c) => c.status !== "banned").length})
          </Button>
          <Button variant={filter === "banned" ? "neon" : "glass"} size="sm" onClick={() => setFilter("banned")}>
            Desativados ({all.filter((c) => c.status === "banned").length})
          </Button>
        </div>
      </div>
      {clientsQuery.isLoading ? (
        <div className="p-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      ) : !filtered.length ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          {filter === "active" ? "Nenhum cliente ativo." : "Nenhum cliente desativado."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Nível</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Cliente desde</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{c.display_name ?? "—"}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{c.email ?? c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <PlanButtons
                      userId={c.id}
                      plan={c.plan}
                      trialDays={c.trial_days}
                      trialStartedAt={c.trial_started_at}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtBRL(c.balance)}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${
                      c.status === "banned" ? "border-destructive/40 text-destructive bg-destructive/10" : "border-success/40 text-success bg-success/10"
                    }`}>
                      {c.status === "banned" ? "Banido" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Button variant="glass" size="sm" onClick={() => setBalanceTarget(c)} title="Editar saldo">
                        <Wallet className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="glass" size="sm" onClick={() => setProfileTarget(c)} title="Editar perfil">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Item 7/8: disponível mesmo pra cliente já aprovado, pra reenvio de acesso rápido */}
                      <AccessLinkButton userId={c.id} label="" />
                      {c.status === "banned" ? (
                        <Button
                          variant="neon"
                          size="sm"
                          disabled={banMut.isPending}
                          onClick={() => banMut.mutate({ user_id: c.id, status: "approved" })}
                          title="Devolver acesso"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Devolver acesso
                        </Button>
                      ) : (
                        <Button
                          variant="glass"
                          size="sm"
                          disabled={banMut.isPending}
                          onClick={() => {
                            if (window.confirm(`Banir ${c.display_name ?? c.email ?? "este usuário"}? Ele perde o acesso ao app.`)) {
                              banMut.mutate({ user_id: c.id, status: "banned" });
                            }
                          }}
                          title="Banir usuário"
                        >
                          <Ban className="h-3.5 w-3.5" /> Banir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {balanceTarget && (
        <BalanceDialog client={balanceTarget} onClose={() => setBalanceTarget(null)} />
      )}
      {profileTarget && (
        <ProfileDialog client={profileTarget} onClose={() => setProfileTarget(null)} />
      )}
    </section>
  );
}

function BalanceDialog({ client, onClose }: { client: AdminClientRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const fn = useServerFn(adminAdjustBalance);
  const mut = useMutation({
    mutationFn: () => fn({ data: { user_id: client.id, delta: Number(delta), reason: reason.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
      toast.success("Saldo atualizado");
      onClose();
    },
    onError: (e) => toast.error("Falha ao ajustar saldo", { description: String(e) }),
  });
  const deltaNum = Number(delta);
  const valid = delta.trim() !== "" && !Number.isNaN(deltaNum) && deltaNum !== 0 && reason.trim().length >= 3;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar saldo — {client.display_name ?? client.email ?? "cliente"}</DialogTitle>
          <DialogDescription>
            Saldo atual: {fmtBRL(client.balance)}. Informe o valor a somar (use negativo para descontar).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor (ex: 50 ou -20)</Label>
            <Input value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="ex: 50" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo (obrigatório)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: reembolso de campanha cancelada" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="glass" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="neon" size="sm" disabled={!valid || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialog({ client, onClose }: { client: AdminClientRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(client.display_name ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const fn = useServerFn(adminUpdateProfile);
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          user_id: client.id,
          display_name: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
      toast.success("Perfil atualizado");
      onClose();
    },
    onError: (e) => toast.error("Falha ao atualizar perfil", { description: String(e) }),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil — {client.display_name ?? client.email ?? "cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="glass" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="neon" size="sm" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMetricsDialog({ campaign, onClose }: { campaign: AdminCampaignRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    spent: String(campaign.spent),
    clicks: String(campaign.clicks),
    impressions: String(campaign.impressions),
    ctr: String(campaign.ctr),
    cpc: String(campaign.cpc),
    cpm: String(campaign.cpm),
    frequency: String(campaign.frequency),
    results: String(campaign.results),
    revenue: String(campaign.revenue),
    cost_per_result: String(campaign.cost_per_result),
  });
  const fn = useServerFn(adminUpdateCampaignMetrics);
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: campaign.id,
          spent: Number(form.spent),
          clicks: Math.round(Number(form.clicks)),
          impressions: Math.round(Number(form.impressions)),
          ctr: Number(form.ctr),
          cpc: Number(form.cpc),
          cpm: Number(form.cpm),
          frequency: Number(form.frequency),
          results: Math.round(Number(form.results)),
          revenue: Number(form.revenue),
          cost_per_result: Number(form.cost_per_result),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Métricas atualizadas");
      onClose();
    },
    onError: (e) => toast.error("Falha ao atualizar métricas", { description: String(e) }),
  });

  const field = (key: keyof typeof form, label: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        inputMode="decimal"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar métricas — {campaign.name}</DialogTitle>
          <DialogDescription>
            Sobrescreve manualmente os números dessa campanha. Use com cuidado: a próxima sincronização
            automática do Meta pode substituir esses valores de novo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("spent", "Gasto (R$)")}
          {field("clicks", "Cliques")}
          {field("impressions", "Impressões")}
          {field("ctr", "CTR (%)")}
          {field("cpc", "CPC (R$)")}
          {field("cpm", "CPM (R$)")}
          {field("frequency", "Frequência")}
          {field("results", "Resultados")}
          {field("revenue", "Receita (R$)")}
          {field("cost_per_result", "Custo por resultado (R$)")}
        </div>
        <DialogFooter>
          <Button variant="glass" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="neon" size="sm" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PixAttemptsSection() {
  const fn = useServerFn(adminListPixAttempts);
  const q = useQuery({
    queryKey: ["admin-pix-attempts"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const attempts = q.data ?? [];
  const failedCount = attempts.filter((a) => !a.ok).length;

  return (
    <section className={`glass-strong rounded-2xl overflow-hidden border ${failedCount > 0 ? "border-destructive/40" : "border-white/5"}`}>
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${failedCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <h2 className="font-semibold">Falhas de integração Asaas</h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${failedCount > 0 ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
          {failedCount > 0 ? `${failedCount} falha(s) recente(s)` : "Sem falhas recentes"}
        </span>
      </div>
      {q.isLoading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : !attempts.length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tentativa registrada ainda.</div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
          {attempts.map((a) => (
            <PixAttemptRowItem
              key={a.id}
              attempt={a}
              expanded={expanded === a.id}
              onToggle={() => setExpanded((cur) => (cur === a.id ? null : a.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PixAttemptRowItem({
  attempt,
  expanded,
  onToggle,
}: {
  attempt: PixAttemptRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-4">
      <button type="button" onClick={onToggle} className="w-full flex flex-wrap items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {new Date(attempt.created_at).toLocaleString("pt-BR")} · {attempt.user_id.slice(0, 8)}
            {attempt.campaign_id ? ` · campanha ${attempt.campaign_id.slice(0, 8)}` : " · saldo do app"}
          </p>
          <p className="text-sm font-medium mt-0.5">
            {attempt.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            {attempt.http_status ? ` · HTTP ${attempt.http_status}` : ""}
          </p>
          {!attempt.ok && attempt.error_message && (
            <p className="text-xs text-destructive mt-1 truncate max-w-md">{attempt.error_message}</p>
          )}
          {!attempt.ok && <ErrorHint message={attempt.error_message} />}
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${
          attempt.ok ? "border-success/40 text-success bg-success/10" : "border-destructive/40 text-destructive bg-destructive/10"
        }`}>
          {attempt.ok ? "Sucesso" : "Falha"}
        </span>
      </button>
      {expanded && (
        <pre className="mt-3 text-[10px] bg-background/60 rounded-lg p-3 overflow-x-auto border border-white/5">
          {JSON.stringify(
            {
              asaas_customer_id: attempt.asaas_customer_id,
              asaas_payment_id: attempt.asaas_payment_id,
              raw_payload: attempt.raw_payload,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}

type SyncState = "green" | "yellow" | "red";

function computeSyncState(c: AdminCampaignRow): { state: SyncState; label: string } {
  if (!c.meta_campaign_id) {
    return { state: "red", label: "Sem vínculo com o Meta" };
  }
  if (c.metrics_last_error) {
    return { state: "red", label: `Erro: ${c.metrics_last_error}` };
  }
  if (!c.metrics_last_synced_at) {
    return { state: "yellow", label: "Vinculado, aguardando primeira sincronização" };
  }
  const hasRealData = c.spent > 0 || c.clicks > 0 || c.impressions > 0;
  if (hasRealData) {
    return { state: "green", label: "Sincronizado com dados reais do Meta" };
  }
  return { state: "yellow", label: "Sincronizado, mas ainda sem dados de entrega" };
}

// Item 12: mostra "agora mesmo" quando a sincronização aconteceu há menos de
// 60 segundos, em vez do timestamp completo — reforça visualmente que acabou
// de vincular e os dados já chegaram, sem precisar fazer conta de cabeça.
function formatSyncTime(iso: string): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60) return "agora mesmo";
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
  return new Date(iso).toLocaleString("pt-BR");
}

function SyncIndicator({ campaign }: { campaign: AdminCampaignRow }) {
  const { state, label } = computeSyncState(campaign);
  const dotClass =
    state === "green" ? "bg-success" : state === "yellow" ? "bg-warning" : "bg-destructive";
  const textClass =
    state === "green" ? "text-success" : state === "yellow" ? "text-warning" : "text-destructive";
  const justSynced = !!campaign.metrics_last_synced_at &&
    (Date.now() - new Date(campaign.metrics_last_synced_at).getTime()) / 1000 < 60;
  return (
    <div className="flex items-start gap-1.5" title={label}>
      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dotClass} ${justSynced ? "animate-pulse" : ""}`} />
      <div className="text-[10px] leading-tight">
        <p className={`font-medium ${textClass}`}>
          {state === "green" ? "Sincronizado" : state === "yellow" ? "Aguardando dados" : "Sem sincronizar"}
          {justSynced && " ✨"}
        </p>
        {campaign.metrics_last_synced_at && (
          <p className="text-muted-foreground">{formatSyncTime(campaign.metrics_last_synced_at)}</p>
        )}
        {campaign.meta_effective_status && (
          <p className="text-muted-foreground">Meta: {campaign.meta_effective_status}</p>
        )}
        {campaign.metrics_last_error && <ErrorHint message={campaign.metrics_last_error} />}
      </div>
    </div>
  );
}

function SupportUnreadBadge() {
  const qc = useQueryClient();
  const fn = useServerFn(adminListConversations);
  const q = useQuery({
    queryKey: ["admin-support-unread-count"],
    queryFn: () => fn(),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admindev-support-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => qc.invalidateQueries({ queryKey: ["admin-support-unread-count"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Só conta como novidade quando existe mensagem de verdade — conversa aberta
  // sem nenhuma mensagem não gera notificação.
  const count = (q.data ?? []).filter((c) => c.unread_by_admin && !!c.last_message_at).length;
  if (!count) return null;

  return (
    <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function MetaCampaignPickerButton({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="glass" size="sm" className="h-7 text-[11px] w-full" onClick={() => setOpen(true)}>
        Buscar no Meta
      </Button>
      {open && (
        <MetaCampaignPickerDialog
          campaignId={campaignId}
          campaignName={campaignName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MetaCampaignPickerDialog({
  campaignId,
  campaignName,
  onClose,
}: {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const listFn = useServerFn(adminListMetaAdAccountCampaigns);
  const linkFn = useServerFn(adminSetMetaCampaignId);

  const q = useQuery({
    queryKey: ["meta-ad-account-campaigns"],
    queryFn: () => listFn(),
    retry: false,
  });

  const linkMut = useMutation({
    mutationFn: (metaCampaignId: string) =>
      linkFn({ data: { id: campaignId, meta_campaign_id: metaCampaignId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      if (r?.synced) toast.success("Vinculada e métricas sincronizadas agora");
      else if (r?.syncError) toast.warning("Vinculada. Sync inicial falhou: " + r.syncError);
      else toast.success("Campanha vinculada");
      onClose();
    },
    onError: (e) => toast.error("Falha ao vincular", { description: String(e) }),
  });

  const campaigns = q.data?.campaigns ?? [];
  const accounts = q.data?.accounts ?? [];

  const term = search.trim().toLowerCase();
  const filtered = campaigns.filter((c) => {
    if (accountFilter !== "all" && c.account_id !== accountFilter) return false;
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      c.account_name.toLowerCase().includes(term) ||
      c.id.includes(term)
    );
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar campanha no Meta — {campaignName}</DialogTitle>
          <DialogDescription>
            Escolha primeiro a conta de anúncios e depois a campanha real dela.
            A sincronização das métricas roda imediatamente após vincular.
          </DialogDescription>
        </DialogHeader>

        {accounts.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Conta de anúncios ({accounts.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAccountFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] border transition ${
                  accountFilter === "all"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
                }`}
              >
                Todas
              </button>
              {accounts.map((a) => (
                <button
                  key={a.account_id}
                  type="button"
                  onClick={() => setAccountFilter(a.account_id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition flex items-center gap-1 ${
                    accountFilter === a.account_id
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : a.error
                        ? "border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/60"
                        : "border-white/10 bg-background/30 text-muted-foreground hover:border-white/20"
                  }`}
                  title={a.error ? `act_${a.account_id} — ${a.error}` : `act_${a.account_id} · ${a.campaign_count} campanhas`}
                >
                  {a.account_name}
                  <span className="opacity-60">({a.campaign_count})</span>
                </button>
              ))}
            </div>
            {accounts.some((a) => a.error) && (
              <p className="text-[10px] text-destructive/80">
                Contas em vermelho não retornaram campanhas — passe o mouse para ver o motivo (permissão, conta desativada, etc.).
              </p>
            )}
          </div>
        )}

        <Input
          placeholder="Filtrar por nome da campanha, conta ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[360px] overflow-y-auto space-y-1.5">
          {q.isLoading ? (
            <div className="p-6 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : q.isError ? (
            <div className="p-4 text-xs text-destructive space-y-1.5">
              <p>Não foi possível buscar a lista: {q.error instanceof Error ? q.error.message : String(q.error)}</p>
              <ErrorHint message={q.error instanceof Error ? q.error.message : String(q.error)} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">
              Nenhuma campanha encontrada{search || accountFilter !== "all" ? " para esse filtro" : ""}.
            </div>
          ) : (
            filtered.map((c: MetaAdAccountCampaign) => (
              <button
                key={c.id}
                type="button"
                onClick={() => linkMut.mutate(c.id)}
                disabled={linkMut.isPending}
                className="w-full text-left p-2.5 rounded-lg border border-white/10 hover:border-primary/40 hover:bg-white/5 transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[10px] text-primary/80 font-medium truncate">
                    {c.account_name}
                  </p>
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.id} · {c.effective_status}</p>
                  {c.already_linked_to && (
                    <p className="text-[10px] text-warning mt-0.5">
                      ⚠ já vinculada a "{c.already_linked_to}" — escolher aqui troca o vínculo
                    </p>
                  )}
                </div>
                {linkMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="glass" size="sm" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Item 6 UI: IA de Métricas ============
const verdictMeta: Record<AIReviewRow["verdict"], { label: string; cls: string; icon: typeof ThumbsUp }> = {
  good: { label: "Bom desempenho", cls: "text-success bg-success/10 border-success/30", icon: ThumbsUp },
  warn: { label: "Precisa de atenção", cls: "text-warning bg-warning/10 border-warning/30", icon: AlertTriangle },
  bad: { label: "Desempenho ruim", cls: "text-destructive bg-destructive/10 border-destructive/30", icon: ThumbsDown },
  no_data: { label: "Sem dados suficientes", cls: "text-muted-foreground bg-white/5 border-white/10", icon: HelpCircle },
};

function AIReviewsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAIReviews);
  const campsFn = useServerFn(adminListCampaigns);
  const reviewFn = useServerFn(aiReviewCampaign);

  const reviewsQ = useQuery({
    queryKey: ["admin-ai-reviews"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  // Precisa da lista de campanhas pra oferecer "reavaliar" nas que ainda não têm review nenhuma.
  const campsQ = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => campsFn(),
  });

  const reviewMut = useMutation({
    mutationFn: (campaignId: string) => reviewFn({ data: { campaign_id: campaignId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ai-reviews"] });
      toast.success("Análise concluída");
    },
    onError: (e) => toast.error("Falha na análise", { description: String(e) }),
  });

  const reviewedIds = new Set((reviewsQ.data ?? []).map((r) => r.campaign_id));
  const linkedCampaigns = (campsQ.data ?? []).filter((c) => c.meta_campaign_id);
  const neverReviewed = linkedCampaigns.filter((c) => !reviewedIds.has(c.id));

  // Agrupa por campanha: uma caixinha por campanha, com a análise mais recente
  // no topo e o histórico dela dentro — em vez de várias entradas soltas.
  type AIReview = NonNullable<typeof reviewsQ.data>[number];
  const grouped = (() => {
    const map = new Map<string, AIReview[]>();
    for (const r of reviewsQ.data ?? []) {
      const arr = map.get(r.campaign_id) ?? [];
      arr.push(r);
      map.set(r.campaign_id, arr);
    }
    return Array.from(map.entries())
      .map(([campaign_id, reviews]) => ({
        campaign_id,
        reviews: [...reviews].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      }))
      .sort((a, b) => (a.reviews[0].created_at < b.reviews[0].created_at ? 1 : -1));
  })();

  const counts = {
    good: grouped.filter((g) => g.reviews[0].verdict === "good").length,
    warn: grouped.filter((g) => g.reviews[0].verdict === "warn").length,
    bad: grouped.filter((g) => g.reviews[0].verdict === "bad").length,
  };


  return (
    <div className="space-y-6">
      <section className="glass-strong rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">IA de Métricas</p>
            <p className="text-xs text-muted-foreground">
              Analisa cada campanha automaticamente a cada 3h e aponta o que está bom ou precisa de ajuste.
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/30">{counts.good} bem</span>
          <span className="px-2.5 py-1 rounded-full bg-warning/10 text-warning border border-warning/30">{counts.warn} atenção</span>
          <span className="px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/30">{counts.bad} ruim</span>
        </div>
      </section>

      {neverReviewed.length > 0 && (
        <section className="glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">
            {neverReviewed.length} campanha(s) vinculada(s) ao Meta ainda sem nenhuma análise:
          </p>
          <div className="flex flex-wrap gap-2">
            {neverReviewed.map((c) => (
              <Button
                key={c.id}
                variant="glass"
                size="sm"
                disabled={reviewMut.isPending}
                onClick={() => reviewMut.mutate(c.id)}
              >
                {reviewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Analisar "{c.name}"
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="glass-strong rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-semibold">Análises por campanha</h2>
          <p className="text-xs text-muted-foreground">
            Uma caixinha por campanha: mostra a avaliação atual e, abaixo, as atualizações recentes dela.
          </p>
        </div>
        {reviewsQ.isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : !grouped.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma análise ainda. Vincule campanhas ao Meta e aguarde o próximo ciclo, ou analise manualmente acima.
          </div>
        ) : (
          <div className="p-4 grid gap-4 md:grid-cols-2">
            {grouped.map((g) => {
              const latest = g.reviews[0];
              const meta = verdictMeta[latest.verdict];
              const Icon = meta.icon;
              return (
                <div key={g.campaign_id} className="glass rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border shrink-0 ${meta.cls}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      <p className="font-medium truncate">{latest.campaign_name ?? g.campaign_id.slice(0, 8)}</p>
                    </div>
                    <Button
                      variant="glass"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={reviewMut.isPending}
                      onClick={() => reviewMut.mutate(g.campaign_id)}
                    >
                      <RefreshCw className="h-3 w-3" /> Reavaliar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Atualizado em {new Date(latest.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm">{latest.summary}</p>
                  {latest.recommendations.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                      {latest.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                  )}
                  {g.reviews.length > 1 && (
                    <details className="pt-1">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer">
                        Atualizações anteriores ({g.reviews.length - 1})
                      </summary>
                      <div className="mt-2 space-y-2 border-l border-white/10 pl-3">
                        {g.reviews.slice(1, 6).map((r) => (
                          <div key={r.id} className="text-[11px]">
                            <span className="text-muted-foreground">
                              {new Date(r.created_at).toLocaleString("pt-BR")} · {verdictMeta[r.verdict].label}
                            </span>
                            <p>{r.summary}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

// ============ Item 14 UI: Auditoria de vínculos Meta ============
function MetaAuditSection() {
  const fn = useServerFn(adminListMetaLinkAudit);
  const q = useQuery({
    queryKey: ["admin-meta-audit"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <section className="glass-strong rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Auditoria de vínculos Meta</h2>
          <p className="text-xs text-muted-foreground">Todo vínculo/troca de ID de campanha ou conta de anúncios fica registrado aqui.</p>
        </div>
      </div>
      {q.isLoading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : !(q.data ?? []).length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {(q.data ?? []).map((r: MetaLinkAuditRow) => (
            <div key={r.id} className="p-4 text-sm space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.campaign_name ?? r.campaign_id.slice(0, 8)}</p>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alterado por <span className="text-foreground">{r.changed_by_email ?? "sistema"}</span>
              </p>
              {(r.old_meta_campaign_id || r.new_meta_campaign_id) && (
                <p className="text-xs font-mono">
                  Campanha: <span className="text-muted-foreground">{r.old_meta_campaign_id ?? "—"}</span>
                  {" → "}
                  <span className="text-primary">{r.new_meta_campaign_id ?? "—"}</span>
                </p>
              )}
              {(r.old_meta_ad_account_id || r.new_meta_ad_account_id) && (
                <p className="text-xs font-mono">
                  Conta: <span className="text-muted-foreground">{r.old_meta_ad_account_id ?? "—"}</span>
                  {" → "}
                  <span className="text-primary">{r.new_meta_ad_account_id ?? "—"}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
