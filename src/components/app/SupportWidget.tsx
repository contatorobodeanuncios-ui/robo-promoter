import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Paperclip,
  Mic,
  Square,
  File as FileIcon,
  Play,
  Pause,
  Bot,
} from "lucide-react";
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
  type SupportMessageRow,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_MB = 15;
const BUBBLE_SIZE = 56;
const STORAGE_KEY = "support_bubble_pos";
const DRAG_THRESHOLD = 5;

function kindFromMime(mime: string): SupportAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function defaultBubblePos() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - BUBBLE_SIZE - 16,
    y: window.innerHeight - BUBBLE_SIZE - (window.innerWidth < 768 ? 96 : 24),
  };
}

function clampPos(pos: { x: number; y: number }) {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - BUBBLE_SIZE - 4;
  const maxY = window.innerHeight - BUBBLE_SIZE - 4;
  return {
    x: Math.min(Math.max(pos.x, 4), Math.max(maxX, 4)),
    y: Math.min(Math.max(pos.y, 4), Math.max(maxY, 4)),
  };
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(d, today)) return "Hoje";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDay(messages: SupportMessageRow[]) {
  const groups: { day: string; items: SupportMessageRow[] }[] = [];
  for (const m of messages) {
    const label = formatDayLabel(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === label) {
      last.items.push(m);
    } else {
      groups.push({ day: label, items: [m] });
    }
  }
  return groups;
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

  // ---------- Bolha arrastável ----------
  const [hydrated, setHydrated] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(
    null,
  );

  useEffect(() => {
    // Lê a posição salva apenas após hidratação — nunca durante SSR/render.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        setPos(clampPos(parsed));
      } else {
        setPos(defaultBubblePos());
      }
    } catch {
      setPos(defaultBubblePos());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const savePos = useCallback((next: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, dragging: false };
      bubbleRef.current?.setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    ds.dragging = true;
    setPos(clampPos({ x: ds.origX + dx, y: ds.origY + dy }));
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const ds = dragState.current;
      bubbleRef.current?.releasePointerCapture(e.pointerId);
      if (ds?.dragging) {
        setPos((p) => {
          const clamped = clampPos(p);
          savePos(clamped);
          return clamped;
        });
      } else {
        setOpen((o) => !o);
      }
      dragState.current = null;
    },
    [savePos],
  );

  // Painel: ancora perto da bolha, mas sempre dentro da viewport.
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!hydrated) return;
    const panelW = Math.min(window.innerWidth * 0.92, 380);
    const panelH = Math.min(window.innerHeight * 0.65, 520);
    let left = pos.x + BUBBLE_SIZE / 2 - panelW / 2;
    let top = pos.y - panelH - 12;
    if (top < 8) top = pos.y + BUBBLE_SIZE + 12;
    if (top + panelH > window.innerHeight - 8) top = window.innerHeight - panelH - 8;
    if (left < 8) left = 8;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    setPanelStyle({ left, top, width: panelW, height: panelH });
  }, [hydrated, pos, open]);

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
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
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

  const dayGroups = groupByDay(msgsQuery.data ?? []);

  return (
    <>
      <button
        ref={bubbleRef}
        aria-label="Abrir suporte"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          touchAction: "none",
          visibility: hydrated ? "visible" : "hidden",
        }}
        className={`z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center select-none cursor-grab active:cursor-grabbing ${
          open ? "ring-2 ring-primary/50" : ""
        }`}
      >
        {open ? <X className="h-6 w-6 text-primary-foreground" /> : <MessageCircle className="h-6 w-6 text-primary-foreground" />}
        {hasUnread && !open && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive border-2 border-background animate-pulse" />
        )}
      </button>

      {open && hydrated && (
        <div
          style={panelStyle}
          className="fixed z-50 rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-primary/15 to-accent/15 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Suporte Robô de Lucro</div>
                <div className="text-[11px] text-muted-foreground">Respondemos em minutos</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth p-3 space-y-3">
            {convQuery.isLoading || msgsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dayGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-10 px-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div className="text-sm font-medium">Como podemos ajudar?</div>
                <div className="text-xs text-muted-foreground max-w-[240px]">
                  Envie sua mensagem, uma imagem, áudio ou arquivo. Nossa equipe responderá aqui mesmo.
                </div>
              </div>
            ) : (
              dayGroups.map((group) => (
                <div key={group.day} className="space-y-2">
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
                      {group.day}
                    </span>
                  </div>
                  {group.items.map((m) => {
                    const isMine = m.sender === "user" || m.sender === "client";
                    return (
                      <div key={m.id} className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                        {!isMine && (
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mb-0.5">
                            <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm space-y-2 shadow-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-white/[0.06] text-foreground rounded-bl-sm border border-white/5"
                          }`}
                        >
                          {!isMine && <div className="text-[10px] font-semibold text-primary/80">Suporte</div>}
                          {m.content && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>}
                          {m.attachments.map((a, i) => (
                            <AttachmentView key={i} attachment={a} />
                          ))}
                          <div className={`text-[10px] ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"} text-right`}>
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {pendingAttachment && (
            <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 text-xs shrink-0 bg-white/5">
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
