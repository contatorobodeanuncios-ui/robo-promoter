// Helpers do Meta Pixel. Se o Pixel não estiver configurado, tudo vira no-op
// silencioso (sem erros no console).

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: unknown };
    _fbq?: unknown;
  }
}

export function loadPixel(pixelId: string) {
  if (typeof window === "undefined" || !pixelId) return;
  if (window.fbq) return;
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("init", pixelId);
}

export function fbTrack(event: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.fbq) {
    console.warn(`[MetaPixel] fbq indisponível — evento "${event}" não enviado (Pixel ID configurado no admin?).`);
    return false;
  }
  window.fbq("track", event);
  console.log(`[MetaPixel] evento enviado: ${event}`);
  return true;
}

/**
 * Dispara o evento assim que o fbq existir (o snippet cria o stub de fila
 * imediatamente, mas o ID do Pixel vem de uma consulta assíncrona).
 */
export function fbTrackWhenReady(event: string, timeoutMs = 4000) {
  if (typeof window === "undefined") return;
  if (fbTrack(event)) return;
  const start = Date.now();
  const t = setInterval(() => {
    if (window.fbq) {
      clearInterval(t);
      fbTrack(event);
    } else if (Date.now() - start > timeoutMs) {
      clearInterval(t);
      console.warn(`[MetaPixel] timeout aguardando fbq — evento "${event}" perdido.`);
    }
  }, 200);
}

/** Dispara o evento no máximo uma vez por sessão do visitante. */
export function fbTrackOnce(event: string, storageKey: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch {
    /* storage bloqueado — segue e dispara mesmo assim */
  }
  window.fbq("track", event);
}
