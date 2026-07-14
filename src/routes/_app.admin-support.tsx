import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Send, X, MessageSquarePlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListConversations,
  adminListMessages,
  adminSendMessage,
  adminCloseConversation,
  type SupportConversationRow,
} from "@/lib/support.functions";
import { adminListAllClients, adminStartConversationWith, adminGetClientContext } from "@/lib/admin.functions";

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

type Tab = "conversations" | "clients";

function SupportAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListConversations);
  const msgsFn = useServerFn(adminListMessages);
  const sendFn = useServerFn(adminSendMessage);
  const closeFn = useServerFn(adminCloseConversation);
  const clientsFn = useServerFn(adminListAllClients);
  const startFn = useServerFn(adminStartConversationWith);
  const ctxFn = useServerFn(adminGetClientContext);

  const [tab, setTab] = useState<Tab>("conversations");
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["admin-support-list"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
  });
  const msgs = useQuery({
    queryKey: ["admin-support-msgs", selected],
    queryFn: () => msgsFn({ data: { conversation_id: selected! } }),
    enabled: !!selected,
  });
  const selectedUserId = (convs.data ?? []).find((c) => c.id === selected)?.user_id ?? null;
  const clientCtx = useQuery({
    queryKey: ["admin-client-ctx", selectedUserId],
    queryFn: () => ctxFn({ data: { user_id: selectedUserId! } }),
    enabled: !!selectedUserId,
  });
  const clients = useQuery({
    queryKey: ["admin-all-clients"],
    queryFn: () => clientsFn(),
    enabled: tab === "clients",
  });

  // Realtime nas mensagens da conversa selecionada
  useEffect(() => {
    if (!selected) return;
    const ch = supabase
      .channel(`admin-msgs-${selected}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${selected}` },
        () => qc.invalidateQueries({ queryKey: ["admin-support-msgs", selected] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected, qc]);

  // Realtime na lista global de conversas
  useEffect(() => {
    const ch = supabase
      .channel("admin-support-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => qc.invalidateQueries({ queryKey: ["admin-support-list"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

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
  const startMut = useMutation({
    mutationFn: (user_id: string) => startFn({ data: { user_id } }),
    onSuccess: (r) => {
      toast.success("Conversa iniciada");
      qc.invalidateQueries({ queryKey: ["admin-support-list"] });
      setTab("conversations");
      setSelected(r.id);
    },
    onError: (e) => toast.error(String(e)),
  });

  const filteredClients = (clients.data ?? []).filter((c) => {
    const q = clientFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.display_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admindev" className="p-2 rounded hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Central de Suporte</h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("conversations")}
          className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${
            tab === "conversations" ? "bg-primary text-primary-foreground border-primary" : "border-white/10 hover:bg-white/5"
          }`}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> Conversas
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${
            tab === "clients" ? "bg-primary text-primary-foreground border-primary" : "border-white/10 hover:bg-white/5"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Todos os clientes
        </button>
      </div>

      {tab === "clients" ? (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
          {clients.isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente.</div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-white/5">
              {filteredClients.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.display_name ?? "(sem nome)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.email ?? c.id.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">Saldo: R$ {c.balance.toFixed(2)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="neon"
                    disabled={startMut.isPending}
                    onClick={() => startMut.mutate(c.id)}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" /> Iniciar conversa
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
                <div className="p-3 border-b border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Conversa</div>
                    <Button size="sm" variant="ghost" onClick={() => closeMut.mutate()}>
                      <X className="h-4 w-4 mr-1" /> Encerrar
                    </Button>
                  </div>
                  {clientCtx.data && (
                    <div className="rounded-lg bg-white/5 p-3 text-xs space-y-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="text-muted-foreground">Nome:</span> <b>{clientCtx.data.display_name ?? "—"}</b></span>
                        <span><span className="text-muted-foreground">Email:</span> {clientCtx.data.email ?? "—"}</span>
                        <span><span className="text-muted-foreground">Código:</span> <code className="text-primary">{clientCtx.data.code}</code></span>
                        <span><span className="text-muted-foreground">Saldo:</span> R$ {clientCtx.data.balance.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Campanhas ativas ({clientCtx.data.active_campaigns.length}):</span>{" "}
                        {clientCtx.data.active_campaigns.length === 0 ? (
                          <span className="italic text-muted-foreground">nenhuma</span>
                        ) : (
                          <span className="inline-flex flex-wrap gap-1 mt-1">
                            {clientCtx.data.active_campaigns.map((c) => (
                              <span key={c.id} className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-[10px]">
                                {c.name} <span className="text-muted-foreground">· {c.status}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
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
      )}
    </div>
  );
}
