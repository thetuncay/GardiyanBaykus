import type { Client, Guild, VoiceChannel } from "discord.js";
import { VoiceRoomModel } from "../../database/models/VoiceRoom.js";
import { getRedis } from "../../services/redis.js";
import { redisKeys } from "../../config/redisKeys.js";
import { createLogger } from "../../services/logger.js";
import type { VoiceProfileDoc } from "../../database/models/VoiceProfile.js";
import { getVoiceProfile } from "./profileService.js";

const log = createLogger("tempvc-room");
const TTL = 86_400;

const ownerKey = (channelId: string) => redisKeys.tempVoiceOwner(channelId);
const publicKey = (channelId: string) => redisKeys.tempVoicePublic(channelId);
const hiddenKey = (channelId: string) => redisKeys.tempVoiceHidden(channelId);

export async function registerVoiceRoom(
  guildId: string,
  channelId: string,
  ownerId: string,
): Promise<void> {
  await VoiceRoomModel.updateOne(
    { channelId },
    { $set: { guildId, channelId, ownerId, openedAt: new Date() } },
    { upsert: true },
  );
}

export async function removeVoiceRoom(channelId: string): Promise<void> {
  await VoiceRoomModel.deleteOne({ channelId });
}

/** Kalıcı profile göre kanal izinlerini ve ayarlarını uygular. */
export async function applyProfileToChannel(
  channel: VoiceChannel,
  guild: Guild,
  ownerId: string,
  profile: VoiceProfileDoc | null,
): Promise<void> {
  if (!profile) return;

  const redis = getRedis();
  const botId = guild.client.user?.id;
  if (!botId) return;

  if (profile.channelName) {
    await channel.setName(profile.channelName.slice(0, 100), "VoiceProfile restore").catch(() => null);
  }

  if (profile.userLimit != null && profile.userLimit >= 0) {
    await channel.setUserLimit(profile.userLimit, "VoiceProfile restore").catch(() => null);
  }

  if (profile.bitrate != null && profile.bitrate >= 8000) {
    const maxBps = guild.maximumBitrate;
    const bps = Math.min(Math.max(profile.bitrate, 8000), maxBps);
    await channel.setBitrate(bps, "VoiceProfile restore").catch(() => null);
  }

  for (const bannedId of profile.bannedUserIds ?? []) {
    if (bannedId === ownerId) continue;
    await channel.permissionOverwrites
      .edit(bannedId, { Connect: false, ViewChannel: false })
      .catch(() => null);
  }

  for (const allowedId of profile.allowedUserIds ?? []) {
    if (allowedId === ownerId) continue;
    if ((profile.bannedUserIds ?? []).includes(allowedId)) continue;
    await channel.permissionOverwrites
      .edit(allowedId, { ViewChannel: true, Connect: true })
      .catch(() => null);
  }

  const everyone = guild.roles.everyone;

  if (profile.everyonePublic) {
    await channel.permissionOverwrites.edit(everyone, { Connect: true }).catch(() => null);
    await redis.set(publicKey(channel.id), "1", "EX", TTL);
  } else {
    await channel.permissionOverwrites.edit(everyone, { Connect: false }).catch(() => null);
    await redis.del(publicKey(channel.id));
  }

  if (profile.hidden) {
    await redis.set(hiddenKey(channel.id), "1", "EX", TTL);
    await channel.permissionOverwrites
      .edit(everyone, { ViewChannel: false, Connect: false })
      .catch(() => null);
    await channel.permissionOverwrites
      .edit(ownerId, { ViewChannel: true, Connect: true })
      .catch(() => null);
    await channel.permissionOverwrites
      .edit(botId, {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
        ReadMessageHistory: true,
      })
      .catch(() => null);
  } else {
    await redis.del(hiddenKey(channel.id));
    await channel.permissionOverwrites
      .edit(everyone, { ViewChannel: true, Connect: false })
      .catch(() => null);
  }
}

async function syncRedisFromProfile(
  channelId: string,
  guildId: string,
  ownerId: string,
  profile: VoiceProfileDoc | null,
): Promise<void> {
  const redis = getRedis();
  await redis.set(ownerKey(channelId), ownerId, "EX", TTL);
  await redis.set(redisKeys.tempVoiceUserChannel(guildId, ownerId), channelId, "EX", TTL);

  if (profile?.everyonePublic) {
    await redis.set(publicKey(channelId), "1", "EX", TTL);
  } else {
    await redis.del(publicKey(channelId));
  }

  if (profile?.hidden) {
    await redis.set(hiddenKey(channelId), "1", "EX", TTL);
  } else {
    await redis.del(hiddenKey(channelId));
  }
}

/** Bot restart sonrası aktif oda kayıtlarını doğrular ve Redis'i senkronize eder. */
export async function recoverTempVoiceRooms(client: Client): Promise<void> {
  const rooms = await VoiceRoomModel.find({}).lean();
  if (rooms.length === 0) return;

  let cleaned = 0;
  let synced = 0;

  for (const room of rooms) {
    const guild = client.guilds.cache.get(room.guildId);
    if (!guild) {
      await VoiceRoomModel.deleteOne({ channelId: room.channelId });
      cleaned++;
      continue;
    }

    const ch = (await guild.channels.fetch(room.channelId).catch(() => null)) as VoiceChannel | null;
    if (!ch?.isVoiceBased()) {
      await VoiceRoomModel.deleteOne({ channelId: room.channelId });
      const redis = getRedis();
      const userId = await redis.get(ownerKey(room.channelId));
      await redis.del(
        ownerKey(room.channelId),
        publicKey(room.channelId),
        hiddenKey(room.channelId),
        redisKeys.tempVoicePanelMsg(room.channelId),
        redisKeys.tempVoiceLocked(room.channelId),
        redisKeys.tempVoiceLockBackup(room.channelId),
      );
      if (userId) {
        await redis.del(redisKeys.tempVoiceUserChannel(room.guildId, userId));
      }
      cleaned++;
      continue;
    }

    const profile = await getVoiceProfile(room.guildId, room.ownerId);
    await syncRedisFromProfile(ch.id, room.guildId, room.ownerId, profile);
    synced++;
  }

  log.info("Temp voice recovery tamamlandı", { total: rooms.length, cleaned, synced });
}

/** Redis'te sahibi bilinen ancak DB'de kaydı olmayan kanalları kayda alır. */
export async function reconcileOrphanTempChannels(client: Client): Promise<void> {
  const redis = getRedis();
  let registered = 0;

  for (const [, guild] of client.guilds.cache) {
    for (const [, ch] of guild.channels.cache) {
      if (!ch.isVoiceBased()) continue;
      const ownerId = await redis.get(ownerKey(ch.id));
      if (!ownerId) continue;

      const exists = await VoiceRoomModel.exists({ channelId: ch.id });
      if (exists) continue;

      await registerVoiceRoom(guild.id, ch.id, ownerId);
      registered++;
    }
  }

  if (registered > 0) {
    log.info("Yetim temp voice kanalları kayda alındı", { registered });
  }
}

export async function findActiveRoomByOwner(
  guildId: string,
  ownerId: string,
): Promise<string | null> {
  const room = await VoiceRoomModel.findOne({ guildId, ownerId }).lean();
  return room?.channelId ?? null;
}
