import { Schema, model, type InferSchemaType } from "mongoose";

const GuildConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    modules: {
      moderation: { type: Boolean, default: true },
      logging: { type: Boolean, default: true },
      giveaways: { type: Boolean, default: true },
      tempVoice: { type: Boolean, default: true },
      customCommands: { type: Boolean, default: true },
    },

    roles: {
      muted: { type: String, default: null },
      registered: { type: String, default: null },
      male: { type: String, default: null },
      female: { type: String, default: null },
      giveawayRequired: { type: String, default: null },
    },

    moderation: {
      antiSpam: { type: Boolean, default: true },
      spamThreshold: { type: Number, default: 6 },
      spamWindowSec: { type: Number, default: 8 },
      antiLink: { type: Boolean, default: false },
      linkAllowlist: { type: [String], default: [] },
      antiRaid: { type: Boolean, default: true },
      raidJoinsPerSec: { type: Number, default: 8 },
      raidWindowSec: { type: Number, default: 10 },
      progressiveWarnsToTimeout: { type: Number, default: 3 },
      progressiveTimeoutMinutes: { type: Number, default: 10 },
    },

    tempVoice: {
      hubChannelId: { type: String, default: null },
      categoryId: { type: String, default: null },
      nameTemplate: { type: String, default: "🦉 {displayName} Yuvası" },
    },

    automodIgnoredChannels: { type: [String], default: [] },
    automodIgnoredRoles: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type GuildConfigDoc = InferSchemaType<typeof GuildConfigSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const GuildConfigModel = model("GuildConfig", GuildConfigSchema);
