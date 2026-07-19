import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAppStore } from "@/lib/store";
import { getVapidPublicKey, subscribePush, sendTestPush } from "@/lib/push.functions";
import { subscribeToPush } from "@/lib/pwa-register";

const STORAGE_KEY = "rdl_push_prompt_dismissed";

export function PushNotificationBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const runningCount = useAppStore((s) => s.campaigns.filter((c) => c.status === "running").length);

  const getKeyFn = useServerFn(getVapidPublicKey);
  const subscribeFn = useServerFn(subscribePush);
  const testFn = useServerFn(sendTestPush);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    if (runningCount === 0) return;
    setShow(true);
  }, [runningCount]);

  // Corrigido (item 4): antes só pedia permissão do navegador e mostrava uma
  // notificação LOCAL (new Notification(...)) — o que parece funcionar na
  // hora, mas nunca cria uma inscrição de push de verdade. Sem inscrição
  // salva em push_subscriptions, o servidor nunca tem para onde mandar nada:
  // nenhum alerta de métrica, nenhum push diário, nada chega depois que essa
  // notificação de teste local desaparece. Agora o fluxo completo é:
  // Service Worker pronto → PushManager.subscribe (com a chave VAPID real) →
  // salva a inscrição no servidor → dispara um push de teste de verdade
  // (que passa pelo Service Worker, não é local) pra confirmar que fechou o
  // circuito de ponta a ponta.
  const enable = async () => {
    setBusy(true);
    try {
      const { publicKey } = await getKeyFn();
      if (!publicKey) {
        toast.error("Notificações indisponíveis no momento", {
          description: "Chave VAPID não configurada no servidor — avise o suporte.",
        });
        return;
      }
      const sub = await subscribeToPush(publicKey);
      if (!sub) {
        toast.info("Permissão negada ou não suportada neste navegador", {
          description: "Você pode reativar nas configurações do navegador.",
        });
        dismiss();
        return;
      }
      const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Inscrição de push incompleta");
      }
      await subscribeFn({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent,
        },
      });
      const result = await testFn();
      if (result.sent > 0) {
        toast.success("Notificações ativadas de verdade", {
          description: "Enviamos um push de teste real — se ele apareceu, está tudo funcionando.",
        });
      } else {
        toast.warning("Inscrição salva, mas o push de teste não confirmou entrega", {
          description: "Pode levar alguns segundos, ou o navegador pode estar bloqueando em segundo plano.",
        });
      }
      setShow(false);
    } catch (e) {
      toast.error("Não foi possível ativar agora", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="glass-strong rounded-2xl border border-primary/30 p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
        <Bell className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Ative as notificações do Robô</p>
        <p className="text-xs text-muted-foreground">
          Receba alertas com métricas reais das suas {runningCount} campanha(s) ativa(s).
        </p>
      </div>
      <Button variant="neon" size="sm" onClick={enable} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
      </Button>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dispensar" disabled={busy}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
