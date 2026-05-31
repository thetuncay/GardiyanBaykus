import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { AllowedGuildModel } from "../../database/models/AllowedGuild.js";
import { invalidateAllowedGuildCache } from "../../services/allowedGuildCache.js";
import { loadEnv } from "../../config/env.js";
import { errorEmbed, infoEmbed, successEmbed, warningEmbed } from "../../utils/embeds.js";

function isOwner(userId: string): boolean {
  return userId === loadEnv().BOT_OWNER_ID;
}

export const ownerCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("sunucu")
      .setDescription("Bot sahibi: sunucu izin yönetimi")
      .addSubcommand((sc) =>
        sc
          .setName("izin-ver")
          .setDescription("Sunucuya bot kullanım izni ver")
          .addStringOption((o) =>
            o.setName("guild_id").setDescription("Sunucu ID").setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("not").setDescription("Opsiyonel not (sunucu adı vb.)"),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("izin-kaldir")
          .setDescription("Sunucunun bot kullanım iznini kaldır")
          .addStringOption((o) =>
            o.setName("guild_id").setDescription("Sunucu ID").setRequired(true),
          ),
      )
      .addSubcommand((sc) =>
        sc.setName("liste").setDescription("İzinli sunucuları listele"),
      )
      .setDMPermission(true),
    guildOnly: false,
    execute: async (interaction) => {
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "bilgelik",
              title: "🚫 Yetkisiz",
              description: "Bu komut yalnızca bot sahibi tarafından kullanılabilir.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "liste") {
        const docs = await AllowedGuildModel.find({}).lean();
        if (docs.length === 0) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "bilgelik",
                title: "📋 İzinli Sunucu Yok",
                description: "Henüz hiçbir sunucuya izin verilmemiş.",
              }),
            ],
            ephemeral: true,
          });
          return;
        }
        const lines = docs.map(
          (d, i) =>
            `**${i + 1}.** \`${d.guildId}\`${d.note ? ` — ${d.note}` : ""} _(ekleyen: <@${d.addedBy}>)_`,
        );
        await interaction.reply({
          embeds: [
            infoEmbed({
              subsystem: "bilgelik",
              title: `📋 İzinli Sunucular (${docs.length})`,
              description: lines.join("\n"),
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.options.getString("guild_id", true).trim();

      if (sub === "izin-ver") {
        const note = interaction.options.getString("not") ?? "";
        await AllowedGuildModel.updateOne(
          { guildId },
          { $set: { addedBy: interaction.user.id, note } },
          { upsert: true },
        );
        invalidateAllowedGuildCache();
        await interaction.reply({
          embeds: [
            successEmbed({
              subsystem: "bilgelik",
              title: "✅ İzin Verildi",
              description: `\`${guildId}\` artık botu kullanabilir.`,
            }),
          ],
          ephemeral: true,
        });
        return;
      }

      if (sub === "izin-kaldir") {
        const res = await AllowedGuildModel.deleteOne({ guildId });
        invalidateAllowedGuildCache();
        await interaction.reply({
          embeds: [
            res.deletedCount > 0
              ? successEmbed({
                  subsystem: "bilgelik",
                  title: "✅ İzin Kaldırıldı",
                  description: `\`${guildId}\` artık botu kullanamaz.`,
                })
              : warningEmbed({
                  subsystem: "bilgelik",
                  title: "⚠️ Bulunamadı",
                  description: `\`${guildId}\` zaten izinli listesinde değil.`,
                }),
          ],
          ephemeral: true,
        });
      }
    },
  },
];
