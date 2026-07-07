import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListConversations,
  adminListMessages,
  adminSendMessage,
  adminCloseConversation,
  type SupportConversationRow,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_app/admin-support")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Suporte — AdminDev" }] }),
  component: SupportAdminPage,
});

function SupportAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListConversations);
  const msgsFn = useServerFn(adminListMessages);
  const sendFn = useServerFn(adminSendMessage);
  const closeFn = useServerFn(adminCloseConversation);

  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["admin-support-list"],
    queryFn: () => listFn(),
    refetchInterval: 10_000,
  });
  const msgs = useQuery({
    queryKey: ["admin-support-msgs", selected],
    queryFn: () => msgsFn({ data: { conversation_id: selected! } }),
    enabled: !!selected,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs.data]);

  const sendMut = useMutation({
    mutationFn: (content: string) => sendFn({ data: { conversation_id: selected!, content } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-support-msgs", selected] });
      qc.invalidateQueries({ queryKey: ["admin-support-list"] });
    },
    onError: (e) => toast.error(String(e)),
  });
  const closeMut = useMutation({
    mutationFn: () => closeFn({ data: { conversation_id: selected! } }),
    onSuccess: () => {
      toast.success("Conversa encerrada");
      qc.invalidateQueries({ queryKey: ["admin-support-list"] });
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admindev" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Central de Suporte</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] gap-4 h-[70vh]">
        <div className="glass rounded-xl overflow-y-auto">
          {convs.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : (convs.data ?? []).length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa.</div>
          ) : (
            (convs.data ?? []).map((c: SupportConversationRow) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition ${
                  selected === c.id ? "bg-white/10" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">
                    {c.user_name ?? c.user_email ?? c.user_id.slice(0, 8)}
                  </div>
                  {c.unread_by_admin && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {c.last_message ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString("pt-BR") : ""}
                  {c.status === "closed" && " · encerrada"}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="glass rounded-xl flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="text-sm font-semibold">Conversa</div>
                <Button size="sm" variant="ghost" onClick={() => closeMut.mutate()}>
                  <X className="h-4 w-4 mr-1" /> Encerrar
                </Button>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {(msgs.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender === "admin"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-white/5"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = text.trim();
                  if (!c || sendMut.isPending) return;
                  sendMut.mutate(c);
                }}
                className="p-2 border-t border-white/10 flex gap-2"
              >
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder ao cliente..." />
                <Button type="submit" size="icon" disabled={!text.trim() || sendMut.isPending}>
                  {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
