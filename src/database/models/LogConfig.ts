import { Schema, model, type InferSchemaType } from "mongoose";

const CategoryConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: null },
  },
  { _id: false },
);

const LogConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    // Python: disabled_events, ignored_channels, ignored_roles, ignore_bots
    disabledEvents: { type: [String], default: [] },
    ignoredChannels: { type: [String], default: [] },
    ignoredRoles: { type: [String], default: [] },
    ignoreBots: { type: Boolean, default: true },

    disabledCategories: { type: [String], default: [] },
    categoryId: { type: String, default: null },

    categories: {
      member: { type: CategoryConfigSchema, default: () => ({}) },
      message: { type: CategoryConfigSchema, default: () => ({}) },
      moderation: { type: CategoryConfigSchema, default: () => ({}) },
      voice: { type: CategoryConfigSchema, default: () => ({}) },
      role: { type: CategoryConfigSchema, default: () => ({}) },
      channel: { type: CategoryConfigSchema, default: () => ({}) },
      server: { type: CategoryConfigSchema, default: () => ({}) },
      invite: { type: CategoryConfigSchema, default: () => ({}) },
      emojiSticker: { type: CategoryConfigSchema, default: () => ({}) },
      thread: { type: CategoryConfigSchema, default: () => ({}) },
      webhook: { type: CategoryConfigSchema, default: () => ({}) },
      integration: { type: CategoryConfigSchema, default: () => ({}) },
      automod: { type: CategoryConfigSchema, default: () => ({}) },
    },

    // Legacy alanlar (geriye dönük uyumluluk)
    channels: {
      messageLogs: { type: String, default: null },
      voiceLogs: { type: String, default: null },
      roleLogs: { type: String, default: null },
      channelLogs: { type: String, default: null },
      memberLogs: { type: String, default: null },
      serverLogs: { type: String, default: null },
      modLogs: { type: String, default: null },
      emojiLogs: { type: String, default: null },
      inviteLogs: { type: String, default: null },
      moderationLogs: { type: String, default: null },
      emojiStickerLogs: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export type LogConfigDoc = InferSchemaType<typeof LogConfigSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const LogConfigModel = model("LogConfig", LogConfigSchema);

