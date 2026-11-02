"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Paperclip, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ---------- Tipos mínimos de la Web Speech API (sin @types específicos) ---------- */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface AttachmentChip {
  id: string;
  name: string;
  size: number;
  truncated: boolean;
}

export interface ChatSendPayload {
  text: string;
  attachmentIds: string[];
}

interface ChatInputProps {
  onSend: (payload: ChatSendPayload) => void;
  sending: boolean;
  conversationId?: string | null;
  placeholder?: string;
}

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Input del chat: textarea + micrófono (voz→texto) + adjuntos + botón enviar. */
export function ChatInput({ onSend, sending, conversationId, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachmentChip[]>([]);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const canSend = !sending && !uploading && (value.trim().length > 0 || attachments.length > 0);

  const doSend = useCallback(
    (text: string, ids: string[]) => {
      const clean = text.trim();
      if (sending) return;
      if (!clean && ids.length === 0) return;
      onSend({ text: clean || "(analiza los archivos adjuntos)", attachmentIds: ids });
      setValue("");
      setAttachments([]);
    },
    [onSend, sending]
  );

  const handleSend = useCallback(() => {
    doSend(value, attachments.map((a) => a.id));
  }, [doSend, value, attachments]);

  /* ------------------------------ Voz (STT) ------------------------------ */

  const startListening = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = navigator.language?.toLowerCase().startsWith("es") ? navigator.language : "es-AR";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (ev) => {
      let partial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else partial += r[0].transcript;
      }
      setInterim(partial);
    };
    rec.onerror = (e) => {
      setListening(false);
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Micrófono bloqueado: dale permiso al navegador (candado en la barra de URL).");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) {
        // Manos libres: al terminar la frase se envía solo
        doSend(text, attachments.map((a) => a.id));
      }
    };

    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [attachments, doSend]);

  const toggleMic = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
    } else {
      startListening();
    }
  }, [listening, startListening]);

  /* ------------------------------ Adjuntos ------------------------------ */

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const fd = new FormData();
        Array.from(files)
          .slice(0, 5)
          .forEach((f) => fd.append("files", f));
        if (conversationId) fd.append("conversationId", conversationId);
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        const data = (await res.json()) as {
          attachments?: AttachmentChip[];
          error?: string;
        };
        if (!res.ok || !data.attachments) throw new Error(data.error ?? `HTTP ${res.status}`);
        setAttachments((prev) => [...prev, ...data.attachments!]);
        toast.success(
          `${data.attachments.length} archivo${data.attachments.length === 1 ? "" : "s"} listo${
            data.attachments.length === 1 ? "" : "s"
          } para que la IA lo lea`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [conversationId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) handleSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/60 bg-zinc-950/90 px-3 py-3 backdrop-blur md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Chips de adjuntos */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1 pl-2.5 pr-1 text-xs text-emerald-200"
              >
                <Paperclip className="size-3" aria-hidden="true" />
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="font-mono text-[10px] text-emerald-400/70">{fmtSize(a.size)}</span>
                {a.truncated && <span title="Texto recortado por límite de contexto">✂️</span>}
                <button
                  type="button"
                  aria-label={`Quitar ${a.name}`}
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="grid size-4 place-items-center rounded-full text-emerald-300/70 transition-colors hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Adjuntar archivos */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.yaml,.yml,.ini,.cfg,.conf,.log,.env,.sql,.html,.htm,.css,.scss,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.hpp,.cs,.php,.sh,.bash,.zsh,.bat,.ps1,.toml,.pdf,application/pdf,text/*"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading || sending}
            aria-label="Adjuntar archivos para que la IA los lea"
            title="Adjuntar archivos (txt, código, csv, json, pdf…)"
            onClick={() => fileRef.current?.click()}
            className="size-11 shrink-0 rounded-2xl border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-300"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="size-5" aria-hidden="true" />
            )}
          </Button>

          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              listening
                ? interim || "🎙️ Escuchando… habla ahora"
                : (placeholder ?? "Escríbele algo a tu IA…")
            }
            aria-label="Mensaje para la IA"
            className="max-h-[168px] min-h-[46px] flex-1 resize-none overflow-y-auto rounded-2xl border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm"
          />

          {/* Micrófono */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sending || uploading}
            aria-label={listening ? "Detener dictado" : "Hablar por micrófono"}
            aria-pressed={listening}
            title={listening ? "Detener y enviar" : "Habla y se envía solo (manos libres)"}
            onClick={toggleMic}
            className={cn(
              "size-11 shrink-0 rounded-2xl border bg-zinc-900/80 transition-all",
              listening
                ? "animate-pulse border-red-500/60 bg-red-500/15 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.35)]"
                : "border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-300"
            )}
          >
            {listening ? (
              <MicOff className="size-5" aria-hidden="true" />
            ) : (
              <Mic className="size-5" aria-hidden="true" />
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Enviar mensaje"
            className="size-11 shrink-0 rounded-full bg-emerald-500 text-zinc-950 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_22px_rgba(16,185,129,0.5)] disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontal className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      <p className="mx-auto mt-2 hidden w-full max-w-3xl text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground sm:block">
        ENTER · ENVIAR&ensp;/&ensp;MIC · MANOS LIBRES&ensp;/&ensp;SHIFT+ENTER · NUEVA LÍNEA
      </p>
    </div>
  );
}
