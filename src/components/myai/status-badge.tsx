"use client";

import type { BrainStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Etiqueta textual del estado del cerebro (usada en header y footer). */
export function brainStatusLabel(brain: BrainStatus | null): string {
  if (!brain) return "CONECTANDO…";
  if (brain.online) {
    return brain.latencyMs != null ? `CEREBRO ONLINE · ${brain.latencyMs}ms` : "CEREBRO ONLINE";
  }
  if (!brain.configured) return "CEREBRO LOCAL (RESPALDO)";
  return "CEREBRO DESCONECTADO";
}

interface StatusBadgeProps {
  brain: BrainStatus | null;
  onClick?: () => void;
}

/** Badge del estado del cerebro remoto. Clickeable → abre Ajustes (pestaña Cerebro). */
export function StatusBadge({ brain, onClick }: StatusBadgeProps) {
  const label = brainStatusLabel(brain);
  const title =
    brain?.online
      ? `Cerebro remoto online${brain.model ? ` · ${brain.model}` : ""}`
      : !brain
        ? "Comprobando estado del cerebro…"
        : !brain.configured
          ? "Sin cerebro remoto configurado: se usa el modelo local de respaldo"
          : "El cerebro remoto no responde: se usará el respaldo local";

  const tone = !brain
    ? "border-zinc-700 bg-zinc-900 text-zinc-400"
    : brain.online
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : !brain.configured
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-red-500/40 bg-red-500/10 text-red-300";

  const dot = !brain
    ? "bg-zinc-500"
    : brain.online
      ? "bg-emerald-400"
      : !brain.configured
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`Estado del cerebro: ${label}. Abrir ajustes`}
      className={cn(
        "hidden items-center gap-2 rounded-full border px-2.5 py-1.5 font-mono text-[10px] tracking-wider transition-[color,background-color,filter] hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:inline-flex",
        tone
      )}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {brain?.online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
