import { Schema, model, type InferSchemaType } from "mongoose";

const GiveawaySchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true, index: true },
    prize: { type: String, required: true },
    endsAt: { type: Date, required: true, index: true },
    winnerCount: { type: Number, default: 1 },
    requiredRoleIds: { type: [String], default: [] },
    ended: { type: Boolean, default: false, index: true },
    createdBy: { type: String, required: true },
    winnersUserIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

GiveawaySchema.index({ guildId: 1, endsAt: 1, ended: 1 });

export type GiveawayDoc = InferSchemaType<typeof GiveawaySchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const GiveawayModel = model("Giveaway", GiveawaySchema);
