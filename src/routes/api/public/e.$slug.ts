import { createFileRoute } from "@tanstack/react-router";

// Resolve /e/{slug} → redireciona pro magic link do Supabase.
// Slug curto e limpo, gerado pelo admin via adminGenerateAccessLink.
export const Route = createFileRoute("/api/public/e/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        if (!slug || slug.length > 32) {
          return new Response("Link inválido", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("access_link_slugs")
          .select("target_url, expires_at, used_at")
          .eq("slug", slug)
          .maybeSingle();
        if (error || !data) {
          return new Response("Link não encontrado ou expirado", { status: 404 });
        }
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return new Response("Link expirado", { status: 410 });
        }
        await supabaseAdmin
          .from("access_link_slugs")
          .update({ used_at: new Date().toISOString() })
          .eq("slug", slug);
        return new Response(null, {
          status: 302,
          headers: { Location: data.target_url, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
