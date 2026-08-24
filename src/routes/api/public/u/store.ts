import { createFileRoute } from "@tanstack/react-router";

/**
 * Upload de mídia pelo NOSSO domínio (evita CORS entre domínios e bloqueadores
 * de anúncio que barram URLs com palavras de marketing). O navegador manda o
 * arquivo para cá; o servidor repassa para o Storage nos bastidores.
 *
 * Segurança: exige o bearer token do usuário logado; o caminho é sempre
 * derivado do id do usuário autenticado, nunca do que o cliente mandou.
 */
const MAX_BYTES = 60 * 1024 * 1024;

export const Route = createFileRoute("/api/public/u/store")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
          if (!token) return json({ error: "Não autenticado" }, 401);

          const { createClient } = await import("@supabase/supabase-js");
          const anon = createClient(
            process.env["SUPABASE_URL"]!,
            process.env["SUPABASE_PUBLISHABLE_KEY"]!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          const { data: userData, error: userErr } = await anon.auth.getUser(token);
          if (userErr || !userData?.user) return json({ error: "Sessão inválida ou expirada" }, 401);
          const userId = userData.user.id;

          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return json({ error: "Arquivo ausente" }, 400);
          if (file.size <= 0) return json({ error: "Arquivo vazio" }, 400);
          if (file.size > MAX_BYTES) return json({ error: "Arquivo muito grande (máx. 60 MB)" }, 413);

          const rawName = (form.get("filename") as string | null) ?? file.name ?? "arquivo";
          const safe = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
          const path = `creatives/${userId}/${Date.now()}-${safe}`;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error } = await supabaseAdmin.storage
            .from("campaign-creatives")
            .upload(path, bytes, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (error) return json({ error: error.message }, 502);

          return json({ path }, 200);
        } catch (e) {
          console.error("[upload] falha", e);
          return json({ error: e instanceof Error ? e.message : "Falha no envio" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
