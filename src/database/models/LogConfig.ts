import { Schema, model, type InferSchemaType } from "mongoose";

const LogConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    // Python: disabled_events, ignored_channels, ignored_roles, ignore_bots
    disabledEvents: { type: [String], default: [] },
    ignoredChannels: { type: [String], default: [] },
    ignoredRoles: { type: [String], default: [] },
    ignoreBots: { type: Boolean, default: true },

    // Python: LOG_CHANNELS runtime dict -> DB persisted channel IDs
    categoryId: { type: String, default: null },
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

