import { Schema, model, type InferSchemaType } from "mongoose";

/** Uyarı sayacı ve (ileride) kayıt bilgisi — XP/level kaldırıldı. */
const UserStatsSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    warnCount: { type: Number, default: 0 },
    registeredAt: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female"], default: undefined },
  },
  { timestamps: true },
);

UserStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export type UserStatsDoc = InferSchemaType<typeof UserStatsSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const UserStatsModel = model("UserStats", UserStatsSchema);
