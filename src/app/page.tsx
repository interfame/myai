"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Brain, Menu, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChatInput } from "@/components/myai/chat-input";
import { MessageBubble, type UiMessage } from "@/components/myai/message-bubble";
import { MyAISidebar } from "@/components/myai/sidebar";
import { SettingsDialog, type SettingsTab } from "@/components/myai/settings-dialog";
import { StatusBadge, brainStatusLabel } from "@/components/myai/status-badge";
import type {
  BrainStatus,
  ChatEvent,
  ChatMessage,
  ConversationSummary,
  SettingsDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "¿Qué recuerdas de mí?",
  "Explícame algo sin filtros",
  "Voy a enseñarte cómo quiero que me trates",
];

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({
  userName,
  onSuggestion,
}: {
  userName: string;
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="grid size-20 place-items-center rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/25 to-lime-500/10 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
      >
        <Bot className="size-10 text-emerald-400" aria-hidden="true" />
      </motion.div>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">Hola, {userName}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Tu IA libre está lista. Habla, enséñale cosas: aprenderá sola.
        </p>
      </div>
      <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="min-h-[36px] rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-300 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página principal                                                    */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [brain, setBrain] = useState<BrainStatus | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("cerebro");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [learningsKey, setLearningsKey] = useState(0);

  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamEngineRef = useRef<"colab" | "fallback" | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ------------------------------ Cargas iniciales ------------------------------ */

  const refreshBrain = useCallback(async (force: boolean): Promise<BrainStatus | null> => {
    try {
      const res = await fetch(`/api/health${force ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok: boolean; brain: BrainStatus };
      setBrain(data.brain);
      return data.brain;
    } catch (err) {
      console.error("MyAI: no se pudo refrescar el estado del cerebro:", err);
      return null;
    }
  }, []);

  const refreshConversations = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations);
    } catch (err) {
      console.error("MyAI: no se pudo refrescar la lista de conversaciones:", err);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const [h, s, c] = await Promise.allSettled([
        fetch("/api/health").then((r) => r.json() as Promise<{ ok: boolean; brain: BrainStatus }>),
        fetch("/api/settings").then((r) => r.json() as Promise<{ settings: SettingsDTO }>),
        fetch("/api/conversations").then(
          (r) => r.json() as Promise<{ conversations: ConversationSummary[] }>
        ),
      ]);
      if (!alive) return;
      if (h.status === "fulfilled") setBrain(h.value.brain);
      if (s.status === "fulfilled") setSettings(s.value.settings);
      if (c.status === "fulfilled") setConversations(c.value.conversations);
      setConversationsLoading(false);
    };
    void run();
    return () => {
      alive = false;
    };
  }, []);

  // Health cada 60 s (sin forzar re-ping).
  useEffect(() => {
    const t = setInterval(() => {
      void refreshBrain(false);
    }, 60_000);
    return () => clearInterval(t);
  }, [refreshBrain]);

  // Aborta cualquier stream pendiente al desmontar.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  /* ------------------------------ Auto-scroll ------------------------------ */

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  /* ------------------------------ Chat: SSE ------------------------------ */

  const handleChatEvent = useCallback(
    (ev: ChatEvent, optimisticId: string) => {
      switch (ev.type) {
        case "meta": {
          setActiveId(ev.conversationId);
          streamEngineRef.current = ev.engine;
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...m, id: ev.userMessageId } : m))
          );
          break;
        }
        case "engine": {
          streamEngineRef.current = ev.engine;
          setMessages((prev) =>
            prev.map((m) => (m.pending ? { ...m, engine: ev.engine } : m))
          );
          break;
        }
        case "delta": {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.pending && m.role === "assistant");
            if (idx === -1) {
              return [
                ...prev,
                {
                  id: `stream-${crypto.randomUUID()}`,
                  role: "assistant",
                  content: ev.text,
                  createdAt: new Date().toISOString(),
                  engine: streamEngineRef.current ?? undefined,
                  pending: true,
                },
              ];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], content: next[idx].content + ev.text };
            return next;
          });
          break;
        }
        case "learnings": {
          toast.success(
            `🧠 La IA aprendió ${ev.learnings.length} cosa${ev.learnings.length === 1 ? "" : "s"} nueva${
              ev.learnings.length === 1 ? "" : "s"
            }`
          );
          setLearningsKey((k) => k + 1);
          break;
        }
        case "done": {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.pending && m.role === "assistant");
            if (idx === -1) {
              if (!ev.content) return prev;
              return [
                ...prev,
                {
                  id: ev.assistantMessageId,
                  role: "assistant",
                  content: ev.content,
                  createdAt: new Date().toISOString(),
                  engine: streamEngineRef.current ?? undefined,
                },
              ];
            }
            return prev.map((m, i) =>
              i === idx
                ? {
                    ...m,
                    id: ev.assistantMessageId,
                    content: ev.content || m.content,
                    engine: m.engine ?? streamEngineRef.current ?? undefined,
                    pending: false,
                  }
                : m
            );
          });
          break;
        }
        case "error": {
          setMessages((prev) => [
            ...prev.map((m) => (m.pending ? { ...m, pending: false } : m)),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: ev.message,
              createdAt: new Date().toISOString(),
              error: true,
            },
          ]);
          toast.error(ev.message);
          break;
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);
      setInput("");
      stickToBottomRef.current = true;

      const optimisticId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      streamEngineRef.current = null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: activeId, message: text }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`El servidor respondió ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload) continue;
            let ev: ChatEvent;
            try {
              ev = JSON.parse(payload) as ChatEvent;
            } catch {
              continue;
            }
            if (ev.type === "done") finished = true;
            handleChatEvent(ev, optimisticId);
          }
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (!aborted) {
          const msg = err instanceof Error ? err.message : "Error de red";
          setMessages((prev) => [
            ...prev.map((m) => (m.pending ? { ...m, pending: false } : m)),
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `No se pudo completar la respuesta (${msg}).`,
              createdAt: new Date().toISOString(),
              error: true,
            },
          ]);
          toast.error("No se pudo comunicar con el cerebro");
        }
      } finally {
        setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)));
        sendingRef.current = false;
        setSending(false);
        abortRef.current = null;
        void refreshConversations();
      }
    },
    [activeId, handleChatEvent, refreshConversations]
  );

  /* ------------------------------ Conversaciones ------------------------------ */

  const openConversation = useCallback(async (id: string) => {
    if (sendingRef.current) {
      abortRef.current?.abort();
    }
    abortRef.current = null;
    sendingRef.current = false;
    setSending(false);
    setActiveId(id);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        conversation: ConversationSummary & { messages: ChatMessage[] };
      };
      setMessages(
        data.conversation.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ ...m }))
      );
      stickToBottomRef.current = true;
    } catch {
      toast.error("No se pudo cargar la conversación");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setSending(false);
    setActiveId(null);
    setMessages([]);
    setInput("");
    stickToBottomRef.current = true;
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === activeId) {
          abortRef.current?.abort();
          abortRef.current = null;
          sendingRef.current = false;
          setSending(false);
          setActiveId(null);
          setMessages([]);
        }
        toast.success("Conversación eliminada");
      } catch {
        toast.error("No se pudo eliminar la conversación");
      }
    },
    [activeId]
  );

  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const handleSettingsSaved = useCallback(
    (saved: SettingsDTO) => {
      setSettings(saved);
      // La URL del cerebro pudo cambiar → re-ping inmediato.
      void refreshBrain(true);
    },
    [refreshBrain]
  );

  const botName = settings?.botName || "MyAI";
  const userName = settings?.userName || "Jefe";

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-background">
      {/* ---------- Header ---------- */}
      <header className="z-20 shrink-0 border-b border-border/60 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
        <div className="flex h-14 items-center gap-2 px-3 md:px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Abrir menú de conversaciones"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="border-b border-border/60 px-4 py-3">
                <SheetTitle className="font-mono text-xs tracking-[0.25em] text-muted-foreground">
                  CONVERSACIONES
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Lista de tus conversaciones con MyAI
                </SheetDescription>
              </SheetHeader>
              <MyAISidebar
                conversations={conversations}
                loading={conversationsLoading}
                activeId={activeId}
                onSelect={(id) => {
                  void openConversation(id);
                  setSheetOpen(false);
                }}
                onNew={() => {
                  newConversation();
                  setSheetOpen(false);
                }}
                onDelete={(id) => void deleteConversation(id)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
              <Bot className="size-5 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-semibold text-zinc-100">{botName}</h1>
              <p className="truncate font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                IA LIBRE · LLAMA-3-8B-UNCENSORED
              </p>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <StatusBadge
              brain={brain}
              onClick={() => openSettings("cerebro")}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="Abrir ajustes"
              onClick={() => openSettings("cerebro")}
            >
              <Settings className="size-5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="Abrir memoria de la IA"
              onClick={() => openSettings("memoria")}
            >
              <Brain className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* ---------- Cuerpo ---------- */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar escritorio */}
        <aside className="hidden w-[280px] shrink-0 border-r border-border/60 bg-sidebar md:block">
          <MyAISidebar
            conversations={conversations}
            loading={conversationsLoading}
            activeId={activeId}
            onSelect={(id) => void openConversation(id)}
            onNew={newConversation}
            onDelete={(id) => void deleteConversation(id)}
          />
        </aside>

        {/* Columna de chat */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-label="Mensajes del chat"
            className="bg-terminal min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-3 py-6 md:px-6">
              {messagesLoading ? (
                <div className="space-y-4 py-4" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cn("flex gap-2.5", i % 2 ? "justify-end" : "justify-start")}>
                      {i % 2 === 0 && <Skeleton className="size-8 shrink-0 rounded-full" />}
                      <Skeleton className={cn("h-16 rounded-2xl", i % 2 ? "w-1/2" : "w-2/3")} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <EmptyState userName={userName} onSuggestion={(s) => void sendMessage(s)} />
              ) : (
                <div className="space-y-4 pb-2">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage(input)}
            sending={sending}
            placeholder={`Habla con ${botName}…`}
          />
        </main>
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="mt-auto shrink-0 border-t border-border/60 bg-zinc-950">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center font-mono text-[10px] tracking-wider text-muted-foreground">
          <span className="text-zinc-400">MyAI · IA LIBRE SIN CENSURA</span>
          <span aria-hidden="true">·</span>
          <span
            className={cn(
              brain?.online
                ? "text-emerald-400"
                : brain
                  ? brain.configured
                    ? "text-red-400"
                    : "text-amber-400"
                  : "text-zinc-500"
            )}
          >
            {brainStatusLabel(brain)}
          </span>
          <span aria-hidden="true">·</span>
          <span>memoria evolutiva: {settings?.autoLearn ? "ON" : "OFF"}</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/interfame/myai"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-emerald-400"
          >
            github.com/interfame/myai
          </a>
        </div>
      </footer>

      {/* ---------- Ajustes ---------- */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        settings={settings}
        onSaved={handleSettingsSaved}
        onBrainUpdate={setBrain}
        learningsKey={learningsKey}
      />
    </div>
  );
}
