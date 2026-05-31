import { ActivityType, Events, type Client } from "discord.js";
import { sweepDueGiveaways } from "../modules/giveaways/service.js";
import { BOT_DISPLAY_NAME } from "../config/constants.js";
import { createLogger } from "../services/logger.js";
import { getAllowedGuildIds, isGuildAllowed, invalidateAllowedGuildCache } from "../services/allowedGuildCache.js";
import { AllowedGuildModel } from "../database/models/AllowedGuild.js";
import { loadEnv } from "../config/env.js";
import {
  recoverTempVoiceRooms,
  reconcileOrphanTempChannels,
} from "../modules/temp_voice/roomService.js";

const log = createLogger("ready");

export function registerReady(client: Client): void {
  client.once(Events.ClientReady, async (c) => {
    log.info(`${BOT_DISPLAY_NAME} uçuşa geçti`, { user: c.user.tag, guilds: c.guilds.cache.size });
    c.user.setActivity({ name: "/yardım · BilgeBaykuş", type: ActivityType.Listening });

    // .env'deki SEED_GUILD_IDS varsa otomatik izin ver (ilk kurulum kolaylığı)
    await seedAllowedGuilds();

    // İzinsiz sunuculardan çık
    await sweepUnauthorizedGuilds(c);

    // Geçici ses: restart sonrası aktif oda kayıtlarını doğrula
    await recoverTempVoiceRooms(c).catch((e) =>
      log.error("Temp voice recovery hatası", { err: String(e) }),
    );
    await reconcileOrphanTempChannels(c).catch((e) =>
      log.error("Temp voice reconcile hatası", { err: String(e) }),
    );

    setInterval(() => {
      void sweepDueGiveaways(c);
    }, 30_000);
    void sweepDueGiveaways(c);
  });

  // Bot yeni bir sunucuya eklendiğinde izin kontrolü yap
  client.on(Events.GuildCreate, async (guild) => {
    const allowed = await isGuildAllowed(guild.id);
    if (!allowed) {
      log.warn(`İzinsiz sunucuya eklendi, ayrılıyor`, { guildId: guild.id, name: guild.name });
      await guild.leave().catch((e) =>
        log.error("Sunucudan ayrılırken hata", { guildId: guild.id, err: String(e) }),
      );
    } else {
      log.info(`Yeni izinli sunucuya katıldı`, { guildId: guild.id, name: guild.name });
    }
  });
}

/** .env SEED_GUILD_IDS="id1,id2" ile tanımlanan sunucuları izinliler listesine ekler. */
async function seedAllowedGuilds(): Promise<void> {
  const env = loadEnv();
  if (!env.SEED_GUILD_IDS) return;
  const ids = env.SEED_GUILD_IDS.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;
  for (const guildId of ids) {
    await AllowedGuildModel.updateOne(
      { guildId },
      { $setOnInsert: { guildId, addedBy: env.BOT_OWNER_ID, note: "seed (env)" } },
      { upsert: true },
    );
    log.info(`Seed: izin verildi`, { guildId });
  }
  invalidateAllowedGuildCache();
}

async function sweepUnauthorizedGuilds(client: Client): Promise<void> {
  const allowed = await getAllowedGuildIds();
  const toLeave = client.guilds.cache.filter((g) => !allowed.has(g.id));
  if (toLeave.size === 0) {
    log.info("Tüm sunucular izinli, temizleme gerekmedi");
    return;
  }
  log.warn(`${toLeave.size} izinsiz sunucu bulundu, ayrılıyor...`);
  for (const [, guild] of toLeave) {
    log.warn(`Ayrılıyor`, { guildId: guild.id, name: guild.name });
    await guild.leave().catch((e) =>
      log.error("Sunucudan ayrılırken hata", { guildId: guild.id, err: String(e) }),
    );
  }
}
