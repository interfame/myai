"use client";

import { useMemo } from "react";
import { ExternalLink, MonitorPlay } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Parche que se inyecta en el HTML previsualizado para que las apps puedan usar
 * localStorage/sessionStorage aunque el iframe sea de origen opaco (sin allow-same-origin).
 */
const STORAGE_SHIM = `<script>(function(){try{window.localStorage.getItem("__probe__")}catch(e){var s=new Map();var shim={getItem:function(k){k=String(k);return s.has(k)?s.get(k):null},setItem:function(k,v){s.set(String(k),String(v))},removeItem:function(k){s.delete(String(k))},clear:function(){s.clear()},key:function(i){return Array.from(s.keys())[i]!==undefined?Array.from(s.keys())[i]:null},get length(){return s.size}};try{Object.defineProperty(window,"localStorage",{value:shim,configurable:true});Object.defineProperty(window,"sessionStorage",{value:shim,configurable:true})}catch(e2){}}})();</script>`;

function hardenHtml(html: string): string {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${STORAGE_SHIM}`);
  }
  return STORAGE_SHIM + html;
}

interface SandboxPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  title: string;
  onOpenInTab?: () => void;
  openingTab?: boolean;
}

/** Vista previa en vivo de una app HTML creada por la IA (iframe aislado). */
export function SandboxPreview({
  open,
  onOpenChange,
  html,
  title,
  onOpenInTab,
  openingTab,
}: SandboxPreviewProps) {
  const safeHtml = useMemo(() => hardenHtml(html), [html]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88dvh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MonitorPlay className="size-4 text-emerald-400" aria-hidden="true" />
            <span className="truncate">{title}</span>
            {onOpenInTab && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={openingTab}
                onClick={onOpenInTab}
                className="ml-auto h-8 gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Abrir en pestaña
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Vista previa en vivo de la aplicación creada por la IA
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-white">
          <iframe
            srcDoc={safeHtml}
            title={`Vista previa: ${title}`}
            // Origen opaco: el código corre aislado, sin acceso a la plataforma
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock"
            className="size-full border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
