// GET /api/sandboxes/[id]/raw — sirve el HTML crudo de una app del sandbox
// (para abrir la app en una pestaña nueva o embeberla)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sandbox = await db.sandbox.findUnique({ where: { id } });
  if (!sandbox) {
    return NextResponse.json({ error: "App no encontrada" }, { status: 404 });
  }

  return new Response(sandbox.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Permite embeber en iframe desde la misma plataforma
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
