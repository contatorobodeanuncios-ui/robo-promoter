import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, MessageCircle, Sparkles, X, Loader2, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { getProMaxLinks, refineCopy } from "@/lib/promax.functions";

const itemClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all text-muted-foreground hover:text-foreground hover:bg-white/5";

/** Itens exclusivos do plano Pro Max no menu lateral. */
export function ProMaxMenu({ compact = false }: { compact?: boolean }) {
  const plan = useAppStore((s) => s.plan);
  const [copyOpen, setCopyOpen] = useState(false);
  const { data: links } = useQuery({
    queryKey: ["promax-links"],
    queryFn: () => getProMaxLinks(),
    enabled: plan === "pro_max",
    staleTime: 300_000,
  });

  if (plan !== "pro_max") return null;

  const schoolUrl = links?.seller_school_url;
  const waUrl = links?.whatsapp_url;

  return (
    <>
      <div className={compact ? "" : "mt-4 border-t border-white/5 pt-4"}>
        {!compact && (
          <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-[#e6b422]">Pro Max</p>
        )}
        <div>
          <a
            href={schoolUrl || "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!schoolUrl) {
                e.preventDefault();
                toast.info("O link da Seller School ainda não foi configurado.");
              }
            }}
            className={itemClass}
          >
            <GraduationCap className="h-4 w-4" /> Seller School
          </a>
          {!schoolUrl && <SoonTag />}
        </div>
        <button type="button" onClick={() => setCopyOpen(true)} className={`${itemClass} w-full`}>
          <Sparkles className="h-4 w-4" /> Copy Inteligente
        </button>
        <div>
          <a
            href={waUrl || "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!waUrl) {
                e.preventDefault();
                toast.info("O WhatsApp de suporte ainda não foi configurado.");
              }
            }}
            className={itemClass}
          >
            <MessageCircle className="h-4 w-4" /> Suporte WhatsApp
          </a>
          {!waUrl && <SoonTag />}
        </div>
      </div>
      {copyOpen && <CopyModal onClose={() => setCopyOpen(false)} />}
    </>
  );
}

/** Tag sutil "Em breve" — some sozinha quando o link é cadastrado. */
function SoonTag() {
  return (
    <span className="ml-3 inline-block rounded-full border border-[#e6b422]/40 px-1.5 py-[1px] text-[9px] leading-none text-[#e6b422]/80">
      Em breve
    </span>
  );
}

const GOLD = "#e6b422";

/**
 * Itens do Pro Max no rodapé (somente mobile) — mesma barra do Dashboard e
 * Configurações, com cor dourada para diferenciar.
 */
export function ProMaxBottomNavItems() {
  const plan = useAppStore((s) => s.plan);
  const [copyOpen, setCopyOpen] = useState(false);
  const { data: links } = useQuery({
    queryKey: ["promax-links"],
    queryFn: () => getProMaxLinks(),
    enabled: plan === "pro_max",
    staleTime: 300_000,
  });

  if (plan !== "pro_max") return null;

  const base = "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] min-w-0 relative";
  const schoolUrl = links?.seller_school_url;
  const waUrl = links?.whatsapp_url;

  return (
    <>
      <a
        href={schoolUrl || "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!schoolUrl) {
            e.preventDefault();
            toast.info("O link da Seller School ainda não foi configurado.");
          }
        }}
        className={base}
        style={{ color: GOLD }}
      >
        <GraduationCap className="h-5 w-5 shrink-0" />
        <span className="truncate max-w-full px-1">School</span>
        {!schoolUrl && <span className="text-[8px] opacity-70 leading-none">Em breve</span>}
      </a>
      <button type="button" onClick={() => setCopyOpen(true)} className={base} style={{ color: GOLD }}>
        <Sparkles className="h-5 w-5 shrink-0" />
        <span className="truncate max-w-full px-1">Copy</span>
      </button>
      <a
        href={waUrl || "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!waUrl) {
            e.preventDefault();
            toast.info("O WhatsApp de suporte ainda não foi configurado.");
          }
        }}
        className={base}
        style={{ color: GOLD }}
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span className="truncate max-w-full px-1">WhatsApp</span>
        {!waUrl && <span className="text-[8px] opacity-70 leading-none">Em breve</span>}
      </a>
      {copyOpen && <CopyModal onClose={() => setCopyOpen(false)} />}
    </>
  );
}

interface CopyResult {
  headline: string;
  copy: string;
  cta: string;
  tips: string[];
}

export function CopyModal({
  onClose,
  initialText = "",
  onApply,
}: {
  onClose: () => void;
  initialText?: string;
  onApply?: (r: CopyResult) => void;
}) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);

  const run = async () => {
    if (text.trim().length < 5) {
      toast.error("Escreva um texto um pouco maior para a IA refinar.");
      return;
    }
    setLoading(true);
    try {
      const r = await refineCopy({ data: { text: text.trim() } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível refinar agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 p-0 md:p-6">
      <div className="glass-strong w-full md:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#e6b422]" /> Copy Inteligente
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cole seu texto e a IA devolve uma versão mais persuasiva, sem erros e com CTA.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Ex: Pizzaria com promoção de terça, 2 pizzas grandes por 59,90..."
          className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-primary to-accent disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Refinar texto
        </button>

        {result && (
          <div className="mt-4 space-y-3">
            <Field label="Título" value={result.headline} />
            <Field label="Texto do anúncio" value={result.copy} multiline />
            <Field label="Chamada final (CTA)" value={result.cta} />
            {result.tips.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                {result.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            {onApply && (
              <button
                type="button"
                onClick={() => {
                  onApply(result);
                  onClose();
                }}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-primary to-accent"
              >
                Usar este texto no anúncio
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copiado");
          }}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground"
          aria-label={`Copiar ${label}`}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className={`mt-1 text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}
