/**
 * İzinli sunucu listesi için bellek önbelleği.
 * TTL dolunca MongoDB'den yeniden yüklenir.
 */
import { AllowedGuildModel } from "../database/models/AllowedGuild.js";

const CACHE_TTL_MS = 60_000; // 1 dakika

let cachedSet: Set<string> | null = null;
let lastFetch = 0;

async function loadCache(): Promise<Set<string>> {
  const docs = await AllowedGuildModel.find({}).select("guildId").lean();
  return new Set(docs.map((d) => d.guildId));
}

export async function isGuildAllowed(guildId: string): Promise<boolean> {
  const now = Date.now();
  if (!cachedSet || now - lastFetch > CACHE_TTL_MS) {
    cachedSet = await loadCache();
    lastFetch = now;
  }
  return cachedSet.has(guildId);
}

/** Önbelleği hemen geçersiz kıl (izin ekle/kaldır sonrası çağrılır). */
export function invalidateAllowedGuildCache(): void {
  cachedSet = null;
  lastFetch = 0;
}

/** Önbellekteki tüm izinli guild ID'lerini döner (ready sweep için). */
export async function getAllowedGuildIds(): Promise<Set<string>> {
  const now = Date.now();
  if (!cachedSet || now - lastFetch > CACHE_TTL_MS) {
    cachedSet = await loadCache();
    lastFetch = now;
  }
  return new Set(cachedSet);
}
