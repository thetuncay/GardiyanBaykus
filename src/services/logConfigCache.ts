import type { LogConfigDoc } from "../database/models/LogConfig.js";
import { LogConfigModel } from "../database/models/LogConfig.js";
import { LOG_CONFIG_CACHE_TTL_MS } from "../config/constants.js";
import { LruCache } from "../utils/lruCache.js";

type Cached = { doc: LogConfigDoc | null; expiresAt: number };

const memory = new LruCache<string, Cached>(500);

export async function getCachedLogConfig(guildId: string): Promise<LogConfigDoc | null> {
  const now = Date.now();
  const hit = memory.get(guildId);
  if (hit && hit.expiresAt > now) return hit.doc;

  const doc = (await LogConfigModel.findOne({ guildId }).lean()) as LogConfigDoc | null;
  memory.set(guildId, { doc, expiresAt: now + LOG_CONFIG_CACHE_TTL_MS });
  return doc;
}

export function invalidateLogConfigCache(guildId: string): void {
  memory.delete(guildId);
}
