import { Coins, Crown, Sparkles, Timer, GraduationCap, MessageCircle, BadgeCheck, FileBarChart, Rocket } from "lucide-react";
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

const PRO_MAX_FEATURES = [
  { icon: GraduationCap, label: "Seller School" },
  { icon: Sparkles, label: "Copy Inteligente" },
  { icon: MessageCircle, label: "Suporte WhatsApp" },
  { icon: BadgeCheck, label: "Selo dourado de prioridade" },
  { icon: FileBarChart, label: "Relatórios em imagem" },
  { icon: Rocket, label: "Turbinar Alcance" },
];

/** Banner de upsell para o plano Pro Max, exibido para usuários do plano Créditos. */
function ProMaxUpsellBanner() {
  return (
    <div className="glass-strong rounded-2xl p-5 border border-[#e6b422]/40 bg-gradient-to-br from-[#e6b422]/15 via-transparent to-transparent relative overflow-hidden">
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#e6b422]/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-[#f7d774] to-[#c9971b] shrink-0">
          <Crown className="h-5 w-5 text-[#2b1c00]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#e6b422]">Suba de nível para o PRO MAX</p>
          <p className="text-xs text-muted-foreground">Desbloqueie tudo isso e ainda tenha prioridade na fila de anúncios:</p>
        </div>
        <a
          href={KIWIFY_PRO_CHECKOUT}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#2b1c00] bg-gradient-to-r from-[#f7d774] via-[#e6b422] to-[#c9971b] shadow-[0_0_24px_-6px_#e6b422] hover:brightness-110 transition"
        >
          <Crown className="h-4 w-4" /> QUERO SER PRO MAX
        </a>
      </div>
      <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRO_MAX_FEATURES.map((f) => (
          <div key={f.label} className="flex items-center gap-2 rounded-lg border border-[#e6b422]/20 bg-white/[0.02] px-2.5 py-2 min-w-0">
            <f.icon className="h-3.5 w-3.5 text-[#e6b422] shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Banner fixo no topo do dashboard mostrando o nível do usuário. */
export function PlanBanner() {
  const plan = useAppStore((s) => s.plan);
  const daysLeft = useAppStore((s) => s.trialDaysLeft);

  if (plan === "pro_max") {
    return (
      <div className="glass rounded-2xl px-5 py-4 border border-[#e6b422]/50 bg-gradient-to-r from-[#e6b422]/15 to-transparent flex flex-wrap items-center gap-3">
        <Crown className="h-5 w-5 text-[#e6b422]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-2">
            Você está no plano PRO MAX
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#2b1c00] bg-gradient-to-r from-[#f7d774] to-[#c9971b]">
              PRIORIDADE
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Seller School, Copy Inteligente, suporte no WhatsApp, relatórios, Turbinar Alcance e
            prioridade nas filas — tudo liberado.
          </p>
        </div>
      </div>
    );
  }

  if (plan === "credits") {
    return (
      <div className="space-y-3">
        <ProMaxUpsellBanner />
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
