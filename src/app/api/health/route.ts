// GET /api/health — estado de la plataforma (BD + cerebro Colab). ?refresh=1 fuerza re-ping.

import { NextResponse } from "next/server";
import { getHealthStatus, invalidateHealthCache } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (force) invalidateHealthCache();
  const status = await getHealthStatus();
  return NextResponse.json(status);
}
