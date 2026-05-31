import type { Guild, VoiceChannel, VoiceState } from "discord.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "../../services/guildSettingsCache.js";
import { getRedis } from "../../services/redis.js";
import { redisKeys } from "../../config/redisKeys.js";
import { createLogger } from "../../services/logger.js";
import { postTempVoicePanel, clearTempVoiceRedis } from "./panel.js";

const log = createLogger("tempvc");

function ownerKey(channelId: string): string {
  return redisKeys.tempVoiceOwner(channelId);
}

/** Kategorideki (veya sunucudaki) geçici ses kanalları arasında Redis sahibi bu kullanıcı olanları bulur. */
async function findOwnedTempVoiceChannel(
  guild: Guild,
  userId: string,
  categoryId: string | undefined,
  hubChannelId: string,
  redis: ReturnType<typeof getRedis>,
): Promise<VoiceChannel | null> {
  const rows: VoiceChannel[] = [];
  for (const ch of guild.channels.cache.values()) {
    if (ch.type !== ChannelType.GuildVoice) continue;
    if (ch.id === hubChannelId) continue;
    if (categoryId) {
      if (ch.parentId !== categoryId) continue;
    } else if (ch.parentId != null) {
      continue;
    }
    rows.push(ch as VoiceChannel);
  }
  if (rows.length === 0) return null;

  const pipeline = redis.pipeline();
  for (const ch of rows) pipeline.get(ownerKey(ch.id));
  const exec = await pipeline.exec();
  if (!exec) return null;

  const owned: VoiceChannel[] = [];
  for (let i = 0; i < rows.length; i++) {
    const reply = exec[i]?.[1];
    const val = typeof reply === "string" ? reply : null;
    if (val === userId) owned.push(rows[i]);
  }
  if (owned.length === 0) return null;
  if (owned.length === 1) return owned[0];

  const inVoice = owned.find((c) => c.members.has(userId));
  if (inVoice) return inVoice;
  owned.sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0));
  return owned[0];
}

async function moveMemberToTempChannel(
  guild: Guild,
  userId: string,
  channel: VoiceChannel,
  redis: ReturnType<typeof getRedis>,
): Promise<void> {
  const userChKey = redisKeys.tempVoiceUserChannel(guild.id, userId);
  await redis.set(userChKey, channel.id, "EX", 86400);
  const member = await guild.members.fetch(userId);
  if (member.voice.channel) {
    await member.voice.setChannel(channel.id).catch(() => null);
  }
}

export async function handleVoiceState(oldS: VoiceState, newS: VoiceState): Promise<void> {
  const guild = newS.guild ?? oldS.guild;
  if (!guild) return;

  const cfg = await getGuildConfig(guild.id);
  if (!cfg?.modules?.tempVoice) return;
  const hubId = cfg.tempVoice?.hubChannelId;
  if (!hubId) return;

  const inHub =
    newS.channelId != null &&
    String(newS.channelId) === String(hubId) &&
    String(oldS.channelId ?? "") !== String(hubId);

  if (inHub && newS.member) {
    await createTempChannel(guild, newS.member.id, cfg, hubId).catch((e) =>
      log.error("createTempChannel failed", { err: String(e) }),
    );
    return;
  }

  const leftId = oldS.channelId;
  if (!leftId) return;
  const redis = getRedis();
  const owner = await redis.get(ownerKey(leftId));
  if (!owner) return;
  const ch = guild.channels.cache.get(leftId) as VoiceChannel | undefined;
  if (ch && ch.members.size === 0) {
    setTimeout(async () => {
      try {
        const fresh = (await guild.channels.fetch(leftId).catch(() => null)) as
          | VoiceChannel
          | null;
        if (fresh && fresh.members.size === 0) {
          await fresh.delete("Temporary voice empty");
          await clearTempVoiceRedis(leftId, guild.id);
        }
      } catch {
        /* ignore */
      }
    }, 5000);
  }
}

async function createTempChannel(
  guild: Guild,
  userId: string,
  cfg: Awaited<ReturnType<typeof getGuildConfig>>,
  hubChannelId: string,
): Promise<void> {
  if (!cfg?.tempVoice) return;
  const me = guild.members.me;
  if (!me) return;

  const redis = getRedis();
  const lockKey = redisKeys.tempVoiceCreateLock(guild.id, userId);
  const gotLock = await redis.set(lockKey, "1", "EX", 90, "NX");
  if (gotLock !== "OK") return;

  try {
    const categoryId = cfg.tempVoice.categoryId ?? undefined;

    const userChKey = redisKeys.tempVoiceUserChannel(guild.id, userId);
    const existingId = await redis.get(userChKey);
    if (existingId) {
      const existing = await guild.channels.fetch(existingId).catch(() => null);
      const own = await redis.get(ownerKey(existingId));
      if (
        existing?.type === ChannelType.GuildVoice &&
        existing.guildId === guild.id &&
        own === userId
      ) {
        await moveMemberToTempChannel(guild, userId, existing as VoiceChannel, redis);
        return;
      }
      await redis.del(userChKey);
    }

    let ownedVc = await findOwnedTempVoiceChannel(
      guild,
      userId,
      categoryId,
      hubChannelId,
      redis,
    );
    if (!ownedVc) {
      await guild.channels.fetch().catch(() => null);
      ownedVc = await findOwnedTempVoiceChannel(
        guild,
        userId,
        categoryId,
        hubChannelId,
        redis,
      );
    }
    if (ownedVc) {
      await moveMemberToTempChannel(guild, userId, ownedVc, redis);
      return;
    }
    const member = await guild.members.fetch(userId);
    const template = cfg.tempVoice.nameTemplate ?? "🦉 {displayName} Yuvası";
    const name = template
      .replaceAll("{displayName}", member.displayName)
      .replaceAll("{username}", member.user.username)
      .replaceAll("{user}", member.user.username)
      .slice(0, 90);
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: categoryId ?? null,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.Connect],
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.MoveMembers,
          ],
        },
        {
          id: me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });
    await redis.set(ownerKey(channel.id), userId, "EX", 86400);
    await redis.set(userChKey, channel.id, "EX", 86400);
    if (member.voice.channel) {
      await member.voice.setChannel(channel).catch(() => null);
    }
    const openedAt = new Date();
    await postTempVoicePanel(channel, userId, guild, openedAt).catch((e) =>
      log.error("postTempVoicePanel failed", { err: String(e) }),
    );
  } finally {
    await redis.del(lockKey).catch(() => null);
  }
}
