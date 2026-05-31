import { Schema, model, type InferSchemaType } from "mongoose";

const ModCaseSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    caseId: { type: Number, required: true },
    action: {
      type: String,
      required: true,
      enum: ["BAN", "KICK", "MUTE", "WARN", "UNMUTE", "PURGE"],
    },
    targetId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ModCaseSchema.index({ guildId: 1, caseId: -1 }, { unique: true });

export type ModCaseDoc = InferSchemaType<typeof ModCaseSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const ModCaseModel = model("ModCase", ModCaseSchema);
