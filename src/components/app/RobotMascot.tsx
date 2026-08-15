import { X } from "lucide-react";
import { useEffect, useState } from "react";
import robotImg from "@/assets/robot-mascot.jpg";

const SEEN_KEY = "robot_metrics_notice_seen";

export function RobotMascot({
  message = "Olá! Sou o Robô de Lucro. Estou monitorando suas campanhas 24/7.",
  tone = "info",
}: {
  message?: string;
  tone?: "info" | "success" | "warning";
}) {
  // Exibida apenas 1 vez por entrada no app (por sessão do navegador).
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SEEN_KEY)) return;
    } catch { /* ignore */ }
    setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    try { window.sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  if (!open) return null;
  const ring =
    tone === "success" ? "border-success/40" :
    tone === "warning" ? "border-warning/40" : "border-primary/40";
  const dot =
    tone === "success" ? "bg-success" :
    tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/50" onClick={close}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative w-full max-w-sm glass-strong rounded-2xl p-4 pr-9 border ${ring} animate-in zoom-in-95 fade-in shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]`}
    >
      <button
        onClick={() => setOpen(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="relative h-12 w-12 animate-float">
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse-glow" />
            <img
              src={robotImg}
              alt="Robô de Lucro mascote"
              className="relative h-12 w-12 rounded-full object-cover ring-2 ring-primary/60 shadow-[0_0_20px_-2px_oklch(0.65_0.21_265/0.8)]"
            />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${dot} ring-2 ring-background animate-pulse`} />
        </div>
        <div className="text-xs leading-relaxed">
          <p className="font-semibold text-foreground/90">Robô de Lucro · aviso do sistema</p>
          <p className="text-muted-foreground mt-0.5">{message}</p>
        </div>
      </div>
    </div>
  );
}