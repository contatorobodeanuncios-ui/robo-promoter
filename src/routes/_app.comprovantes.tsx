import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyPayments, generateReceiptPDF } from "@/lib/receipt.functions";

export const Route = createFileRoute("/_app/comprovantes")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Comprovantes — Robô de Lucro" }] }),
  component: ReceiptsPage,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ReceiptsPage() {
  const listFn = useServerFn(listMyPayments);
  const pdfFn = useServerFn(generateReceiptPDF);

  const q = useQuery({ queryKey: ["my-payments"], queryFn: () => listFn() });

  const dl = useMutation({
    mutationFn: async (id: string) => pdfFn({ data: { payment_id: id } }),
    onSuccess: (r) => {
      const bin = atob(r.pdf);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Comprovante baixado");
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/settings" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Meus Comprovantes</h1>
      </div>

      <div className="glass rounded-xl divide-y divide-white/5">
        {q.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Nenhum pagamento ainda.
          </div>
        ) : (q.data ?? []).map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold tabular-nums">{fmtBRL(p.amount)}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(p.approved_at ?? p.created_at).toLocaleString("pt-BR")} · {p.status}
              </div>
            </div>
            <Button
              size="sm"
              variant="glass"
              disabled={p.status !== "approved" || (dl.isPending && dl.variables === p.id)}
              onClick={() => dl.mutate(p.id)}
            >
              {dl.isPending && dl.variables === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Download className="h-4 w-4 mr-1" /> PDF</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
