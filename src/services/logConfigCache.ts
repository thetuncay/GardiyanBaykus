import { LogConfigModel } from "../database/models/LogConfig.js";
import { LOG_CONFIG_CACHE_TTL_MS } from "../config/constants.js";
import { LruCache } from "../utils/lruCache.js";
import {
  LEGACY_CHANNEL_KEYS,
  LOG_CATEGORIES,
  type LogCategory,
} from "../modules/logging/core/logCategories.js";

export type NormalizedCategoryConfig = {
  enabled: boolean;
  channelId: string | null;
};

export type NormalizedLogConfig = {
  guildId: string;
  categoryId: string | null;
  disabledEvents: string[];
  disabledCategories: string[];
  ignoredChannels: string[];
  ignoredRoles: string[];
  ignoreBots: boolean;
  categories: Record<LogCategory, NormalizedCategoryConfig>;
  channels: Record<string, string | null>;
};

type Cached = { doc: NormalizedLogConfig | null; expiresAt: number };

const memory = new LruCache<string, Cached>(500);

function normalizeCategory(raw: unknown): NormalizedCategoryConfig {
  if (!raw || typeof raw !== "object") return { enabled: true, channelId: null };
  const cfg = raw as { enabled?: unknown; channelId?: unknown };
  return {
    enabled: cfg.enabled !== false,
    channelId: typeof cfg.channelId === "string" ? cfg.channelId : null,
  };
}

function normalizeLogConfig(raw: any): NormalizedLogConfig {
  const channels: Record<string, string | null> = {};
  const categories = {} as Record<LogCategory, NormalizedCategoryConfig>;

  for (const category of LOG_CATEGORIES) {
    const fromCategory = normalizeCategory(raw?.categories?.[category]);
    let channelId = fromCategory.channelId;
    if (!channelId) {
      const legacyKeys = LEGACY_CHANNEL_KEYS[category];
      for (const key of legacyKeys) {
        const legacyId = raw?.channels?.[key];
        if (typeof legacyId === "string" && legacyId) {
          channelId = legacyId;
          break;
        }
      }
    }
    categories[category] = { enabled: fromCategory.enabled, channelId };
  }

  if (raw?.channels && typeof raw.channels === "object") {
    for (const [key, value] of Object.entries(raw.channels)) {
      channels[key] = typeof value === "string" ? value : null;
    }
  }

  // Geriye dönük: eski kodun cfg.channels[legacyKey] erişimleri çalışsın.
  channels.memberLogs = categories.member.channelId;
  channels.messageLogs = categories.message.channelId;
  channels.moderationLogs = categories.moderation.channelId;
  channels.modLogs = categories.moderation.channelId;
  channels.voiceLogs = categories.voice.channelId;
  channels.roleLogs = categories.role.channelId;
  channels.channelLogs = categories.channel.channelId;
  channels.serverLogs = categories.server.channelId;
  channels.inviteLogs = categories.invite.channelId;
  channels.emojiStickerLogs = categories.emojiSticker.channelId;
  channels.emojiLogs = categories.emojiSticker.channelId;
  channels.threadLogs = categories.thread.channelId;
  channels.webhookLogs = categories.webhook.channelId;
  channels.integrationLogs = categories.integration.channelId;
  channels.automodLogs = categories.automod.channelId;

  return {
    guildId: raw?.guildId ?? "",
    categoryId: typeof raw?.categoryId === "string" ? raw.categoryId : null,
    disabledEvents: Array.isArray(raw?.disabledEvents) ? raw.disabledEvents : [],
    disabledCategories: Array.isArray(raw?.disabledCategories) ? raw.disabledCategories : [],
    ignoredChannels: Array.isArray(raw?.ignoredChannels) ? raw.ignoredChannels : [],
    ignoredRoles: Array.isArray(raw?.ignoredRoles) ? raw.ignoredRoles : [],
    ignoreBots: raw?.ignoreBots !== false,
    categories,
    channels,
  };
}

export async function getCachedLogConfig(guildId: string): Promise<NormalizedLogConfig | null> {
  const now = Date.now();
  const hit = memory.get(guildId);
  if (hit && hit.expiresAt > now) return hit.doc;

  const raw = await LogConfigModel.findOne({ guildId }).lean();
  const doc = raw ? normalizeLogConfig(raw) : null;
  memory.set(guildId, { doc, expiresAt: now + LOG_CONFIG_CACHE_TTL_MS });
  return doc;
}

export function invalidateLogConfigCache(guildId: string): void {
  memory.delete(guildId);
}
