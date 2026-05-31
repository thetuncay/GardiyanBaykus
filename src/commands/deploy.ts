import { REST, Routes } from "discord.js";
import { loadEnv } from "../config/env.js";
import { allCommands } from "./registry.js";
import { configureLoggerFromEnv, createLogger } from "../services/logger.js";
import { connectMongo, disconnectMongo } from "../database/connection.js";
import { AllowedGuildModel } from "../database/models/AllowedGuild.js";

const env = loadEnv();
configureLoggerFromEnv(env);
const log = createLogger("deploy");
const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
const body = allCommands.map((c) => c.data.toJSON());

async function main() {
  // --- Mod 1: Sadece dev sunucusuna (hızlı test) ---
  if (env.COMMAND_REGISTER_GUILD_ONLY && env.DISCORD_DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID),
      { body },
    );
    log.info(`${body.length} komut dev sunucusuna yüklendi`, { guildId: env.DISCORD_DEV_GUILD_ID });
    return;
  }

  // --- Mod 2: İzinli tüm sunuculara guild-level deploy (anında görünür) ---
  await connectMongo(env.MONGODB_URI);
  const allowedDocs = await AllowedGuildModel.find({}).select("guildId").lean();
  await disconnectMongo();

  if (allowedDocs.length === 0) {
    log.warn("İzinli sunucu bulunamadı — global deploy yapılıyor (1 saate kadar yayılır)");
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    log.info(`${body.length} global slash komut kaydedildi`);
    return;
  }

  log.info(`${allowedDocs.length} izinli sunucuya guild-level deploy başlıyor...`);
  let ok = 0;
  let fail = 0;
  for (const doc of allowedDocs) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, doc.guildId),
        { body },
      );
      log.info(`✓ ${body.length} komut yüklendi`, { guildId: doc.guildId });
      ok++;
    } catch (e) {
      log.error(`✗ Yüklenemedi`, { guildId: doc.guildId, err: String(e) });
      fail++;
    }
  }
  log.info(`Deploy tamamlandı`, { ok, fail, total: allowedDocs.length });
}

main().catch((e) => {
  log.error("Deploy başarısız", { err: String(e) });
  process.exit(1);
});
