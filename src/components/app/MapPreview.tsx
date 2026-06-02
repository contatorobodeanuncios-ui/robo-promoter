interface Props {
  city: string;
  neighborhood: string;
  radius: number; // km
  className?: string;
}

/**
 * Preview do mapa usando Google Maps Embed (sem chave necessária).
 * Mostra a região do anúncio com o raio (km) sobreposto como legenda.
 */
export function MapPreview({ city, neighborhood, radius, className = "" }: Props) {
  const r = Math.max(1, Math.min(80, radius || 1));
  const query = [neighborhood, city].filter(Boolean).join(", ") || "Brasil";
  // Zoom aproximado a partir do raio (km): raio menor = zoom maior
  const zoom = Math.max(8, Math.min(15, Math.round(15 - Math.log2(r))));
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 ${className}`}
    >
      <iframe
        title={`Mapa de ${query}`}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="absolute inset-0 h-full w-full"
        style={{ border: 0, filter: "saturate(0.9) contrast(1.05)" }}
        allowFullScreen
      />
      {/* Anel de raio sobreposto */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/70"
        style={{
          width: `${Math.min(70, 18 + Math.log(r) / Math.log(80) * 50)}%`,
          aspectRatio: "1 / 1",
          boxShadow: "0 0 24px oklch(0.65 0.2 265 / 0.45) inset, 0 0 18px oklch(0.65 0.2 265 / 0.45)",
          background:
            "radial-gradient(circle, oklch(0.65 0.2 265 / 0.18) 0%, oklch(0.65 0.2 265 / 0.05) 60%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between text-[11px]">
        <span className="glass rounded-md px-2 py-1 backdrop-blur-md">
          📍 {neighborhood || "Bairro"}{city ? `, ${city}` : ""}
        </span>
        <span className="glass rounded-md px-2 py-1 backdrop-blur-md text-primary font-medium">
          raio {r} km
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-muted-foreground glass rounded-md px-2 py-1">
        Área de segmentação · Google Maps
      </div>
    </div>
  );
}
