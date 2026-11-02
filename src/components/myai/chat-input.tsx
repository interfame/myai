"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
}

/** Input pegado abajo del chat: textarea auto-expandible + botón enviar circular. */
export function ChatInput({ value, onChange, onSend, sending, placeholder }: ChatInputProps) {
  const canSend = !sending && value.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/60 bg-zinc-950/90 px-3 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder ?? "Escríbele algo a tu IA…"}
          aria-label="Mensaje para la IA"
          className="max-h-[168px] min-h-[46px] flex-1 resize-none overflow-y-auto rounded-2xl border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm"
        />
        <Button
          type="button"
          size="icon"
          onClick={onSend}
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
      <p className="mx-auto mt-2 hidden w-full max-w-3xl text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground sm:block">
        ENTER · ENVIAR&ensp;/&ensp;SHIFT+ENTER · NUEVA LÍNEA
      </p>
    </div>
  );
}
