import type { GuildConfigDoc } from "../database/models/GuildConfig.js";
import { GuildConfigModel } from "../database/models/GuildConfig.js";
import {
  GUILD_CACHE_TTL_SEC,
  GUILD_MEMORY_CACHE_MAX,
  GUILD_MEMORY_CACHE_TTL_MS,
} from "../config/constants.js";
import { redisKeys } from "../config/redisKeys.js";
import { getRedis } from "./redis.js";
import { LruCache } from "../utils/lruCache.js";

type MemEntry = { doc: GuildConfigDoc; expiresAt: number };
const memory = new LruCache<string, MemEntry>(GUILD_MEMORY_CACHE_MAX);

export async function getGuildConfig(guildId: string): Promise<GuildConfigDoc | null> {
  const now = Date.now();
  const m = memory.get(guildId);
  if (m && m.expiresAt > now) return m.doc;

  const redis = getRedis();
  const k = redisKeys.guildConfig(guildId);
  const raw = await redis.get(k);
  if (raw) {
    try {
      const doc = JSON.parse(raw) as GuildConfigDoc;
      memory.set(guildId, { doc, expiresAt: now + GUILD_MEMORY_CACHE_TTL_MS });
      return doc;
    } catch {
      await redis.del(k);
    }
  }
  let doc = (await GuildConfigModel.findOne({ guildId }).lean()) as GuildConfigDoc | null;
  if (!doc) {
    const created = await GuildConfigModel.create({ guildId });
    doc = created.toObject() as GuildConfigDoc;
  }
  await redis.set(k, JSON.stringify(doc), "EX", GUILD_CACHE_TTL_SEC);
  memory.set(guildId, { doc, expiresAt: now + GUILD_MEMORY_CACHE_TTL_MS });
  return doc;
}

export async function invalidateGuildConfig(guildId: string): Promise<void> {
  memory.delete(guildId);
  await getRedis().del(redisKeys.guildConfig(guildId));
}

export async function updateGuildConfig(
  guildId: string,
  patch: Partial<GuildConfigDoc>,
): Promise<GuildConfigDoc | null> {
  const updated = await GuildConfigModel.findOneAndUpdate(
    { guildId },
    { $set: patch },
    { new: true, upsert: true },
  ).lean();
  await invalidateGuildConfig(guildId);
  if (updated) {
    const doc = updated as GuildConfigDoc;
    await getRedis().set(redisKeys.guildConfig(guildId), JSON.stringify(doc), "EX", GUILD_CACHE_TTL_SEC);
    memory.set(guildId, { doc, expiresAt: Date.now() + GUILD_MEMORY_CACHE_TTL_MS });
  }
  return updated as GuildConfigDoc | null;
}
