import { createFileRoute } from "@tanstack/react-router";

// Página curta /e/{slug} — apenas redireciona no servidor pro handler
// que resolve o slug e faz o 302 pro magic link real.
export const Route = createFileRoute("/e/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${url.origin}/api/public/e/${encodeURIComponent(params.slug)}`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
