// POST /api/attachments — el Jefe sube archivos y se extrae su texto para que la IA los lea
// Soporta: texto plano (txt/md/csv/json/código) y PDF (extracción con unpdf)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB por archivo
const MAX_CONTENT_CHARS = 15_000; // recorte por archivo al inyectar en el contexto

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|yaml|yml|ini|cfg|conf|log|env|sql|html|htm|css|scss|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|bash|zsh|bat|ps1|toml|gitignore)$/i;

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text).replace(/\u0000/g, "");
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (files.length > 5) {
    return NextResponse.json({ error: "Máximo 5 archivos por mensaje" }, { status: 400 });
  }

  const conversationId = (form.get("conversationId") as string | null) || null;
  const results: {
    id: string;
    name: string;
    size: number;
    truncated: boolean;
    chars: number;
  }[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" supera los 15 MB` },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isText = file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name);

    let content = "";
    if (isPdf) {
      try {
        content = await extractPdfText(buffer);
      } catch {
        return NextResponse.json(
          { error: `No se pudo extraer el texto de "${file.name}" (¿PDF escaneado/corrupto?)` },
          { status: 422 }
        );
      }
    } else if (isText || file.type === "" ) {
      content = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    } else {
      return NextResponse.json(
        {
          error: `"${file.name}" no es un formato legible todavía (usa texto, código, CSV, JSON o PDF)`,
        },
        { status: 415 }
      );
    }

    // Limpieza ligera + recorte
    content = content.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
    const originalChars = content.length;
    const truncated = originalChars > MAX_CONTENT_CHARS;
    if (truncated) content = content.slice(0, MAX_CONTENT_CHARS);

    const attachment = await db.attachment.create({
      data: {
        name: file.name.slice(0, 120),
        mime: file.type || (isPdf ? "application/pdf" : "text/plain"),
        size: file.size,
        content,
        truncated,
        conversationId,
      },
    });

    results.push({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      truncated,
      chars: content.length,
    });
  }

  return NextResponse.json({ attachments: results });
}
