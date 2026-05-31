import { Schema, model, type InferSchemaType } from "mongoose";

/** Aktif geçici ses kanalı — kanal silinince kayıt kaldırılır. */
const VoiceRoomSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    openedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

VoiceRoomSchema.index({ guildId: 1, ownerId: 1 });

export type VoiceRoomDoc = InferSchemaType<typeof VoiceRoomSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const VoiceRoomModel = model("VoiceRoom", VoiceRoomSchema);
