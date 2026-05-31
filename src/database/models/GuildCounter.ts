import { Schema, model } from "mongoose";

const GuildCounterSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  modCase: { type: Number, default: 0 },
});

export const GuildCounterModel = model("GuildCounter", GuildCounterSchema);

export async function nextModCaseId(guildId: string): Promise<number> {
  const doc = await GuildCounterModel.findOneAndUpdate(
    { guildId },
    { $inc: { modCase: 1 } },
    { new: true, upsert: true },
  );
  return doc?.modCase ?? 1;
}
