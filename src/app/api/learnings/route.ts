// GET/POST /api/learnings — memoria evolutiva de la IA

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveLearnings } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDTO(l: {
  id: string;
  content: string;
  category: string;
  source: string;
  strength: number;
  active: boolean;
  createdAt: Date;
}) {
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

export async function GET() {
  const learnings = await db.learning.findMany({
    orderBy: [{ strength: "desc" }, { lastReinforcedAt: "desc" }],
  });
  return NextResponse.json({ learnings: learnings.map(toDTO) });
}

export async function POST(req: NextRequest) {
  let body: { content?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "El contenido está vacío" }, { status: 400 });
  }
  const [learning] = await saveLearnings(
    [{ content: body.content, category: body.category }],
    "manual"
  );
  if (!learning) {
    return NextResponse.json({ error: "No se pudo guardar el aprendizaje" }, { status: 400 });
  }
  return NextResponse.json({ learning: toDTO(learning) });
}
