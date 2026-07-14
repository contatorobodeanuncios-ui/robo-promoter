import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  adminListAccessRequests,
  adminApproveAccessRequest,
  adminDenyAccessRequest,
  type AdminCampaignRow,
} from "@/lib/admin.functions";

import {
  getPaymentSettings,
  setAsaasConfig,
  setManualPixConfig,
  setPaymentConfirmMode,
  adminListPayments,
  adminApprovePayment,
  adminRejectPayment,
} from "@/lib/payment.functions";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Zap, Hand, Eye, X, Rocket, Loader2, Link2, Check, Ban, CreditCard, AlertTriangle, Trash2, PowerOff, UserPlus, Copy } from "lucide-react";

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

  const [preview, setPreview] = useState<AdminCampaignRow | null>(null);
  const [asaasLink, setAsaasLink] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);

  useEffect(() => {
    if (paySettingsQuery.data) {
      setAsaasLink(paySettingsQuery.data.asaas.link_template || "");
      setApiKeySet(!!paySettingsQuery.data.asaas.api_key_set);
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
    mutationFn: () => setAsaasFn({ data: { link_template: asaasLink.trim(), api_key_set: apiKeySet } }),
    onSuccess: () => {
      toast.success("Configuração do Asaas salva");
      qc.invalidateQueries({ queryKey: ["pay-settings"] });
    },
    onError: (e) => toast.error("Falha ao salvar Asaas", { description: String(e) }),
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
      toast.success("Pagamento aprovado e saldo creditado");
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
          <Link to="/admin-support" className="text-xs px-3 py-2 rounded-lg glass hover:bg-white/5">💬 Suporte</Link>
          <Link to="/admin-audit" className="text-xs px-3 py-2 rounded-lg glass hover:bg-white/5">📜 Auditoria</Link>
        </nav>
      </header>

      <MetaHealthCard />
      <ExportCsvButton />

      <AccessRequestsSection />



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
            <h2 className="font-semibold">Asaas — Link de pagamento</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole o link base de cobrança do Asaas. Use os marcadores{" "}
            <code className="text-primary">{"{amount}"}</code> ou{" "}
            <code className="text-primary">{"{value}"}</code> para substituir o valor da cobrança.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Link/Template do Asaas</Label>
            <Input
              placeholder="https://www.asaas.com/c/SEU-LINK?value={amount}"
              value={asaasLink}
              onChange={(e) => setAsaasLink(e.target.value)}
            />
          </div>
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
            Salvar link
          </Button>
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
          <div className="text-[11px] text-muted-foreground glass rounded p-2 font-mono break-all">
            URL do webhook: <span className="text-primary">/api/public/asaas-webhook</span>
          </div>
        </div>
      </section>

      {/* Pagamentos pendentes */}
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
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Link Asaas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paymentsQuery.data.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.client_name ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{p.user_id.slice(0, 8)}</p>
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

      {/* Campaigns table */}
      <section className="glass-strong rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold">Campanhas dos Clientes</h2>
          <span className="text-xs text-muted-foreground">
            {campaignsQuery.data?.length ?? 0} no total
          </span>
        </div>
        {campaignsQuery.isLoading ? (
          <div className="p-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : !campaignsQuery.data?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma campanha ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Campanha</th>
                  <th className="px-4 py-3 text-right">Orçamento</th>
                  <th className="px-4 py-3 text-center">Dias</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Datas</th>
                  <th className="px-4 py-3">ID da campanha no Meta</th>
                  <th className="px-4 py-3">Link cobrança</th>
                  <th className="px-4 py-3">Métricas Reais (Meta)</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaignsQuery.data.map((c) => {
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
                    <tr key={c.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${rowCls}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.client_name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{c.client_email ?? c.user_id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{c.headline}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtBRL(c.budget)}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.days}</td>
                      <td className="px-4 py-3">
                        <select
                          value={c.status}
                          onChange={(e) =>
                            statusMutation.mutate({
                              id: c.id,
                              status: e.target.value as "running" | "analyzing" | "paused",
                            })
                          }
                          className="bg-background border border-white/10 rounded-md px-2 py-1 text-xs"
                        >
                          <option value="analyzing">⏳ Em Análise</option>
                          <option value="running">🟢 Ativo</option>
                          <option value="paused">🔴 Desativado</option>
                          <option value="aguardando_vinculo_meta">💰 Aguardando pagamento</option>
                          <option value="encerrada_saldo_consumido">⛔ Encerrada</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground space-y-0.5 min-w-[160px]">
                        <div>Criada: <span className="text-foreground">{fmtDate(c.created_at)}</span></div>
                        <div>Iniciou: <span className="text-foreground">{fmtDate(c.started_running_at)}</span></div>
                        <div>Pausada: <span className="text-foreground">{fmtDate(c.paused_at)}</span></div>
                        <div>Encerrada: <span className="text-foreground">{fmtDate(c.ended_at)}</span></div>
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <MetaCampaignIdCell id={c.id} value={c.meta_campaign_id} />
                      </td>
                      <td className="px-4 py-3">
                        {c.invoice_url ? (
                          <div className="flex items-center gap-1">
                            <a href={c.invoice_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline truncate inline-block max-w-[180px]">
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
                          <span className="text-[11px] text-muted-foreground italic">
                            {isPending && c.funding_type === "pix_dedicated" ? "sem cobrança" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-1 text-[10px] min-w-[260px]">
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="glass" size="sm" onClick={() => setPreview(c)} title="Pré-visualizar anúncio">
                            <Eye className="h-3.5 w-3.5" /> Prévia
                          </Button>
                          <Button
                            variant="neon"
                            size="sm"
                            disabled={c.status === "running" || statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: c.id, status: "running" })}
                          >
                            <Rocket className="h-3.5 w-3.5" /> Ativar
                          </Button>
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

      {preview && <FbPreview campaign={preview} onClose={() => setPreview(null)} />}
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
      toast.success(r.meta_campaign_id ? "Vinculado ao Meta — entrará no próximo sync" : "Vínculo removido");
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

function FbPreview({ campaign, onClose }: { campaign: AdminCampaignRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-[#18191a] rounded-xl max-w-md w-full overflow-hidden border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-xs text-white/60">Prévia · Facebook Feed</span>
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
          <p className="px-3 pb-3 text-sm">{campaign.copy || campaign.headline}</p>
          {campaign.image && (
            <img src={campaign.image} alt="" className="w-full aspect-square object-cover bg-black" />
          )}
          <div className="px-3 py-2 bg-[#3a3b3c] flex items-center justify-between">
            <div className="text-xs">
              <p className="uppercase text-white/50 text-[10px]">
                {safeHostname(campaign.link)}
              </p>
              <p className="font-semibold text-sm">{campaign.headline || campaign.name}</p>
            </div>
            <button className="bg-[#4e4f50] hover:bg-[#5a5b5c] text-white text-xs font-semibold px-3 py-1.5 rounded">
              Saiba mais
            </button>
          </div>
        </div>
      </div>
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
  const pending = (q.data ?? []).filter((r) => r.status === "pending");
  return (
    <section className="glass-strong rounded-2xl overflow-hidden border border-primary/20">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Solicitações de Acesso</h2>
        </div>
        <span className="text-xs text-muted-foreground">{pending.length} aguardando</span>
      </div>
      {q.isLoading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : !(q.data ?? []).length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação registrada.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {(q.data ?? []).map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.display_name ?? "(sem nome)"}</p>
                <p className="text-[11px] text-muted-foreground">{r.email ?? r.user_id.slice(0, 8)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                  {r.reviewed_at && r.status !== "pending" && ` · revisado em ${new Date(r.reviewed_at).toLocaleString("pt-BR")}`}
                </p>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
