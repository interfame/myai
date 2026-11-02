"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    </motion.div>
  );
}
