// Cache compartido del estado de salud (usado por /api/health y limpiado al cambiar ajustes)

import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { pingBrain } from "@/lib/brain";

export interface HealthPayload {
  ok: boolean;
  brain: {
    configured: boolean;
    online: boolean;
    url: string | null;
    latencyMs: number | null;
    model: string | null;
  };
}

let cache: { at: number; payload: HealthPayload } | null = null;
const TTL_MS = 30_000;

export function invalidateHealthCache() {
  cache = null;
}

export async function getHealthStatus(overrideUrl?: string | null): Promise<HealthPayload> {
  // Sondeo directo de una URL concreta (p. ej. probar en Ajustes la URL escrita sin guardarla).
  // No toca la cache ni persiste nada.
  const candidate = overrideUrl?.trim().replace(/\/+$/, "") ?? "";
  if (candidate) {
    if (!/^https?:\/\//.test(candidate)) {
      return {
        ok: true,
        brain: { configured: true, online: false, url: null, latencyMs: null, model: null },
      };
    }
    let dbOk = true;
    try {
      await db.setting.count();
    } catch {
      dbOk = false;
    }
    const brain = await pingBrain(candidate);
    return {
      ok: dbOk,
      brain: {
        configured: true,
        online: brain.online,
        url: brain.online ? candidate : null,
        latencyMs: brain.latencyMs,
        model: brain.model,
      },
    };
  }

  if (cache && Date.now() - cache.at < TTL_MS) return cache.payload;

  let dbOk = true;
  try {
    await db.setting.count();
  } catch {
    dbOk = false;
  }

  const settings = await getSettings();
  const brain = await pingBrain(settings.colabUrl);

  const payload: HealthPayload = {
    ok: dbOk,
    brain: {
      configured: Boolean(settings.colabUrl),
      online: brain.online,
      url: brain.online ? settings.colabUrl ?? null : null,
      latencyMs: brain.latencyMs,
      model: brain.model,
    },
  };
  cache = { at: Date.now(), payload };
  return payload;
}
