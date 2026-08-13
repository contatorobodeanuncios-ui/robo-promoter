import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Rocket, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BOOST_PACKAGES } from "@/lib/pricing";
import { createBoost } from "@/lib/promax.functions";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Modal de add-on de visualizações (Turbinar Alcance) — exclusivo Pro Max. */
export function BoostDialog({
  campaignId,
  campaignName,
  onClose,
}: {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const go = async () => {
    setLoading(true);
    try {
      const b = await createBoost({ data: { campaignId, packageIndex: selected } });
      nav({
        to: "/payment",
        search: {
          campaignId,
          boostId: b.id,
          boostAmount: b.amount,
          name: `Turbinar Alcance — ${campaignName}`,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar o turbo.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 p-0 md:p-6">
      <div className="glass-strong w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-[#e6b422]/30 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Rocket className="h-4 w-4 text-[#e6b422]" /> Turbinar Alcance
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          As visualizações extras entram na campanha que já está em andamento, sem reiniciar nada.
        </p>

        <div className="mt-4 grid gap-2">
          {BOOST_PACKAGES.map((p, i) => (
            <button
              key={p.views}
              type="button"
              onClick={() => setSelected(i)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                selected === i
                  ? "border-[#e6b422]/60 bg-[#e6b422]/10"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-semibold">
                +{p.views.toLocaleString("pt-BR")} visualizações
              </span>
              <span className="text-sm font-bold tabular-nums">{fmtBRL(p.price)}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={go}
          disabled={loading}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-[#2b1c00] bg-gradient-to-r from-[#f7d774] via-[#e6b422] to-[#c9971b] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Turbinar por {fmtBRL(BOOST_PACKAGES[selected].price)}
        </button>
      </div>
    </div>
  );
}
