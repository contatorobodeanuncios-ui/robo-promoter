import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Globe,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Robô de Lucro" },
      { name: "description", content: "Gerencie sua conta, saldo e preferências do Robô de Lucro." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const balance = useAppStore((s) => s.balance);
  const wipeAll = useAppStore((s) => s.wipeAll);
  const nav = useNavigate();

  const [name, setName] = useState("Lucas");
  const [email, setEmail] = useState("lucas@empresa.com");
  const [whats, setWhats] = useState("");
  const [notifyDaily, setNotifyDaily] = useState(true);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [aiAuto, setAiAuto] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const save = () => toast.success("Preferências salvas");

  const goPay = (amount: number) => {
    if (amount < 20) {
      toast.error("Valor mínimo R$ 20");
      return;
    }
    nav({ to: "/payment", search: { topup: Math.round(amount) } });
  };

  const handleWipe = () => {
    if (confirmText !== "APAGAR") {
      toast.error("Digite APAGAR para confirmar.");
      return;
    }
    if (!window.confirm(
      "ATENÇÃO: ao apagar TODAS as campanhas você PERDE imediatamente o valor já investido nos anúncios do Facebook. " +
      "O dinheiro pago à Meta NÃO volta. Seu saldo no app (não gasto) é preservado. " +
      "Tem certeza absoluta que deseja continuar?"
    )) {
      return;
    }
    wipeAll();
    setConfirmText("");
    toast.success("Campanhas removidas.", { description: "Seu saldo no app foi preservado." });
    nav({ to: "/dashboard" });
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <header>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Sua conta
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      </header>

      {/* Saldo */}
      <section className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" /> Saldo atual
            </p>
            <p className="text-4xl font-bold text-gradient tabular-nums">
              R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O saldo só é creditado após a confirmação do pagamento no Asaas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {[20, 50, 100, 250, 500].map((v) => (
              <Button key={v} variant="glass" size="sm" onClick={() => goPay(v)}>
                <Plus className="h-3.5 w-3.5" /> R$ {v}
              </Button>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={20}
                placeholder="Outro (mín R$ 20)"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="h-9 w-40"
              />
              <Button variant="neon" size="sm" onClick={() => goPay(Number(customAmount) || 0)}>
                Pagar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Perfil */}
      <section className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <User2 className="h-4 w-4 text-primary" /> Perfil
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>WhatsApp para alertas</Label>
            <Input placeholder="(11) 99999-9999" value={whats} onChange={(e) => setWhats(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Notificações */}
      <section className="glass rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Notificações
        </h2>
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <p className="text-sm">Resumo diário do robô</p>
            <p className="text-xs text-muted-foreground">Receba um resumo das campanhas todo dia às 9h.</p>
          </div>
          <Switch checked={notifyDaily} onCheckedChange={setNotifyDaily} />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <p className="text-sm">Alertas críticos</p>
            <p className="text-xs text-muted-foreground">Avisar imediatamente quando uma campanha ficar fora da meta.</p>
          </div>
          <Switch checked={notifyAlerts} onCheckedChange={setNotifyAlerts} />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm">IA otimiza automaticamente</p>
            <p className="text-xs text-muted-foreground">Permite o robô ajustar lances e segmentações sem aprovação.</p>
          </div>
          <Switch checked={aiAuto} onCheckedChange={setAiAuto} />
        </div>
      </section>

      {/* Idioma / região */}
      <section className="glass rounded-2xl p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Região
          </h2>
          <p className="text-xs text-muted-foreground">Português (Brasil) · Real (BRL)</p>
        </div>
        <Button variant="glass" onClick={save}><Save /> Salvar preferências</Button>
      </section>

      {/* Zona de perigo */}
      <section className="rounded-2xl p-6 border-2 border-destructive/60 bg-destructive/10 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="font-semibold text-destructive">Zona de perigo — leia antes de clicar</h2>
        </div>
        <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-4 text-sm text-destructive space-y-2">
          <p className="font-bold uppercase tracking-wide">
            ⚠ AVISO OBRIGATÓRIO
          </p>
          <p>
            Apagar suas campanhas <strong>encerra anúncios ativos no Facebook</strong> e você
            <strong> PERDE TODO o valor já investido nesses anúncios</strong> (o dinheiro pago à
            Meta <u>não é reembolsado</u>).
          </p>
          <p>
            Seu <strong>saldo no app (não gasto)</strong> NÃO é apagado — ele permanece na sua
            carteira e só pode sair via gasto em campanha.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Digite <span className="font-mono font-semibold text-foreground">APAGAR</span> para liberar o botão abaixo.
        </p>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          placeholder="Digite APAGAR"
          className="max-w-xs border-destructive/40"
        />
        <Button
          onClick={handleWipe}
          disabled={confirmText !== "APAGAR"}
          className="w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive shadow-[0_0_24px_oklch(0.6_0.22_25/0.6)] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Apagar campanhas (mantém saldo)
        </Button>
      </section>
    </div>
  );
}