import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // Sentry: reporta no server se SENTRY_DSN estiver definido (não bloqueia).
    try {
      if (process.env.SENTRY_DSN) {
        const Sentry = await import(/* @vite-ignore */ "@sentry/browser").catch(() => null);
        if (Sentry) {
          if (!(globalThis as { __sentryInited?: boolean }).__sentryInited) {
            Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
            (globalThis as { __sentryInited?: boolean }).__sentryInited = true;
          }
          Sentry.captureException(error);
        }
      }
    } catch { /* noop */ }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
