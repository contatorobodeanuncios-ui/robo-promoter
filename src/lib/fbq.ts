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
  window.fbq?.("init", pixelId);
}

export function fbTrack(event: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event);
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
