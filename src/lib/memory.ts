// MyAI — Memoria evolutiva (bucle de retroalimentación)
// 1. Tras cada respuesta, la IA analiza el intercambio y extrae aprendizajes valiosos.
// 2. Los aprendizajes se deduplican/refuerzan en la BD.
// 3. En la próxima charla se inyectan al system prompt del cerebro.

import { db } from "@/lib/db";
import type { Learning } from "@prisma/client";
import {
  chatWithColab,
  chatWithFallback,
  type LlmMessage,
} from "@/lib/brain";
import { getSettings } from "@/lib/settings";

const VALID_CATEGORIES = new Set(["preferencia", "hecho", "personalidad", "habilidad", "general"]);

/** Construye el system prompt completo: persona + memoria aprendida + instrucciones del Jefe */
export function buildSystemPrompt(
  settings: { botName: string; userName: string; systemPrompt: string },
  learnings: Learning[]
): string {
  const memory =
    learnings.length > 0
      ? `\n=== MEMORIA APRENDIDA (cosas reales que sabes sobre ${settings.userName}) ===\n${learnings
          .map((l) => `- [${l.category}] ${l.content}`)
          .join("\n")}\n=== FIN DE MEMORIA ===\n`
      : "";
  const custom = settings.systemPrompt.trim()
    ? `\n=== INSTRUCCIONES DEL JEFE (prioridad máxima) ===\n${settings.systemPrompt.trim()}\n=== FIN INSTRUCCIONES ===\n`
    : "";
  return `Eres ${settings.botName}, la IA personal libre de ${settings.userName}.${memory}${custom}`;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Guarda aprendizajes evitando duplicados; si ya existe, refuerza (strength+1) */
export async function saveLearnings(
  candidates: { content: string; category?: string }[],
  source: "auto" | "manual"
): Promise<Learning[]> {
  const saved: Learning[] = [];
  for (const candidate of candidates) {
    const content = candidate.content?.trim();
    if (!content || content.length < 8 || content.length > 400) continue;
    const category =
      candidate.category && VALID_CATEGORIES.has(candidate.category)
        ? candidate.category
        : "general";
    const norm = normalize(content);
    const existing = await db.learning.findMany({ where: { active: true } });
    const dup = existing.find((l) => {
      const lNorm = normalize(l.content);
      return lNorm === norm || (norm.length > 20 && (lNorm.includes(norm) || norm.includes(lNorm)));
    });
    if (dup) {
      const reinforced = await db.learning.update({
        where: { id: dup.id },
        data: { strength: { increment: 1 }, lastReinforcedAt: new Date() },
      });
      saved.push(reinforced);
    } else {
      const created = await db.learning.create({
        data: { content, category, source },
      });
      saved.push(created);
    }
  }
  return saved;
}

/** Extracción heurística sin LLM (red de seguridad) */
function heuristicExtract(text: string, userName: string): { content: string; category: string }[] {
  const out: { content: string; category: string }[] = [];
  const rules: [RegExp, (m: RegExpMatchArray) => string, string][] = [
    [/me llamo ([\wáéíóúñ\s]{2,30})/i, (m) => `${userName} se llama ${m[1].trim()}`, "hecho"],
    [/mi nombre es ([\wáéíóúñ\s]{2,30})/i, (m) => `${userName} se llama ${m[1].trim()}`, "hecho"],
    [/prefiero que (.+?)[.!?\n]/i, (m) => `${userName} prefiere que ${m[1].trim()}`, "preferencia"],
    [/quiero que (.+?)[.!?\n]/i, (m) => `${userName} quiere que ${m[1].trim()}`, "preferencia"],
    [/trabajo (?:como|en) (.+?)[.!?\n]/i, (m) => `${userName} trabaja como/en ${m[1].trim()}`, "hecho"],
    [/vivo en (.+?)[.!?\n]/i, (m) => `${userName} vive en ${m[1].trim()}`, "hecho"],
    [/me gusta (.+?)[.!?\n]/i, (m) => `A ${userName} le gusta ${m[1].trim()}`, "preferencia"],
    [/odio (.+?)[.!?\n]/i, (m) => `A ${userName} no le gusta ${m[1].trim()}`, "preferencia"],
  ];
  for (const [regex, build, category] of rules) {
    const m = text.match(regex);
    if (m) out.push({ content: build(m), category });
  }
  return out.slice(0, 5);
}

/**
 * El bucle de aprendizaje: analiza los últimos mensajes de una conversación
 * y extrae aprendizajes duraderos. Cadena: cerebro Colab → LLM respaldo → heurística.
 */
export async function extractLearnings(conversationId: string): Promise<Learning[]> {
  const settings = await getSettings();
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  messages.reverse();
  const recent = messages.filter((m) => m.role !== "system");
  if (recent.length === 0) return [];

  const transcript = recent.map((m) => `${m.role === "user" ? settings.userName : settings.botName}: ${m.content}`).join("\n");
  const extractionPrompt: LlmMessage[] = [
    {
      role: "system",
      content: `Eres el módulo de auto-aprendizaje de ${settings.botName}, la IA personal de ${settings.userName}. Analiza el siguiente fragmento de conversación y extrae SOLO información nueva, valiosa y duradera para recordar (preferencias, datos personales, cómo tratar a ${settings.userName}, habilidades, decisiones). Ignora chismes temporales, saludos y preguntas triviales. Responde ÚNICAMENTE con un array JSON válido: [{"content": "aprendizaje en 3ª persona", "category": "preferencia|hecho|personalidad|habilidad|general"}]. Si no hay nada que valga la pena, responde [].`,
    },
    { role: "user", content: transcript.slice(0, 4000) },
  ];

  let candidates: { content: string; category?: string }[] = [];
  try {
    if (settings.colabUrl) {
      const raw = await chatWithColab(settings.colabUrl, extractionPrompt, { maxTokens: 400, temperature: 0.2 });
      candidates = parseLearningJson(raw);
    } else {
      throw new Error("sin cerebro");
    }
  } catch {
    try {
      const raw = await chatWithFallback(extractionPrompt);
      candidates = parseLearningJson(raw);
    } catch {
      candidates = heuristicExtract(transcript, settings.userName);
    }
  }

  return saveLearnings(candidates, "auto");
}

function parseLearningJson(raw: string): { content: string; category?: string }[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { content?: string; category?: string }[];
    return parsed
      .filter((item) => typeof item.content === "string")
      .map((item) => ({ content: item.content, category: item.category }));
  } catch {
    return [];
  }
}
