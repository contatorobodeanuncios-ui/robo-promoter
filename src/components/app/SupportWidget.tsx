import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X, Loader2, Paperclip, Mic, Square, File as FileIcon, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getOrCreateMyConversation,
  listMyMessages,
  sendMyMessage,
  getSupportUploadPath,
  getSupportAttachmentUrl,
  type SupportAttachment,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_MB = 15;

function kindFromMime(mime: string): SupportAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(false);
  const [text, setText] = useState("");
  const [hasUnread, setHasUnread] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<SupportAttachment | null>(null);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const qc = useQueryClient();

  const openConv = useServerFn(getOrCreateMyConversation);
  const listFn = useServerFn(listMyMessages);
  const sendFn = useServerFn(sendMyMessage);
  const uploadPathFn = useServerFn(getSupportUploadPath);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSigned(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const convQuery = useQuery({
    queryKey: ["support-conv"],
    queryFn: () => openConv(),
    enabled: signed,
    staleTime: 60_000,
  });
  const conversationId = convQuery.data?.id;

  useEffect(() => {
    if (convQuery.data) setHasUnread(!!convQuery.data.unread_by_client);
  }, [convQuery.data]);

  const msgsQuery = useQuery({
    queryKey: ["support-msgs", conversationId],
    queryFn: () => listFn({ data: { conversation_id: conversationId! } }),
    enabled: !!conversationId && open,
  });

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
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-conv-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations", filter: `id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { unread_by_client?: boolean };
          if (typeof row.unread_by_client === "boolean") {
            setHasUnread(row.unread_by_client);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [msgsQuery.data, open]);

  useEffect(() => {
    if (open) setHasUnread(false);
  }, [open]);

  const sendMut = useMutation({
    mutationFn: (v: { content: string; attachments: SupportAttachment[] }) =>
      sendFn({ data: { conversation_id: conversationId!, content: v.content, attachments: v.attachments } }),
    onSuccess: () => {
      setText("");
      setPendingAttachment(null);
      qc.invalidateQueries({ queryKey: ["support-msgs", conversationId] });
    },
    onError: (e) => {
      toast.error("Não foi possível enviar a mensagem", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${MAX_FILE_MB}MB)`);
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadPathFn({ data: { filename: file.name } });
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
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
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

  if (!signed) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir suporte"
          className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40 hover:scale-105 transition-transform flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive border-2 border-background animate-pulse" />
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-[min(92vw,380px)] h-[min(65vh,520px)] rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-primary/10 to-accent/10 shrink-0">
            <div>
              <div className="text-sm font-semibold">Suporte Robô de Lucro</div>
              <div className="text-[11px] text-muted-foreground">Respondemos em minutos</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 rounded hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {convQuery.isLoading || msgsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (msgsQuery.data ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8 px-2">
                Envie sua mensagem, uma imagem, áudio ou arquivo. Nossa equipe responderá aqui mesmo.
              </div>
            ) : (
              (msgsQuery.data ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm space-y-2 ${
                    m.sender === "user" || m.sender === "client"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-white/5 text-foreground"
                  }`}
                >
                  {m.content && <p>{m.content}</p>}
                  {m.attachments.map((a, i) => (
                    <AttachmentView key={i} attachment={a} />
                  ))}
                </div>
              ))
            )}
          </div>

          {pendingAttachment && (
            <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="truncate flex items-center gap-1.5">
                <FileIcon className="h-3.5 w-3.5 shrink-0" /> {pendingAttachment.name}
              </span>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = text.trim();
              if ((!c && !pendingAttachment) || !conversationId || sendMut.isPending) return;
              sendMut.mutate({ content: c, attachments: pendingAttachment ? [pendingAttachment] : [] });
            }}
            className="p-2 border-t border-white/10 flex items-center gap-1.5 shrink-0"
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={uploading || recording}
              onClick={() => fileInputRef.current?.click()}
              title="Anexar imagem ou arquivo"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant={recording ? "destructive" : "ghost"}
              size="icon"
              disabled={uploading}
              onClick={recording ? stopRecording : startRecording}
              title={recording ? "Parar gravação" : "Gravar áudio"}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={conversationId ? "Escreva sua mensagem..." : "Preparando canal..."}
              className="flex-1"
              disabled={sendMut.isPending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={(!text.trim() && !pendingAttachment) || !conversationId || sendMut.isPending}
            >
              {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function AttachmentView({ attachment }: { attachment: SupportAttachment }) {
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
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
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
