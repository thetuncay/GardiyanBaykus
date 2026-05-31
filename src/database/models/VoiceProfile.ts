import { Schema, model, type InferSchemaType } from "mongoose";

/** Kalıcı kullanıcı ses yuvası tercihleri — oda silinse bile korunur. */
const VoiceProfileSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    channelName: { type: String, default: null },
    userLimit: { type: Number, default: null },
    bitrate: { type: Number, default: null },
    /** true = @everyone Connect açık (herkese açık mod) */
    everyonePublic: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    allowedUserIds: { type: [String], default: [] },
    bannedUserIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

VoiceProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export type VoiceProfileDoc = InferSchemaType<typeof VoiceProfileSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const VoiceProfileModel = model("VoiceProfile", VoiceProfileSchema);
