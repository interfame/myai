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

export async function getHealthStatus(): Promise<HealthPayload> {
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
