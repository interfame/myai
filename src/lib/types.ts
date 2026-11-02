// MyAI — Tipos compartidos entre frontend y backend

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface LearningDTO {
  id: string;
  content: string;
  category: string;
  source: string;
  strength: number;
  active: boolean;
  createdAt: string;
}

export interface SettingsDTO {
  botName: string;
  userName: string;
  systemPrompt: string;
  autoLearn: boolean;
  colabUrl: string | null;
  colabSecret: string | null;
}

export interface BrainStatus {
  configured: boolean;
  online: boolean;
  url: string | null;
  latencyMs: number | null;
  model: string | null;
}

// Eventos SSE que emite POST /api/chat
export type ChatEvent =
  | { type: "meta"; conversationId: string; userMessageId: string; engine: "colab" | "fallback" }
  | { type: "engine"; engine: "colab" | "fallback" }
  | { type: "delta"; text: string }
  | { type: "learnings"; learnings: LearningDTO[] }
  | { type: "done"; assistantMessageId: string; content: string; conversationTitle: string }
  | { type: "error"; message: string };

export const LEARNING_CATEGORIES = [
  "preferencia",
  "hecho",
  "personalidad",
  "habilidad",
  "general",
] as const;
