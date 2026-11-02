// GET/PUT /api/settings — ajustes del robot (cerebro, personalidad, aprendizaje)

import { NextRequest, NextResponse } from "next/server";
import type { Setting } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { invalidateHealthCache } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSettingsDTO(s: Setting) {
  return {
    botName: s.botName,
    userName: s.userName,
    systemPrompt: s.systemPrompt,
    autoLearn: s.autoLearn,
    colabUrl: s.colabUrl,
    colabSecret: s.colabSecret,
  };
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings: toSettingsDTO(settings) });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const current = await getSettings();

  const cleanText = (value: unknown, fallback: string, max: number) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : fallback;
  };

  const cleanOptionalUrl = (value: unknown, fallback: string | null) => {
    if (value === undefined) return fallback;
    if (value === null || value === "") return null;
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return /^https?:\/\//.test(trimmed) ? trimmed.replace(/\/+$/, "") : fallback;
  };

  const updated = await db.setting.update({
    where: { id: current.id },
    data: {
      botName: cleanText(body.botName, current.botName, 40),
      userName: cleanText(body.userName, current.userName, 40),
      systemPrompt:
        typeof body.systemPrompt === "string"
          ? body.systemPrompt.slice(0, 4000)
          : current.systemPrompt,
      autoLearn: typeof body.autoLearn === "boolean" ? body.autoLearn : current.autoLearn,
      colabUrl: cleanOptionalUrl(body.colabUrl, current.colabUrl),
      colabSecret: cleanOptionalUrl(body.colabSecret, current.colabSecret),
    },
  });

  invalidateHealthCache();
  return NextResponse.json({ settings: toSettingsDTO(updated) });
}
