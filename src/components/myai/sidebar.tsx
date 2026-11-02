"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

/** Lista de conversaciones: usada en el aside de escritorio y en el Sheet móvil. */
export function MyAISidebar({ conversations, loading, activeId, onSelect, onNew, onDelete }: SidebarProps) {
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Button
        type="button"
        variant="outline"
        onClick={onNew}
        aria-label="Nueva conversación"
        className="h-11 w-full justify-start gap-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
      >
        <MessageSquarePlus className="size-4" aria-hidden="true" />
        Nueva conversación
      </Button>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground">
          Todavía no hay conversaciones.
          <br />
          Envía el primer mensaje y aparecerá aquí.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Conversaciones" className="space-y-1 pr-1.5">
            {conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative flex items-center rounded-lg border transition-colors",
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-transparent hover:bg-zinc-900"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={isActive ? "true" : undefined}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "w-full truncate text-sm",
                        isActive ? "font-medium text-emerald-100" : "text-zinc-300"
                      )}
                    >
                      {c.title || "Sin título"}
                    </span>
                    <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                      {relativeTime(c.updatedAt)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(c)}
                    aria-label={`Borrar conversación: ${c.title || "Sin título"}`}
                    className="mr-1 size-8 shrink-0 text-muted-foreground transition-opacity hover:text-red-400 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleteTarget?.title || "Sin título"}» junto con todos sus mensajes. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
