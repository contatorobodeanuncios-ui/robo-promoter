import { createFileRoute } from "@tanstack/react-router";

/**
 * Upload de mídia pelo NOSSO domínio (evita CORS entre domínios e bloqueadores
 * de anúncio que barram URLs com palavras de marketing). O navegador manda o
 * arquivo para cá; o servidor repassa para o Storage nos bastidores.
 *
 * Segurança: exige o bearer token do usuário logado; o caminho é sempre
 * derivado do id do usuário autenticado, nunca do que o cliente mandou.
 */
const MAX_BYTES = 32 * 1024 * 1024;

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

          // Corpo binário evita o custo e os picos de memória do parser de
          // multipart. O cliente também comprime imagens grandes antes daqui.
          const declaredLength = Number(request.headers.get("content-length") ?? 0);
          if (declaredLength > MAX_BYTES) return json({ error: "Arquivo muito grande" }, 413);
          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength <= 0) return json({ error: "Arquivo vazio" }, 400);
          if (bytes.byteLength > MAX_BYTES) return json({ error: "Arquivo muito grande" }, 413);

          const rawName = decodeURIComponent(request.headers.get("x-file-name") ?? "arquivo");
          const safe = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
          const rawUploadId = request.headers.get("x-upload-id") ?? crypto.randomUUID();
          const uploadId = rawUploadId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
          if (!uploadId) return json({ error: "Identificador de envio inválido" }, 400);
          // O mesmo ID é reutilizado nas tentativas. Se a resposta anterior se
          // perdeu, a repetição sobrescreve o mesmo objeto em vez de duplicá-lo.
          const path = `creatives/${userId}/${uploadId}-${safe}`;
          const contentType = request.headers.get("content-type") || "application/octet-stream";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.storage
            .from("campaign-creatives")
            .upload(path, bytes, {
              contentType,
              upsert: true,
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
