import { Schema, model, type InferSchemaType } from "mongoose";

const CustomCommandSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, lowercase: true, trim: true },
    response: { type: String, required: true },
    embedJson: { type: String, default: null },
    ephemeral: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CustomCommandSchema.index({ guildId: 1, name: 1 }, { unique: true });

export type CustomCommandDoc = InferSchemaType<typeof CustomCommandSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const CustomCommandModel = model("CustomCommand", CustomCommandSchema);
