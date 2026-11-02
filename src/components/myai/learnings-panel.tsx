"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LEARNING_CATEGORIES, type LearningDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  preferencia: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  hecho: "border-lime-500/40 bg-lime-500/10 text-lime-300",
  personalidad: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  habilidad: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  general: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
};

function categoryStyle(category: string): string {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.general;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

interface LearningsPanelProps {
  /** Cambia cuando la IA aprende algo nuevo → fuerza re-carga. */
  refreshKey: number;
}

/** Panel CRUD de la memoria evolutiva (pestaña "Memoria" de Ajustes). */
export function LearningsPanel({ refreshKey }: LearningsPanelProps) {
  const [learnings, setLearnings] = useState<LearningDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/learnings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { learnings: LearningDTO[] };
      setLearnings(data.learnings);
    } catch {
      toast.error("No se pudo cargar la memoria");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const addLearning = async () => {
    const content = newContent.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category: newCategory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { learning: LearningDTO };
      setLearnings((prev) => [data.learning, ...prev]);
      setNewContent("");
      setNewCategory("general");
      setAdding(false);
      toast.success("Aprendizaje añadido a la memoria");
    } catch {
      toast.error("No se pudo añadir el aprendizaje");
    } finally {
      setSaving(false);
    }
  };

  const toggleLearning = async (learning: LearningDTO, active: boolean) => {
    if (busyId) return;
    setBusyId(learning.id);
    setLearnings((prev) => prev.map((l) => (l.id === learning.id ? { ...l, active } : l)));
    try {
      const res = await fetch(`/api/learnings/${learning.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { learning: LearningDTO };
      setLearnings((prev) => prev.map((l) => (l.id === learning.id ? data.learning : l)));
    } catch {
      setLearnings((prev) =>
        prev.map((l) => (l.id === learning.id ? { ...l, active: !active } : l))
      );
      toast.error("No se pudo actualizar el aprendizaje");
    } finally {
      setBusyId(null);
    }
  };

  const removeLearning = async (learning: LearningDTO) => {
    if (busyId) return;
    setBusyId(learning.id);
    try {
      const res = await fetch(`/api/learnings/${learning.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLearnings((prev) => prev.filter((l) => l.id !== learning.id));
      toast.success("Aprendizaje eliminado");
    } catch {
      toast.error("No se pudo eliminar el aprendizaje");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          {loading ? "CARGANDO MEMORIA…" : `${learnings.length} APRENDIZAJE(S) EN MEMORIA`}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className="h-9 gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="size-4" aria-hidden="true" />
          Añadir aprendizaje manual
        </Button>
      </div>

      {adding && (
        <div className="space-y-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-learning">Contenido del aprendizaje</Label>
            <Textarea
              id="new-learning"
              rows={2}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Ej: Prefiero respuestas directas y sin rodeos"
              className="text-sm"
            />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-learning-cat">Categoría</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="new-learning-cat" className="w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {LEARNING_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewContent("");
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void addLearning()}
                disabled={saving || !newContent.trim()}
                className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : learnings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
          <Brain className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sin aprendizajes todavía. La IA irá guardando aquí lo que descubra de ti en cada conversación.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-96 overflow-y-auto rounded-lg border border-zinc-800/60">
          <ul className="divide-y divide-zinc-800/60">
            {learnings.map((l) => (
              <li
                key={l.id}
                className={cn(
                  "flex items-start gap-3 p-3 transition-opacity",
                  !l.active && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-zinc-200">{l.content}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn("font-mono text-[10px] capitalize", categoryStyle(l.category))}
                    >
                      {l.category}
                    </Badge>
                    {l.strength > 1 && (
                      <Badge
                        variant="outline"
                        className="border-zinc-700 font-mono text-[10px] text-zinc-400"
                      >
                        x{l.strength}
                      </Badge>
                    )}
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      {l.source === "auto" ? (
                        <Sparkles className="size-3 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <PenLine className="size-3 text-amber-400" aria-hidden="true" />
                      )}
                      {l.source}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {shortDate(l.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={l.active}
                    disabled={busyId === l.id}
                    onCheckedChange={(active) => void toggleLearning(l, active)}
                    aria-label={`Activar o desactivar: ${l.content.slice(0, 60)}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(l)}
                    disabled={busyId === l.id}
                    aria-label={`Eliminar aprendizaje: ${l.content.slice(0, 60)}`}
                    className="size-8 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
            <AlertDialogTitle>¿Eliminar este aprendizaje?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.content.slice(0, 120)}
              {deleteTarget && deleteTarget.content.length > 120 ? "…" : ""}» dejará de formar parte del
              system prompt de la IA. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void removeLearning(deleteTarget);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
