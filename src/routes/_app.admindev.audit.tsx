import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminListAuditLog } from "@/lib/support.functions";

export const Route = createFileRoute("/_app/admindev/audit")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Log de Auditoria — AdminDev" }] }),
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(adminListAuditLog);
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admindev" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Log de Auditoria</h1>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Alvo</th>
              <th className="p-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>Carregando...</td></tr>
            ) : (q.data ?? []).length === 0 ? (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>Nenhum evento.</td></tr>
            ) : (q.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3">{r.admin_email ?? "—"}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {r.target_type ?? ""} {r.target_id ? `· ${r.target_id.slice(0, 8)}` : ""}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate">{r.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
