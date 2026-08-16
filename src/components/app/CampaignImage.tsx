import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCreativeSignedUrls } from "@/lib/data.functions";
import { SafeImage } from "./SafeImage";

interface MediaLike {
  path?: string | null;
  kind?: string | null;
}

/**
 * O bucket "campaign-creatives" é PRIVADO — a URL pública gerada pelo
 * getPublicUrl() não carrega (imagem quebrada). Aqui descobrimos o caminho no
 * Storage a partir do que foi salvo na campanha (caminho novo, URL pública
 * antiga ou o primeiro item de mídia) para depois assinar esse caminho.
 */
export function creativeStoragePath(
  image?: string | null,
  media?: MediaLike[] | null,
): string | null {
  const first = (media ?? []).find((m) => m?.path && m.kind !== "video");
  if (first?.path) return first.path;

  const v = (image ?? "").trim();
  if (!v) return null;
  if (v.startsWith("creatives/")) return v;
  const marker = "/campaign-creatives/";
  const i = v.indexOf(marker);
  if (i >= 0) {
    const raw = v.slice(i + marker.length).split("?")[0];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** URL assinada (1h) do criativo do próprio usuário. */
export function useCreativeUrl(image?: string | null, media?: MediaLike[] | null) {
  const signFn = useServerFn(getMyCreativeSignedUrls);
  const path = creativeStoragePath(image, media);
  const q = useQuery({
    queryKey: ["creative-url", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    retry: 2,
    queryFn: async () => {
      const { urls } = await signFn({ data: { paths: [path as string] } });
      return urls[path as string] ?? null;
    },
  });
  // Sem caminho no Storage (ex.: data URL ou imagem externa antiga) → usa o
  // valor salvo direto.
  if (!path) return { url: image ?? null, isLoading: false };
  return { url: q.data ?? null, isLoading: q.isLoading };
}

interface Props {
  image?: string | null;
  media?: MediaLike[] | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

/** Imagem do criativo com URL assinada, estado de carregamento e fallback. */
export function CampaignImage({ image, media, alt = "", className, fallbackClassName }: Props) {
  const { url, isLoading } = useCreativeUrl(image, media);

  if (isLoading) {
    return (
      <div
        className={fallbackClassName ?? `${className ?? ""} bg-white/5 animate-pulse`}
        aria-label="carregando imagem"
      />
    );
  }

  return (
    <SafeImage
      src={url}
      alt={alt}
      className={className}
      fallbackClassName={fallbackClassName}
    />
  );
}
