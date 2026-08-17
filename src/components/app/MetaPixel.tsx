import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaPixelId } from "@/lib/data.functions";
import { fbTrack, fbTrackOnce, loadPixel } from "@/lib/fbq";

/**
 * Carrega o Meta Pixel uma única vez por carregamento real de página,
 * usando o ID salvo pelo admin. Sem ID configurado → não faz nada.
 */
export function MetaPixel() {
  const fn = useServerFn(getMetaPixelId);
  const { data } = useQuery({
    queryKey: ["meta-pixel-id"],
    queryFn: () => fn(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const pixelId = data?.pixel_id ?? "";

  useEffect(() => {
    if (!pixelId) return;
    const w = window as unknown as { __fbPixelBooted?: boolean };
    if (w.__fbPixelBooted) return;
    w.__fbPixelBooted = true;
    loadPixel(pixelId);
    fbTrack("PageView");
    fbTrackOnce("Lead", "fb_lead_tracked");
  }, [pixelId]);

  return null;
}
