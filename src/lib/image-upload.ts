const TARGET_BYTES = 3.5 * 1024 * 1024;
const MAX_EDGE = 4096;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível preparar esta imagem."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível otimizar esta imagem.")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Mantém imagens pequenas intactas. Imagens grandes são redimensionadas e
 * recomprimidas antes da rede, evitando os limites de corpo dos proxies e
 * reduzindo drasticamente falhas em conexões móveis.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= TARGET_BYTES) return file;

  const image = await loadImage(file);
  let scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.88;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= TARGET_BYTES) break;
    if (quality > 0.62) quality -= 0.1;
    else scale *= 0.78;
  }

  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "criativo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

export function createUploadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}