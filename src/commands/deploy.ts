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

function collectGuildIds(mongoIds: string[]): Set<string> {
  const ids = new Set(mongoIds);
  if (env.DISCORD_DEV_GUILD_ID) ids.add(env.DISCORD_DEV_GUILD_ID);
  if (env.SEED_GUILD_IDS) {
    for (const id of env.SEED_GUILD_IDS.split(",").map((s) => s.trim()).filter(Boolean)) {
      ids.add(id);
    }
  }
  return ids;
}

async function deployToGuilds(guildIds: Set<string>): Promise<void> {
  log.info(`${guildIds.size} sunucuya guild-level deploy başlıyor...`);
  let ok = 0;
  let fail = 0;
  for (const guildId of guildIds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
        { body },
      );
      log.info(`✓ ${body.length} komut yüklendi`, { guildId });
      ok++;
    } catch (e) {
      log.error(`✗ Yüklenemedi`, { guildId, err: String(e) });
      fail++;
    }
  }
  log.info("Deploy tamamlandı", { ok, fail, total: guildIds.size });
}

async function main() {
  // Global deploy (~1 saat yayılır, tüm sunucularda görünür)
  if (!env.COMMAND_REGISTER_GUILD_ONLY) {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    log.info(`${body.length} global slash komut kaydedildi`);
    return;
  }

  // Guild-level deploy: izinli sunucular + SEED + DEV (anında görünür)
  await connectMongo(env.MONGODB_URI);
  const allowedDocs = await AllowedGuildModel.find({}).select("guildId").lean();
  await disconnectMongo();

  const guildIds = collectGuildIds(allowedDocs.map((d) => d.guildId));

  if (guildIds.size === 0) {
    log.warn("Hiç sunucu bulunamadı — global deploy yapılıyor (1 saate kadar yayılır)");
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
    log.info(`${body.length} global slash komut kaydedildi`);
    return;
  }

  await deployToGuilds(guildIds);
}

main().catch((e) => {
  log.error("Deploy başarısız", { err: String(e) });
  process.exit(1);
});
