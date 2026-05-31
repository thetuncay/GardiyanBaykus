import { Events, type Client, type Interaction } from "discord.js";
import { addGiveawayEntrant, memberMeetsGiveawayRoles } from "../modules/giveaways/service.js";
import { GiveawayModel } from "../database/models/Giveaway.js";
import {
  handleTempVoiceButton,
  handleTempVoiceModal,
} from "../modules/temp_voice/panel.js";
import { M } from "../utils/messages.js";
import { errorEmbed, infoEmbed, warningEmbed } from "../utils/embeds.js";
import { createLogger } from "../services/logger.js";
import { tryConsumeCooldown } from "../services/cooldownService.js";
import {
  COOLDOWN_GIVEAWAY_BUTTON_SEC,
  COOLDOWN_SLASH_SEC,
} from "../config/constants.js";
import { checkGuildAllowed } from "../utils/guildGuard.js";

const log = createLogger("interaction");

export function registerInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // /sunucu komutu DM'den de çalışabilir, guild guard'ı atla
      const isOwnerCmd =
        interaction.isChatInputCommand() && interaction.commandName === "sunucu";
      if (!isOwnerCmd && !(await checkGuildAllowed(interaction))) return;

      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        if (cmd.guildOnly && !interaction.guild) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "bilgelik",
                title: "🌙 Sunucu Gerekli",
                description: `${M.onlyGuild}\n\nDM yerine bir sunucuda dene.`,
              }),
            ],
            ephemeral: true,
          });
          return;
        }
        const cdKey = `${interaction.user.id}:${interaction.commandName}`;
        const cdOk = await tryConsumeCooldown("slash", cdKey, COOLDOWN_SLASH_SEC);
        if (!cdOk) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "bilgelik",
                title: "⏳ Bekle",
                description: "Komutları çok hızlı kullanıyorsun. Birkaç saniye sonra tekrar dene.",
              }),
            ],
            ephemeral: true,
          });
          return;
        }
        await cmd.execute(interaction);
        return;
      }
      if (interaction.isAutocomplete()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction);
        return;
      }
      if (interaction.isModalSubmit()) {
        if (await handleTempVoiceModal(interaction)) return;
      }
      if (interaction.isButton()) {
        if (await handleTempVoiceButton(interaction)) return;
        if (interaction.customId.startsWith("gw:enter:")) {
          const mid = interaction.customId.slice("gw:enter:".length);
          const gwCd = await tryConsumeCooldown(
            "gw",
            `${interaction.user.id}:${mid}`,
            COOLDOWN_GIVEAWAY_BUTTON_SEC,
          );
          if (!gwCd) {
            await interaction.reply({
              embeds: [
                warningEmbed({
                  subsystem: "bilgelik",
                  title: "⏳ Bekle",
                  description: "Katıl butonuna çok hızlı bastın. Kısa süre sonra tekrar dene.",
                }),
              ],
              ephemeral: true,
            });
            return;
          }
          const doc = await GiveawayModel.findOne({ messageId: mid, ended: false }).lean();
          if (!doc || interaction.guildId !== doc.guildId) {
            await interaction.reply({
              embeds: [
                warningEmbed({
                  subsystem: "bilgelik",
                  title: "📜 Çekiliş Geçersiz",
                  description: "Bu çekiliş artık aktif değil. Lütfen güncel çekiliş mesajını kullan.",
                }),
              ],
              ephemeral: true,
            });
            return;
          }
          if (!interaction.member || !("roles" in interaction.member)) {
            await interaction.reply({
              embeds: [
                warningEmbed({
                  subsystem: "bilgelik",
                  title: "🌙 Sunucu Gerekli",
                  description: `${M.onlyGuild}\n\nDM yerine bir sunucuda dene.`,
                }),
              ],
              ephemeral: true,
            });
            return;
          }
          const member = await interaction.guild!.members.fetch(interaction.user.id);
          if (!memberMeetsGiveawayRoles(member, doc.requiredRoleIds ?? [])) {
            await interaction.reply({
              embeds: [
                warningEmbed({
                  subsystem: "bilgelik",
                  title: "🔍 Rol Gerekli",
                  description:
                    "Bu çekilişe katılabilmek için gerekli role sahip olmalısın. Rolünü kontrol et, sonra tekrar dene.",
                }),
              ],
              ephemeral: true,
            });
            return;
          }
          const ok = await addGiveawayEntrant(mid, interaction.user.id);
          await interaction.reply({
            embeds: [
              ok
                ? infoEmbed({
                    subsystem: "bilgelik",
                    title: "✅ Katılım Kaydedildi",
                    description: "Katıldın. Baykuş şansını diliyor!",
                  })
                : errorEmbed({
                    subsystem: "bilgelik",
                    title: "❌ Katılım Kaydedilemedi",
                    description: "Katılım kaydı başarısız oldu. Bir daha denemeyi veya çekilişi yenilemeyi dene.",
                  }),
            ],
            ephemeral: true,
          });
        }
      }
    } catch (err) {
      log.error("InteractionCreate hata", { err: String(err) });
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            embeds: [
              errorEmbed({
                subsystem: "bilgelik",
                title: "❌ Bilinmeyen Sorun",
                description:
                  "Bir terslik oldu. Komutu tekrar dene. Devam ederse `/yardim` ile destek almayı dene.",
              }),
            ],
            ephemeral: true,
          })
          .catch(() => null);
      } else if (interaction.isRepliable()) {
        await interaction
          .followUp({
            embeds: [
              errorEmbed({
                subsystem: "bilgelik",
                title: "❌ Bilinmeyen Sorun",
                description:
                  "Bir terslik oldu. Komutu tekrar dene. Devam ederse `/yardim` ile destek almayı dene.",
              }),
            ],
            ephemeral: true,
          })
          .catch(() => null);
      }
    }
  });
}
