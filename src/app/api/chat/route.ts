// POST /api/chat — el corazón de MyAI
// SSE: meta → deltas → learnings → done. Cerebro: Colab (Llama-3-8B-Uncensored) o respaldo local.

import { NextRequest, NextResponse } from "next/server";
import type { Learning } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildSystemPrompt, extractLearnings } from "@/lib/memory";
import {
  pingBrain,
  streamFromColab,
  chatWithFallback,
  type LlmMessage,
} from "@/lib/brain";
import { invalidateHealthCache } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toLearningDTO(l: Learning) {
  return {
    id: l.id,
    content: l.content,
    category: l.category,
    source: l.source,
    strength: l.strength,
    active: l.active,
    createdAt: l.createdAt.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });
  }

  const settings = await getSettings();

  const found = body.conversationId
    ? await db.conversation.findUnique({ where: { id: body.conversationId } })
    : null;
  const conversation =
    found ?? (await db.conversation.create({ data: { title: message.slice(0, 60) } }));

  const userMessage = await db.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  // Memoria aprendida → inyectada en el cerebro (auto-consulta del bucle de retroalimentación)
  const learnings = await db.learning.findMany({
    where: { active: true },
    orderBy: [{ strength: "desc" }, { lastReinforcedAt: "desc" }],
    take: 30,
  });
  const systemPrompt = buildSystemPrompt(settings, learnings);

  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  history.reverse();

  const llmMessages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
  ];

  const brain = await pingBrain(settings.colabUrl);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let content = "";
      let engine: "colab" | "fallback" = brain.online ? "colab" : "fallback";

      send({
        type: "meta",
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        engine,
      });

      try {
        if (engine === "colab" && settings.colabUrl) {
          try {
            for await (const token of streamFromColab(settings.colabUrl, llmMessages)) {
              content += token;
              send({ type: "delta", text: token });
            }
            if (!content.trim()) throw new Error("El cerebro no devolvió tokens");
          } catch {
            // El cerebro Colab falló → conmutar a respaldo sin romper la experiencia
            engine = "fallback";
            send({ type: "engine", engine });
            content = "";
          }
        }

        if (engine === "fallback") {
          content = await chatWithFallback(llmMessages);
          const chunks = content.match(/[\s\S]{1,60}/g) ?? [content];
          for (const chunk of chunks) {
            send({ type: "delta", text: chunk });
            await new Promise((r) => setTimeout(r, 25));
          }
        }

        const assistantMessage = await db.message.create({
          data: { conversationId: conversation.id, role: "assistant", content },
        });
        await db.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        // Bucle de aprendizaje: la IA filtra lo valioso y lo guarda sola
        if (settings.autoLearn) {
          try {
            const extracted = await extractLearnings(conversation.id);
            if (extracted.length > 0) {
              send({ type: "learnings", learnings: extracted.map(toLearningDTO) });
            }
          } catch {
            // un fallo de aprendizaje no debe romper el chat
          }
        }

        send({
          type: "done",
          assistantMessageId: assistantMessage.id,
          content,
          conversationTitle: conversation.title,
        });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Error desconocido del cerebro",
        });
      } finally {
        invalidateHealthCache();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
