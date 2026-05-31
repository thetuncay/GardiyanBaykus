/**
 * İzinli sunucu listesine guild ID ekler (MongoDB).
 * Kullanım: node scripts/add-allowed-guild.mjs [guildId] [not]
 * Örnek:   node scripts/add-allowed-guild.mjs 1369773505641713836 "Baykuş Locası"
 */
import "dotenv/config";
import mongoose from "mongoose";

const guildId = process.argv[2];
const note = process.argv[3] ?? "";
const addedBy = process.env.BOT_OWNER_ID;

if (!guildId) {
  console.error("Kullanım: node scripts/add-allowed-guild.mjs <guildId> [not]");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI .env içinde tanımlı değil");
  process.exit(1);
}

if (!addedBy) {
  console.error("BOT_OWNER_ID .env içinde tanımlı değil");
  process.exit(1);
}

const schema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    addedBy: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

const AllowedGuild =
  mongoose.models.AllowedGuild ?? mongoose.model("AllowedGuild", schema);

await mongoose.connect(process.env.MONGODB_URI);
await AllowedGuild.updateOne(
  { guildId },
  { $setOnInsert: { guildId, addedBy, note } },
  { upsert: true },
);
console.log(`OK: ${guildId} izin listesine eklendi${note ? ` (${note})` : ""}`);
await mongoose.disconnect();
