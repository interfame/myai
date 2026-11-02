// GET /api/health — estado de la plataforma (BD + cerebro Colab). ?refresh=1 fuerza re-ping.

import { NextResponse } from "next/server";
import { getHealthStatus, invalidateHealthCache } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("refresh") === "1") invalidateHealthCache();
  // ?url=... sondea esa URL sin guardarla (lo usa «Probar conexión» en Ajustes)
  const status = await getHealthStatus(params.get("url"));
  return NextResponse.json(status);
}
