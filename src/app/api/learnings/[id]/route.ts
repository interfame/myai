// PATCH/DELETE /api/learnings/{id} — editar o borrar un aprendizaje

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { active?: boolean; content?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const existing = await db.learning.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Aprendizaje no encontrado" }, { status: 404 });
  }

  const learning = await db.learning.update({
    where: { id },
    data: {
      active: typeof body.active === "boolean" ? body.active : existing.active,
      content: typeof body.content === "string" && body.content.trim()
        ? body.content.trim().slice(0, 400)
        : existing.content,
      category:
        typeof body.category === "string" && body.category.trim()
          ? body.category.trim()
          : existing.category,
    },
  });

  return NextResponse.json({
    learning: {
      id: learning.id,
      content: learning.content,
      category: learning.category,
      source: learning.source,
      strength: learning.strength,
      active: learning.active,
      createdAt: learning.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.learning.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
