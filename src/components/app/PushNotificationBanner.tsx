import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

const STORAGE_KEY = "rdl_push_prompt_dismissed";

export function PushNotificationBanner() {
  const [show, setShow] = useState(false);
  const runningCount = useAppStore((s) => s.campaigns.filter((c) => c.status === "running").length);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // Só pede permissão quando há ao menos uma campanha rodando
    if (runningCount === 0) return;
    setShow(true);
  }, [runningCount]);

  const enable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        toast.success("Notificações ativadas", {
          description: "Você será avisado com dados reais quando o Facebook reportar métricas das suas campanhas.",
        });
        new Notification("🤖 Robô de Lucro", {
          body: `Monitorando ${runningCount} campanha(s) ativa(s). Você receberá alertas com métricas reais do Facebook/Pixel.`,
        });
        setShow(false);
      } else {
        toast.info("Permissão negada", { description: "Você pode reativar nas configurações do navegador." });
        dismiss();
      }
    } catch (e) {
      toast.error("Não foi possível ativar agora");
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
      <Button variant="neon" size="sm" onClick={enable}>
        Ativar
      </Button>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dispensar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
