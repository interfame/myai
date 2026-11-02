// POST /api/sandboxes — guarda una app HTML creada por la IA (para previsualizarla y abrirla en pestaña)
// GET  /api/sandboxes — lista la galería de apps

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_CHARS = 200_000;

export async function GET() {
  const sandboxes = await db.sandbox.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ sandboxes });
}

export async function POST(req: NextRequest) {
  let body: { html?: string; title?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const html = body.html?.trim();
  if (!html) {
    return NextResponse.json({ error: "Falta el HTML" }, { status: 400 });
  }
  if (html.length > MAX_HTML_CHARS) {
    return NextResponse.json({ error: "La app es demasiado grande (máx 200k caracteres)" }, { status: 413 });
  }

  // Título: el que venga, o el <title> del HTML, o el primer <h1>
  let title = body.title?.trim() ?? "";
  if (!title) {
    const t = html.match(/<title>([^<]{1,80})<\/title>/i)?.[1];
    const h1 = html.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i)?.[1];
    title = (t ?? h1 ?? "App sin título").trim();
  }
  title = title.slice(0, 80);

  const sandbox = await db.sandbox.create({
    data: { title, html, conversationId: body.conversationId ?? null },
  });

  return NextResponse.json({
    sandbox: { id: sandbox.id, title: sandbox.title, createdAt: sandbox.createdAt },
  });
}
