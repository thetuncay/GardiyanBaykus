import {
  type AuditLogEvent,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";
import type { AuditConfidence } from "./logCategories.js";

type CacheRow = {
  expiresAt: number;
  entries: GuildAuditLogsEntry<AuditLogEvent>[];
};

const CACHE_TTL_MS = 2_500;
const cache = new Map<string, CacheRow>();
const inflight = new Map<string, Promise<GuildAuditLogsEntry<AuditLogEvent>[]>>();

function cacheKey(guildId: string, type: AuditLogEvent): string {
  return `${guildId}:${type}`;
}

async function fetchCachedEntries(
  guild: Guild,
  type: AuditLogEvent,
  limit = 8,
): Promise<GuildAuditLogsEntry<AuditLogEvent>[]> {
  const key = cacheKey(guild.id, type);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.entries;

  const pending = inflight.get(key);
  if (pending) return pending;

  const runner = guild
    .fetchAuditLogs({ type, limit })
    .then((logs) => [...logs.entries.values()])
    .catch(() => [])
    .finally(() => inflight.delete(key));
  inflight.set(key, runner);
  const entries = await runner;
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, entries });
  return entries;
}

function scoreEntry(params: {
  entry: GuildAuditLogsEntry<AuditLogEvent>;
  now: number;
  targetId?: string | null;
  channelIdHint?: string | null;
  maxAgeMs: number;
}): number {
  const { entry, now, targetId, channelIdHint, maxAgeMs } = params;
  if (!entry.createdTimestamp) return -1;
  const age = now - entry.createdTimestamp;
  if (age < 0 || age > maxAgeMs) return -1;

  let score = 0;
  // En güçlü sinyal: target eşleşmesi.
  if (targetId && entry.targetId === targetId) score += 100;
  if (targetId && entry.targetId !== targetId) score -= 20;

  if (channelIdHint) {
    const extra = entry.extra as { channel?: { id?: string } } | null;
    if (extra?.channel?.id === channelIdHint) score += 40;
  }

  // Daha yeni kayıtları tercih et.
  score += Math.max(0, 20 - Math.floor(age / 1000));
  return score;
}

export async function resolveAuditEntry(params: {
  guild: Guild;
  type: AuditLogEvent;
  targetId?: string | null;
  maxAgeMs?: number;
  channelIdHint?: string | null;
}): Promise<{
  entry: GuildAuditLogsEntry<AuditLogEvent> | null;
  confidence: AuditConfidence;
}> {
  const maxAgeMs = params.maxAgeMs ?? 12_000;
  const entries = await fetchCachedEntries(params.guild, params.type, 8);
  if (!entries.length) return { entry: null, confidence: "NONE" };
  const now = Date.now();
  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreEntry({
        entry,
        now,
        targetId: params.targetId,
        channelIdHint: params.channelIdHint,
        maxAgeMs,
      }),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return { entry: null, confidence: "NONE" };
  const best = ranked[0];

  // Yanlış executor riskini azalt: target bekleniyorsa ama güçlü eşleşme yoksa dönme.
  if (params.targetId && best.score < 60) {
    return { entry: null, confidence: "NONE" };
  }

  if (best.score >= 100) return { entry: best.entry, confidence: "HIGH" };
  if (best.score >= 40) return { entry: best.entry, confidence: "LOW" };
  return { entry: null, confidence: "NONE" };
}

export function clearAuditResolverCache(guildId?: string): void {
  if (!guildId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${guildId}:`)) cache.delete(key);
  }
}
