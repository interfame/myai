// POST /api/learn/extract — análisis manual: extrae aprendizajes de una conversación

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractLearnings } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId requerido" }, { status: 400 });
  }
  const conversation = await db.conversation.findUnique({
    where: { id: body.conversationId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  const extracted = await extractLearnings(body.conversationId);
  return NextResponse.json({
    extracted: extracted.map((l) => ({
      id: l.id,
      content: l.content,
      category: l.category,
      source: l.source,
      strength: l.strength,
      active: l.active,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
