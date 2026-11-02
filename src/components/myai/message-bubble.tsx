"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, ExternalLink, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SandboxPreview } from "@/components/myai/sandbox-preview";

/** Mensaje tal como se renderiza en el chat (incluye campos extra de UI). */
export interface UiMessage extends ChatMessage {
  engine?: "colab" | "fallback";
  /** true mientras llega el stream de la IA. */
  pending?: boolean;
  /** true para burbujas de error (rojo suave). */
  error?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** Extrae el bloque ```html más grande de un mensaje (la app para el sandbox). */
function extractHtmlApp(content: string): string | null {
  const blocks = Array.from(content.matchAll(/```html\s*\n([\s\S]*?)```/g)).map((m) => m[1]);
  if (blocks.length === 0) return null;
  return blocks.sort((a, b) => b.length - a.length)[0] ?? null;
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" role="status" aria-label="La IA está escribiendo">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const isError = message.error === true;
  const emptyPending = message.pending === true && message.content.length === 0;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [openingTab, setOpeningTab] = useState(false);

  const htmlApp = useMemo(
    () => (!isUser && !isError && !message.pending ? extractHtmlApp(message.content) : null),
    [isUser, isError, message.pending, message.content]
  );

  const openInTab = async () => {
    if (!htmlApp) return;
    setOpeningTab(true);
    try {
      const res = await fetch("/api/sandboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlApp }),
      });
      const data = (await res.json()) as { sandbox?: { id: string }; error?: string };
      if (!res.ok || !data.sandbox) throw new Error(data.error ?? `HTTP ${res.status}`);
      window.open(`/api/sandboxes/${data.sandbox.id}/raw`, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir la app");
    } finally {
      setOpeningTab(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div
          className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15"
          aria-hidden="true"
        >
          <Bot className="size-4 text-emerald-400" />
        </div>
      )}

      <div className={cn("flex min-w-0 max-w-[86%] flex-col gap-1 sm:max-w-[75%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl border px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-sm border-emerald-500/30 bg-emerald-500/10 text-emerald-50"
              : isError
                ? "rounded-bl-sm border-red-500/40 bg-red-500/10 text-red-200"
                : "rounded-bl-sm border-zinc-800 bg-zinc-900 text-zinc-100"
          )}
        >
          {emptyPending ? (
            <TypingDots />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : isError ? (
            <p className="whitespace-pre-wrap break-words">⚠️ {message.content}</p>
          ) : (
            <div className="md-body">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {message.pending && (
                <span
                  className="stream-caret ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] rounded-[1px] bg-emerald-400"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>

        {/* Tarjeta del sandbox: la IA creó una app y se puede previsualizar en vivo */}
        {htmlApp && (
          <div className="w-full rounded-xl border border-emerald-500/25 bg-zinc-900/70 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                <MonitorPlay className="size-3.5 text-emerald-400" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-emerald-200">
                App creada · vista previa en vivo disponible
              </span>
              <div className="ml-auto flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="min-h-[32px] rounded-lg bg-emerald-500 px-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
                >
                  Ver vista previa
                </button>
                <button
                  type="button"
                  onClick={() => void openInTab()}
                  disabled={openingTab}
                  className="flex min-h-[32px] items-center gap-1 rounded-lg border border-zinc-700 px-2.5 text-xs text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  Pestaña
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-1">
          {message.engine === "colab" && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px font-mono text-[9px] tracking-wider text-emerald-300/90">
              COLAB · LLAMA-3-8B
            </span>
          )}
          {message.engine === "fallback" && (
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px font-mono text-[9px] tracking-wider text-amber-300/90">
              RESPALDO LOCAL
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
      </div>

      <SandboxPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={htmlApp ?? ""}
        title={`App de ${message.role === "assistant" ? "MyAI" : "MyAI"}`}
        onOpenInTab={() => void openInTab()}
        openingTab={openingTab}
      />
    </motion.div>
  );
}
