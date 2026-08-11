import { Coins, Crown, Sparkles, Timer } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { KIWIFY_PRO_CHECKOUT } from "@/lib/pricing";

function UpgradeButton() {
  return (
    <a
      href={KIWIFY_PRO_CHECKOUT}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#2b1c00] bg-gradient-to-r from-[#f7d774] via-[#e6b422] to-[#c9971b] shadow-[0_0_24px_-6px_#e6b422] hover:brightness-110 transition"
    >
      <Crown className="h-4 w-4" /> ADQUIRIR PRO
    </a>
  );
}

/** Banner fixo no topo do dashboard mostrando o nível do usuário. */
export function PlanBanner() {
  const plan = useAppStore((s) => s.plan);
  const daysLeft = useAppStore((s) => s.trialDaysLeft);

  if (plan === "credits") {
    return (
      <div className="glass rounded-2xl px-5 py-4 border border-violet-400/40 bg-violet-500/5 flex flex-wrap items-center gap-3">
        <Coins className="h-5 w-5 text-violet-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Você está no plano CRÉDITOS</p>
          <p className="text-xs text-muted-foreground">
            Compre pacotes de dias + visualizações. 1 crédito = 24h do robô rodando seu anúncio,
            sem honorários de gestor e sem taxas extras.
          </p>
        </div>
      </div>
    );
  }

  if (plan === "pro") {
    return (
      <div className="glass rounded-2xl px-5 py-4 border border-[#e6b422]/40 bg-[#e6b422]/5 flex flex-wrap items-center gap-3">
        <Crown className="h-5 w-5 text-[#e6b422]" />
        <p className="text-sm font-semibold">Você está usando a versão PRO</p>
      </div>
    );
  }


  if (plan === "trial_pro") {
    return (
      <div className="glass rounded-2xl px-5 py-4 border border-[#e6b422]/40 bg-[#e6b422]/5 flex flex-wrap items-center gap-3">
        <Timer className="h-5 w-5 text-[#e6b422]" />
        <p className="text-sm font-semibold flex-1 min-w-[200px]">
          Você está usando o modo de teste PRO por {daysLeft} dia{daysLeft === 1 ? "" : "s"}
        </p>
        <UpgradeButton />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl px-5 py-4 border border-white/10 flex flex-wrap items-center gap-3">
      <Sparkles className="h-5 w-5 text-primary" />
      <p className="text-sm font-semibold flex-1 min-w-[200px]">Você está usando a versão FREE</p>
      <UpgradeButton />
    </div>
  );
}
