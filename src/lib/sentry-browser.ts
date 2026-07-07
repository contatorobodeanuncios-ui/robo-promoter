// Sentry init opcional no cliente. Só ativa se VITE_SENTRY_DSN estiver definida.
// Não bloqueia o build quando a lib não está instalada.
let initialized = false;

export async function initSentryClient() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  try {
    const Sentry = await import(/* @vite-ignore */ "@sentry/browser").catch(() => null);
    if (!Sentry) return;
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
    initialized = true;
  } catch (e) {
    console.warn("Sentry client init skipped:", e);
  }
}

export function captureClient(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  import("@sentry/browser").then((S) => {
    S.captureException(error, { extra: context });
  }).catch(() => { /* noop */ });
}
