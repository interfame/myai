// GET/POST /api/conversations — lista y creación de conversaciones

import { NextResponse } from "next/server";
import type { Conversation } from "@prisma/client";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSummary(c: Conversation & { _count: { messages: number } }) {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c._count.messages,
  };
}

export async function GET() {
  const conversations = await db.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ conversations: conversations.map(toSummary) });
}

export async function POST() {
  const conversation = await db.conversation.create({
    data: { title: "Nueva conversación" },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ conversation: toSummary(conversation) });
}
