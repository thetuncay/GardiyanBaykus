import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type GuildTextBasedChannel,
} from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { requireModerator } from "../../utils/permissions.js";
import { parseDurationToMs } from "../../utils/time.js";
import { postGiveaway, endGiveawayMessage, rerollGiveaway } from "./service.js";
import { GiveawayModel } from "../../database/models/Giveaway.js";
import { errorEmbed, successEmbed, warningEmbed } from "../../utils/embeds.js";

export const giveawayCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("cekilis")
      .setDescription("Çekiliş yönetimi")
      .addSubcommand((sc) =>
        sc
          .setName("basla")
          .setDescription("Yeni çekiliş başlat")
          .addStringOption((o) => o.setName("odul").setDescription("Ödül metni").setRequired(true))
          .addStringOption((o) =>
            o.setName("sure").setDescription("Süre: 30m, 2h, 1d").setRequired(true),
          )
          .addIntegerOption((o) =>
            o
              .setName("kazanan")
              .setDescription("Kazanan sayısı")
              .setMinValue(1)
              .setMaxValue(20),
          )
          .addRoleOption((o) => o.setName("zorunlu_rol").setDescription("Katılım için gerekli rol")),
      )
      .addSubcommand((sc) =>
        sc
          .setName("bitir")
          .setDescription("Çekilişi hemen bitir")
          .addStringOption((o) =>
            o.setName("mesaj_id").setDescription("Çekiliş mesaj ID").setRequired(true),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("yenile")
          .setDescription("Bittiği çekilişte kazananları yeniden çek")
          .addStringOption((o) =>
            o.setName("mesaj_id").setDescription("Çekiliş mesaj ID").setRequired(true),
          )
          .addIntegerOption((o) =>
            o.setName("kazanan").setDescription("Kazanan sayısı").setMinValue(1).setMaxValue(20),
          ),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      const ich = interaction.channel;
      if (!mod || !interaction.guild || !ich?.isTextBased() || ich.isDMBased()) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "basla") {
        const prize = interaction.options.getString("odul", true);
        const dur = interaction.options.getString("sure", true);
        const ms = parseDurationToMs(dur);
        if (!ms || ms < 60_000) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "bilgelik",
                title: "⚠️ Geçersiz Süre",
                description: "Örnek: `30m`, `2h`, `1d` (min 1 dk).",
              }),
            ],
            ephemeral: true,
          });
          return;
        }
        const winnerCount = interaction.options.getInteger("kazanan") ?? 1;
        const role = interaction.options.getRole("zorunlu_rol");
        const required = role ? [role.id] : [];
        const endsAt = new Date(Date.now() + ms);
        await postGiveaway({
          channel: ich as GuildTextBasedChannel,
          prize,
          endsAt,
          winnerCount,
          requiredRoleIds: required,
          createdBy: interaction.user.id,
        });
        await interaction.reply({
          embeds: [
            successEmbed({
              subsystem: "bilgelik",
              title: "✅ Çekiliş Gönderildi",
              description: "Üyeler **Katıl** butonu ile çekilişe katılabilir.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      const mid = interaction.options.getString("mesaj_id", true);
      const msg = await ich.messages.fetch(mid).catch(() => null);
      if (!msg) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "bilgelik",
              title: "❌ Mesaj Bulunamadı",
              description: "Belirttiğin çekiliş mesaj ID’si bulunamadı. ID’yi kontrol edip tekrar dene.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      if (sub === "bitir") {
        await endGiveawayMessage(msg);
        await interaction.reply({
          embeds: [
            successEmbed({
              subsystem: "bilgelik",
              title: "✅ Çekiliş Sonlandırıldı",
              description: "Çekiliş kapatıldı ve kazananlar güncellendi.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      const doc = await GiveawayModel.findOne({ messageId: mid });
      const wc = interaction.options.getInteger("kazanan") ?? doc?.winnerCount ?? 1;
      const winners = await rerollGiveaway(msg, wc);
      await interaction.reply({
        embeds: [
          winners.length > 0
            ? successEmbed({
                subsystem: "bilgelik",
                title: "✅ Yeniden Çekim Tamamlandı",
                description: `Kazananlar: ${winners.map((id) => `<@${id}>`).join(", ")}`,
              })
            : warningEmbed({
                subsystem: "bilgelik",
                title: "⚠️ Katılımcı Bulunamadı",
                description: "Yeniden çekim yapılacak katılımcı yok. Gerekirse çekilişi tekrar başlat.",
              }),
        ],
        ephemeral: true,
      });
    },
  },
];
