// POST /api/tunnel/register — el notebook de Colab registra aquí la URL de su túnel
// así el cerebro se conecta SOLO a la plataforma (auto-registro, sin copiar/pegar).
// Con CORS abierto porque la llamada viene desde Google Colab (otro origen).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { invalidateHealthCache } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: { url?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: CORS_HEADERS });
  }

  const url = body.url?.trim().replace(/\/+$/, "");
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json(
      { error: "URL del túnel inválida" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const settings = await getSettings();
  if (settings.colabSecret && body.secret !== settings.colabSecret) {
    return NextResponse.json(
      { error: "Secreto incorrecto" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  await db.setting.update({
    where: { id: settings.id },
    data: {
      colabUrl: url,
      // bootstrap: si no había secreto, el primero que registra lo fija
      ...(settings.colabSecret ? {} : body.secret ? { colabSecret: body.secret } : {}),
    },
  });
  invalidateHealthCache();

  return NextResponse.json(
    { ok: true, url, message: "Cerebro registrado. La plataforma ya habla con Colab." },
    { headers: CORS_HEADERS }
  );
}
