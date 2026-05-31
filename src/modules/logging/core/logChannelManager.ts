import { ChannelType, PermissionFlagsBits, type Guild, type TextChannel } from "discord.js";
import { LogConfigModel } from "../../../database/models/LogConfig.js";
import {
  LOG_CATEGORIES,
  LOG_CATEGORY_META,
  LOG_CATEGORY_NAME,
  type LogCategory,
} from "./logCategories.js";
import { getCachedLogConfig, invalidateLogConfigCache } from "../../../services/logConfigCache.js";
import { createLogger } from "../../../services/logger.js";

const log = createLogger("log-channel-manager");

function categoryPath(category: LogCategory): `categories.${LogCategory}.channelId` {
  return `categories.${category}.channelId`;
}

function enabledPath(category: LogCategory): `categories.${LogCategory}.enabled` {
  return `categories.${category}.enabled`;
}

export async function resolveLogChannelId(
  guildId: string,
  category: LogCategory,
): Promise<string | null> {
  const cfg = await getCachedLogConfig(guildId);
  if (!cfg) return null;
  const disabled =
    cfg.disabledCategories.includes(category) ||
    cfg.categories[category]?.enabled === false;
  if (disabled) return null;
  return cfg.categories[category]?.channelId ?? null;
}

export async function resolveLogChannel(
  guild: Guild,
  category: LogCategory,
): Promise<TextChannel | null> {
  const id = await resolveLogChannelId(guild.id, category);
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (!channel?.isTextBased()) return null;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return null;
  }
  return channel as TextChannel;
}

async function ensureCategory(guild: Guild) {
  const existing = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildCategory && ch.name === LOG_CATEGORY_NAME,
  );
  if (existing) return existing;
  return guild.channels.create({
    name: LOG_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.SendMessages],
      },
    ],
    reason: "Automatic logging setup",
  });
}

export async function ensureLoggingChannelsSetup(
  guild: Guild,
): Promise<Record<LogCategory, string | null>> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const category = await ensureCategory(guild);

  const map = {} as Record<LogCategory, string | null>;
  for (const key of LOG_CATEGORIES) {
    const spec = LOG_CATEGORY_META[key];
    const existing = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name === spec.defaultChannelName &&
        (ch.parentId === category?.id || ch.parent?.name === LOG_CATEGORY_NAME),
    );
    let channelId = existing?.id ?? null;

    if (!channelId) {
      const created = await guild.channels.create({
        name: spec.defaultChannelName,
        type: ChannelType.GuildText,
        parent: category?.id,
        topic: `${spec.title} — otomatik oluşturuldu`,
        reason: "Automatic logging setup",
      });
      if (me) {
        await created.permissionOverwrites.edit(me.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }
      channelId = created.id;
    }

    map[key] = channelId;
  }

  const setPayload: Record<string, unknown> = {
    guildId: guild.id,
    categoryId: category?.id ?? null,
  };

  for (const key of LOG_CATEGORIES) {
    setPayload[categoryPath(key)] = map[key];
    setPayload[enabledPath(key)] = true;
  }

  // Geriye dönük uyumluluk için legacy channel alanlarını da yaz.
  setPayload["channels.memberLogs"] = map.member;
  setPayload["channels.messageLogs"] = map.message;
  setPayload["channels.moderationLogs"] = map.moderation;
  setPayload["channels.modLogs"] = map.moderation;
  setPayload["channels.voiceLogs"] = map.voice;
  setPayload["channels.roleLogs"] = map.role;
  setPayload["channels.channelLogs"] = map.channel;
  setPayload["channels.serverLogs"] = map.server;
  setPayload["channels.inviteLogs"] = map.invite;
  setPayload["channels.emojiStickerLogs"] = map.emojiSticker;
  setPayload["channels.emojiLogs"] = map.emojiSticker;
  setPayload["channels.threadLogs"] = map.thread;
  setPayload["channels.webhookLogs"] = map.webhook;
  setPayload["channels.integrationLogs"] = map.integration;
  setPayload["channels.automodLogs"] = map.automod;

  await LogConfigModel.updateOne({ guildId: guild.id }, { $set: setPayload }, { upsert: true });
  invalidateLogConfigCache(guild.id);
  return map;
}

export async function setCategoryChannel(
  guildId: string,
  category: LogCategory,
  channelId: string | null,
): Promise<void> {
  const setPayload: Record<string, unknown> = {
    guildId,
    [categoryPath(category)]: channelId,
    [enabledPath(category)]: true,
  };
  await LogConfigModel.updateOne({ guildId }, { $set: setPayload }, { upsert: true });
  invalidateLogConfigCache(guildId);
}

export async function setCategoryEnabled(
  guildId: string,
  category: LogCategory,
  enabled: boolean,
): Promise<void> {
  await LogConfigModel.updateOne(
    { guildId },
    { $set: { guildId, [enabledPath(category)]: enabled } },
    { upsert: true },
  );
  invalidateLogConfigCache(guildId);
}

export async function getCategoryStates(guildId: string): Promise<
  Record<LogCategory, { enabled: boolean; channelId: string | null }>
> {
  const cfg = await getCachedLogConfig(guildId);
  const states = {} as Record<LogCategory, { enabled: boolean; channelId: string | null }>;
  for (const key of LOG_CATEGORIES) {
    states[key] = {
      enabled:
        !(cfg?.disabledCategories.includes(key) ?? false) &&
        cfg?.categories[key]?.enabled !== false,
      channelId: cfg?.categories[key]?.channelId ?? null,
    };
  }
  return states;
}

export async function validateLogChannelPermissions(
  guild: Guild,
  channelId: string,
): Promise<boolean> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  const ok = Boolean(
    perms?.has(PermissionFlagsBits.ViewChannel) &&
      perms.has(PermissionFlagsBits.SendMessages) &&
      perms.has(PermissionFlagsBits.EmbedLinks),
  );
  if (!ok) {
    log.warn("Log channel permission missing", { guildId: guild.id, channelId });
  }
  return ok;
}
