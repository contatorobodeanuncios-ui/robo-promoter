import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Power, Loader2 } from "lucide-react";
import robotImg from "@/assets/robot-mascot.jpg";

export const Route = createFileRoute("/power-on")({
  head: () => ({
    meta: [
      { title: "Ligar Robô — Robô de Lucro" },
      { name: "description", content: "Inicialize seu robô de automação de anúncios." },
    ],
  }),
  component: PowerOnPage,
});

const BOOT_STEPS = [
  "Inicializando núcleo neural…",
  "Conectando ao Facebook Ads…",
  "Carregando módulos de IA…",
  "Calibrando segmentação inteligente…",
  "Robô pronto para decolar 🚀",
];

function playStartupSound() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Rising synth sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 1.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.5);

    // Confirmation beeps
    [0.6, 0.85, 1.1].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 660 + i * 220;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + 0.25);
    });

    setTimeout(() => ctx.close(), 2200);
  } catch {
    /* ignore */
  }
}

function PowerOnPage() {
  const nav = useNavigate();
  const [booting, setBooting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Auto-start animation when arriving (e.g., right after Google login)
  useEffect(() => {
    const t = setTimeout(() => start(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (booting) return;
    setBooting(true);
    playStartupSound();

    const total = 3200;
    const tick = 40;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += tick;
      const p = Math.min(100, (elapsed / total) * 100);
      setProgress(p);
      setStep(Math.min(BOOT_STEPS.length - 1, Math.floor((p / 100) * BOOT_STEPS.length)));
      if (p >= 100) {
        clearInterval(interval);
        timers.current.push(setTimeout(() => nav({ to: "/dashboard" }), 500));
      }
    }, tick);
  };

  return (
    <div className="relative min-h-screen overflow-hidden grid-bg flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[60vh] w-[60vh] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, oklch(0.65 0.21 265 / 0.6), transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md text-center space-y-8">
        <div className="relative mx-auto" style={{ width: 240, height: 240 }}>
          {/* halo */}
          <div
            className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-500 ${booting ? "opacity-100" : "opacity-60"}`}
            style={{ background: "radial-gradient(circle, oklch(0.65 0.21 265 / 0.7), transparent 65%)" }}
          />
          {/* rotating rings */}
          <div
            className="absolute inset-2 rounded-full border-2 border-dashed border-primary/50"
            style={{ animation: `spin ${booting ? "1.2s" : "8s"} linear infinite` }}
          />
          <div
            className="absolute inset-6 rounded-full border border-accent/40"
            style={{ animation: `spin ${booting ? "1.8s" : "12s"} linear infinite reverse` }}
          />
          {/* core */}
          <div className="absolute inset-10 rounded-full overflow-hidden ring-2 ring-primary/60 shadow-[0_0_60px_-5px_oklch(0.65_0.21_265/0.7)]">
            <img
              src={robotImg}
              alt="Robô de Lucro"
              className={`h-full w-full object-cover ${booting ? "animate-pulse-glow" : "animate-float"}`}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 mix-blend-overlay" />
            {booting && (
              <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/40 to-transparent animate-scan" />
            )}
          </div>
        </div>

        {!booting ? (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Sistema em standby
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Pronto para <span className="text-gradient">decolar</span>?
              </h1>
              <p className="text-sm text-muted-foreground">
                Inicialize o Robô de Lucro para acessar seu painel de automação.
              </p>
            </div>
            <Button
              variant="neon"
              className="h-14 px-10 text-base rounded-full shadow-[0_0_40px_-5px_oklch(0.65_0.21_265/0.8)]"
              onClick={start}
            >
              <Power className="mr-2 h-5 w-5" />
              Ligar Robô agora
            </Button>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Carregando robô…
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground min-h-[1.25rem]">{BOOT_STEPS[step]}</p>
          </div>
        )}
      </div>
    </div>
  );
}