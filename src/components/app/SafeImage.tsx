import { useState } from "react";
import { ImageOff } from "lucide-react";

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  fallbackClassName?: string;
}

/**
 * Renderiza uma imagem com fallback visual quando o src é inválido ou falha
 * ao carregar. Evita o "ícone de imagem quebrada" do navegador.
 */
export function SafeImage({ src, alt = "", className, fallbackClassName, ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  const hasSrc = typeof src === "string" && src.trim().length > 0;

  if (!hasSrc || failed) {
    return (
      <div
        className={
          fallbackClassName ??
          `${className ?? ""} grid place-items-center bg-white/5 text-muted-foreground`
        }
        aria-label={alt || "imagem indisponível"}
      >
        <ImageOff className="h-5 w-5 opacity-60" />
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={src as string}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
