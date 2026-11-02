// MyAI — Cliente del cerebro
// Modo COLAB: Llama-3-8B-Uncensored servido en Google Colab vía túnel (cloudflared/ngrok)
// Modo FALLBACK: LLM local del SDK (mantiene la plataforma viva si Colab está apagado)

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BrainPing {
  online: boolean;
  latencyMs: number | null;
  model: string | null;
}

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Ping a /health del cerebro en Colab */
export async function pingBrain(url: string | null | undefined): Promise<BrainPing> {
  if (!url) return { online: false, latencyMs: null, model: null };
  const start = Date.now();
  try {
    const res = await fetch(`${cleanUrl(url)}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { model?: string };
    return { online: true, latencyMs: Date.now() - start, model: data.model ?? null };
  } catch {
    return { online: false, latencyMs: null, model: null };
  }
}

/** Stream de tokens desde el cerebro Colab (SSE: data: {"token": "..."}) */
export async function* streamFromColab(
  url: string,
  messages: LlmMessage[],
  opts?: { maxTokens?: number; temperature?: number }
): AsyncGenerator<string> {
  const res = await fetch(`${cleanUrl(url)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      stream: true,
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.8,
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok || !res.body) throw new Error(`Colab respondió HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        if (json.error) throw new Error(String(json.error));
        if (typeof json.token === "string" && json.token.length > 0) yield json.token;
      } catch {
        //fragmento malformado: ignorar
      }
    }
  }
}

/** Respuesta completa (sin stream) desde el cerebro Colab — usada para extraer aprendizajes */
export async function chatWithColab(
  url: string,
  messages: LlmMessage[],
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const res = await fetch(`${cleanUrl(url)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      stream: false,
      max_tokens: opts?.maxTokens ?? 512,
      temperature: opts?.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Colab respondió HTTP ${res.status}`);
  const data = (await res.json()) as { content?: string; error?: string };
  if (data.error) throw new Error(data.error);
  const content = data.content ?? "";
  if (!content.trim()) throw new Error("Colab devolvió respuesta vacía");
  return content;
}

/** Fallback: LLM del SDK (backend only). Mapea system→assistant según convención del SDK */
export async function chatWithFallback(messages: LlmMessage[]): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: messages.map((m) => ({
      role: m.role === "system" ? "assistant" : m.role,
      content: m.content,
    })) as never,
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("El LLM de respaldo devolvió respuesta vacía");
  return content;
}
