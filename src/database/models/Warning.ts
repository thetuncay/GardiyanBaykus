import { Schema, model, type InferSchemaType } from "mongoose";

const WarningSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: "No reason" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

WarningSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

export type WarningDoc = InferSchemaType<typeof WarningSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const WarningModel = model("Warning", WarningSchema);
