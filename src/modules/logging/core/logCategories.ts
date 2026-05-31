export const LOG_CATEGORIES = [
  "member",
  "message",
  "moderation",
  "voice",
  "role",
  "channel",
  "server",
  "invite",
  "emojiSticker",
  "thread",
  "webhook",
  "integration",
  "automod",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_CATEGORY_META: Record<
  LogCategory,
  { title: string; emoji: string; defaultColor: number; defaultChannelName: string }
> = {
  member: { title: "Üye Logları", emoji: "👥", defaultColor: 0x57f287, defaultChannelName: "member-logs" },
  message: { title: "Mesaj Logları", emoji: "💬", defaultColor: 0x5865f2, defaultChannelName: "message-logs" },
  moderation: { title: "Moderasyon Logları", emoji: "🛡️", defaultColor: 0xed4245, defaultChannelName: "moderation-logs" },
  voice: { title: "Ses Logları", emoji: "🔊", defaultColor: 0x3498db, defaultChannelName: "voice-logs" },
  role: { title: "Rol Logları", emoji: "🎭", defaultColor: 0x9b59b6, defaultChannelName: "role-logs" },
  channel: { title: "Kanal Logları", emoji: "🧱", defaultColor: 0xf1c40f, defaultChannelName: "channel-logs" },
  server: { title: "Sunucu Logları", emoji: "🏰", defaultColor: 0x95a5a6, defaultChannelName: "server-logs" },
  invite: { title: "Davet Logları", emoji: "📨", defaultColor: 0x2ecc71, defaultChannelName: "invite-logs" },
  emojiSticker: {
    title: "Emoji & Sticker Logları",
    emoji: "😀",
    defaultColor: 0xe67e22,
    defaultChannelName: "emoji-sticker-logs",
  },
  thread: { title: "Thread Logları", emoji: "🧵", defaultColor: 0x1abc9c, defaultChannelName: "thread-logs" },
  webhook: { title: "Webhook Logları", emoji: "🪝", defaultColor: 0x7289da, defaultChannelName: "webhook-logs" },
  integration: {
    title: "Entegrasyon Logları",
    emoji: "🔌",
    defaultColor: 0x607d8b,
    defaultChannelName: "integration-logs",
  },
  automod: { title: "AutoMod Logları", emoji: "🤖", defaultColor: 0xed4245, defaultChannelName: "automod-logs" },
};

/** Eski LogConfig.channels alanları için geriye dönük eşleme. */
export const LEGACY_CHANNEL_KEYS: Record<LogCategory, string[]> = {
  member: ["memberLogs"],
  message: ["messageLogs"],
  moderation: ["moderationLogs", "modLogs"],
  voice: ["voiceLogs"],
  role: ["roleLogs"],
  channel: ["channelLogs"],
  server: ["serverLogs"],
  invite: ["inviteLogs"],
  emojiSticker: ["emojiStickerLogs", "emojiLogs"],
  thread: [],
  webhook: [],
  integration: [],
  automod: [],
};

export const LOG_CATEGORY_NAME = "Logs";

export type AuditConfidence = "HIGH" | "LOW" | "NONE";

export type LogAction = "CREATE" | "UPDATE" | "DELETE" | "INFO" | "MODERATION";

export type LogDispatchPayload = {
  guildId: string;
  guildName?: string;
  eventType: string;
  action: LogAction;
  category: LogCategory;
  title: string;
  description?: string;
  color?: number;
  channelId?: string | null;
  actor?: {
    id: string;
    tag?: string;
    mention?: string;
    avatarUrl?: string;
    isBot?: boolean;
  } | null;
  target?: {
    id?: string | null;
    label?: string;
    mention?: string;
  } | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  beforeAfter?: Array<{ label: string; before: string; after: string }>;
  links?: string[];
  audit?: {
    executorId?: string | null;
    executorTag?: string | null;
    reason?: string | null;
    createdTimestamp?: number | null;
    confidence: AuditConfidence;
  };
};
