"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Loader2, PlugZap, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LearningsPanel } from "@/components/myai/learnings-panel";
import type { BrainStatus, SettingsDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SettingsTab = "cerebro" | "personalidad" | "memoria";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  settings: SettingsDTO | null;
  onSaved: (settings: SettingsDTO) => void;
  onBrainUpdate: (brain: BrainStatus) => void;
  /** Cambia cuando la IA aprende algo → refresca el panel de memoria. */
  learningsKey: number;
}

interface TestResult {
  ok: boolean;
  message: string;
}

export function SettingsDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  settings,
  onSaved,
  onBrainUpdate,
  learningsKey,
}: SettingsDialogProps) {
  const [botName, setBotName] = useState("MyAI");
  const [userName, setUserName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [autoLearn, setAutoLearn] = useState(true);
  const [colabUrl, setColabUrl] = useState("");
  const [colabSecret, setColabSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Al abrir: carga el draft desde los ajustes actuales.
  useEffect(() => {
    if (!open || !settings) return;
    setBotName(settings.botName);
    setUserName(settings.userName);
    setSystemPrompt(settings.systemPrompt);
    setAutoLearn(settings.autoLearn);
    setColabUrl(settings.colabUrl ?? "");
    setColabSecret(settings.colabSecret ?? "");
    setTestResult(null);
  }, [open, settings]);

  // Sondea el cerebro con una URL concreta (vacía = la guardada) SIN persistir nada.
  const probeBrain = useCallback(
    async (url: string): Promise<TestResult | null> => {
      setTesting(true);
      setTestResult(null);
      let result: TestResult | null = null;
      try {
        const qs = url ? `&url=${encodeURIComponent(url)}` : "";
        const res = await fetch(`/api/health?refresh=1${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ok: boolean; brain: BrainStatus };
        onBrainUpdate(data.brain);
        if (data.brain.online) {
          const bits = [`modelo: ${data.brain.model ?? "desconocido"}`];
          if (data.brain.latencyMs != null) bits.push(`${data.brain.latencyMs}ms`);
          result = { ok: true, message: `Cerebro online · ${bits.join(" · ")}` };
        } else if (url) {
          result = {
            ok: false,
            message:
              "Esa URL no responde. Verifica que el notebook siga en marcha (celdas 6-8) y que la URL sea exacta.",
          };
        } else if (!data.brain.configured) {
          result = {
            ok: false,
            message: "Sin URL configurada: se usará el cerebro local de respaldo.",
          };
        } else {
          result = { ok: false, message: "El cerebro no responde en la URL guardada." };
        }
      } catch {
        result = { ok: false, message: "Error de red al contactar el servidor." };
      } finally {
        setTesting(false);
      }
      setTestResult(result);
      return result;
    },
    [onBrainUpdate]
  );

  // Botón «Probar conexión»: prueba la URL ESCRITA en el campo (aunque aún no esté guardada).
  const testConnection = useCallback(async () => {
    const result = await probeBrain(colabUrl.trim());
    if (result?.ok && colabUrl.trim() && colabUrl.trim() !== (settings?.colabUrl ?? "")) {
      setTestResult({ ...result, message: `${result.message} · pulsa «Guardar cambios» para fijarla` });
    }
  }, [colabUrl, settings, probeBrain]);

  // Ping del cerebro guardado solo cuando el diálogo PASA de cerrado a abierto.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      if (settings) void probeBrain(settings.colabUrl ?? "");
    }
    if (!open) wasOpen.current = false;
  }, [open, settings, probeBrain]);

  const handleSave = useCallback(async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName: botName.trim() || "MyAI",
          userName: userName.trim(),
          systemPrompt,
          autoLearn,
          colabUrl: colabUrl.trim() || null,
          colabSecret: colabSecret || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { settings: SettingsDTO };
      onSaved(data.settings);
      toast.success("Ajustes guardados");
      onOpenChange(false);
    } catch {
      toast.error("No se pudieron guardar los ajustes");
    } finally {
      setSaving(false);
    }
  }, [settings, saving, botName, userName, systemPrompt, autoLearn, colabUrl, colabSecret, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="size-5 text-emerald-400" aria-hidden="true" />
            Ajustes de MyAI
          </DialogTitle>
          <DialogDescription>
            Configura el cerebro remoto, la personalidad y la memoria de tu IA.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => onTabChange(v as SettingsTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cerebro">Cerebro</TabsTrigger>
            <TabsTrigger value="personalidad">Personalidad</TabsTrigger>
            <TabsTrigger value="memoria">Memoria</TabsTrigger>
          </TabsList>

          {/* ---------------- CEREBRO ---------------- */}
          <TabsContent value="cerebro" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="colab-url">URL del túnel del cerebro</Label>
              <Input
                id="colab-url"
                value={colabUrl}
                onChange={(e) => setColabUrl(e.target.value)}
                placeholder="https://xxx.trycloudflare.com"
                autoComplete="url"
                spellCheck={false}
                className="font-mono text-xs"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Se genera al ejecutar el notebook de Colab. Déjalo vacío para usar el cerebro local de
                respaldo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="colab-secret">Secreto de registro</Label>
              <Input
                id="colab-secret"
                type="password"
                value={colabSecret}
                onChange={(e) => setColabSecret(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
                className="font-mono text-xs"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Token opcional que comparte el notebook para autenticar las peticiones.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void testConnection()}
                disabled={testing}
                className="h-10 gap-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                {testing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PlugZap className="size-4" aria-hidden="true" />
                )}
                Probar conexión
              </Button>
              {testResult && (
                <p
                  role="status"
                  className={cn(
                    "font-mono text-xs leading-relaxed",
                    testResult.ok ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {testResult.ok ? "✓ " : "✗ "}
                  {testResult.message}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-zinc-300">
              <p className="mb-1.5 flex items-center gap-1.5 font-medium text-emerald-300">
                <Info className="size-3.5" aria-hidden="true" />
                Cómo conectar el cerebro remoto
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Abre el notebook{" "}
                  <span className="font-mono text-emerald-300">colab/myai_brain.ipynb</span> (versión
                  nueva, descargada de GitHub) en Google Colab.
                </li>
                <li>
                  Ejecuta todas las celdas: si{" "}
                  <span className="font-mono text-emerald-300">PLATFORM_URL</span> está rellenada, el
                  cerebro se registra SOLO al abrir el túnel.
                </li>
                <li>
                  Registro manual: pega aquí la URL del túnel y pulsa «Guardar cambios» (el botón
                  «Probar conexión» prueba la URL escrita, no la guardada).
                </li>
              </ol>
            </div>
          </TabsContent>

          {/* ---------------- PERSONALIDAD ---------------- */}
          <TabsContent value="personalidad" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bot-name">Nombre de la IA</Label>
                <Input
                  id="bot-name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="MyAI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Cómo te llama</Label>
                <Input
                  id="user-name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Jefe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="system-prompt">Instrucciones del Jefe</Label>
              <Textarea
                id="system-prompt"
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Vacío = usa el prompt por defecto…"
                className="resize-y text-sm"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reglas fijas que la IA obedecerá en todas las conversaciones.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="min-w-0">
                <Label htmlFor="auto-learn" className="text-sm">
                  Aprendizaje automático
                </Label>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Al final de cada respuesta, la IA analiza la conversación y guarda aprendizajes en su
                  memoria.
                </p>
              </div>
              <Switch
                id="auto-learn"
                checked={autoLearn}
                onCheckedChange={setAutoLearn}
                aria-label="Activar aprendizaje automático"
              />
            </div>
          </TabsContent>

          {/* ---------------- MEMORIA ---------------- */}
          <TabsContent value="memoria" className="mt-4">
            <LearningsPanel refreshKey={learningsKey} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !settings}
            className="gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
