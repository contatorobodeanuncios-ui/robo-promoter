import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getOrCreateMyConversation,
  listMyMessages,
  sendMyMessage,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const openConv = useServerFn(getOrCreateMyConversation);
  const listFn = useServerFn(listMyMessages);
  const sendFn = useServerFn(sendMyMessage);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSigned(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const convQuery = useQuery({
    queryKey: ["support-conv"],
    queryFn: () => openConv(),
    enabled: open && signed,
    staleTime: 60_000,
  });
  const conversationId = convQuery.data?.id;

  const msgsQuery = useQuery({
    queryKey: ["support-msgs", conversationId],
    queryFn: () => listFn({ data: { conversation_id: conversationId! } }),
    enabled: !!conversationId && open,
  });

  // Realtime: substitui polling anterior
  useEffect(() => {
    if (!conversationId || !open) return;
    const channel = supabase
      .channel(`support-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, open, qc]);


  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [msgsQuery.data, open]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      sendFn({ data: { conversation_id: conversationId!, content } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] });
    },
  });

  if (!signed) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir suporte"
          className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40 hover:scale-105 transition-transform flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 w-[min(92vw,380px)] h-[min(70vh,560px)] rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-primary/10 to-accent/10">
            <div>
              <div className="text-sm font-semibold">Suporte Robô de Lucro</div>
              <div className="text-[11px] text-muted-foreground">Respondemos em minutos</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 rounded hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {convQuery.isLoading || msgsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (msgsQuery.data ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8 px-2">
                Envie sua mensagem. Nossa equipe responderá aqui mesmo.
              </div>
            ) : (
              (msgsQuery.data ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-white/5 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = text.trim();
              if (!c || !conversationId || sendMut.isPending) return;
              sendMut.mutate(c);
            }}
            className="p-2 border-t border-white/10 flex items-center gap-2"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={conversationId ? "Escreva sua mensagem..." : "Preparando canal..."}
              className="flex-1"
              disabled={sendMut.isPending}
            />
            <Button type="submit" size="icon" disabled={!text.trim() || !conversationId || sendMut.isPending}>
              {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
