import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Send, X, MessageSquarePlus, Users, Paperclip, Mic, Square, File as FileIcon, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListConversations,
  adminListMessages,
  adminSendMessage,
  adminCloseConversation,
  getAdminSupportUploadPath,
  getSupportAttachmentUrl,
  type SupportConversationRow,
  type SupportAttachment,
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
const MAX_FILE_MB = 15;

function kindFromMime(mime: string): SupportAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function SupportAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListConversations);
  const msgsFn = useServerFn(adminListMessages);
  const sendFn = useServerFn(adminSendMessage);
  const closeFn = useServerFn(adminCloseConversation);
  const clientsFn = useServerFn(adminListAllClients);
  const startFn = useServerFn(adminStartConversationWith);
  const ctxFn = useServerFn(adminGetClientContext);
  const uploadPathFn = useServerFn(getAdminSupportUploadPath);

  const [tab, setTab] = useState<Tab>("conversations");
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<SupportAttachment | null>(null);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  useEffect(() => {
    setPendingAttachment(null);
  }, [selected]);

  const sendMut = useMutation({
    mutationFn: (v: { content: string; attachments: SupportAttachment[] }) =>
      sendFn({ data: { conversation_id: selected!, content: v.content, attachments: v.attachments } }),
    onSuccess: () => {
      setText("");
      setPendingAttachment(null);
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

  const uploadFile = async (file: File) => {
    if (!selected) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${MAX_FILE_MB}MB)`);
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadPathFn({ data: { conversation_id: selected, filename: file.name } });
      const { error } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw error;
      setPendingAttachment({
        path,
        mime: file.type || "application/octet-stream",
        size: file.size,
        name: file.name,
        kind: kindFromMime(file.type || ""),
      });
      toast.success("Anexo pronto — clique em enviar");
    } catch (e) {
      toast.error("Falha ao enviar anexo", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadFile(file);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const filteredClients = (clients.data ?? []).filter((c) => {
    if (c.status === "banned") return false;
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
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm space-y-2 ${
                        m.sender === "admin"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-white/5"
                      }`}
                    >
                      {m.content && <p>{m.content}</p>}
                      {m.attachments.map((a, i) => (
                        <AdminAttachmentView key={i} attachment={a} />
                      ))}
                    </div>
                  ))}
                </div>

                {pendingAttachment && (
                  <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex items-center gap-1.5">
                      <FileIcon className="h-3.5 w-3.5 shrink-0" /> {pendingAttachment.name}
                    </span>
                    <button type="button" onClick={() => setPendingAttachment(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const c = text.trim();
                    if ((!c && !pendingAttachment) || sendMut.isPending) return;
                    sendMut.mutate({ content: c, attachments: pendingAttachment ? [pendingAttachment] : [] });
                  }}
                  className="p-2 border-t border-white/10 flex items-center gap-1.5"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="ghost" size="icon" disabled={uploading || recording} onClick={() => fileInputRef.current?.click()} title="Anexar imagem ou arquivo">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant={recording ? "destructive" : "ghost"} size="icon" disabled={uploading} onClick={recording ? stopRecording : startRecording} title={recording ? "Parar gravação" : "Gravar áudio"}>
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder ao cliente..." />
                  <Button type="submit" size="icon" disabled={(!text.trim() && !pendingAttachment) || sendMut.isPending}>
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

function AdminAttachmentView({ attachment }: { attachment: SupportAttachment }) {
  const fn = useServerFn(getSupportAttachmentUrl);
  const q = useQuery({
    queryKey: ["support-att-url", attachment.path],
    queryFn: () => fn({ data: { path: attachment.path } }),
    staleTime: 55 * 60 * 1000,
  });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (q.isLoading) {
    return <div className="text-xs opacity-70 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> carregando anexo...</div>;
  }
  const url = q.data?.url;
  if (!url) return <div className="text-xs opacity-70">Anexo indisponível</div>;

  if (attachment.kind === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={attachment.name} className="max-w-full max-h-48 rounded-lg border border-white/10" />
      </a>
    );
  }
  if (attachment.kind === "audio") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) return;
            if (playing) { audioRef.current.pause(); } else { void audioRef.current.play(); }
          }}
          className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center shrink-0"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <audio ref={audioRef} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
        <span className="text-xs opacity-80">Mensagem de voz</span>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs underline">
      <FileIcon className="h-3.5 w-3.5 shrink-0" /> {attachment.name}
    </a>
  );
}
