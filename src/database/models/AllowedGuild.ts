import { Schema, model, type InferSchemaType } from "mongoose";

const AllowedGuildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    /** İzni veren kişinin Discord ID'si */
    addedBy: { type: String, required: true },
    /** Opsiyonel not (sunucu adı vb.) */
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

export type AllowedGuildDoc = InferSchemaType<typeof AllowedGuildSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const AllowedGuildModel = model("AllowedGuild", AllowedGuildSchema);
