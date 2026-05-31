import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { requireAdmin } from "../../utils/permissions.js";
import { CustomCommandModel } from "../../database/models/CustomCommand.js";
import { ensureEmbedStandard, infoEmbed, successEmbed, warningEmbed } from "../../utils/embeds.js";

export const customCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("ozel")
      .setDescription("Sunucuya özel basit komutlar")
      .addSubcommand((sc) =>
        sc
          .setName("ekle")
          .setDescription("Yeni özel komut")
          .addStringOption((o) =>
            o.setName("isim").setDescription("Komut adı (küçük harf)").setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("yanit").setDescription("Metin yanıtı").setRequired(true),
          )
          .addBooleanOption((o) =>
            o.setName("gizli").setDescription("Sadece komutu kullanan görsün"),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("sil")
          .setDescription("Özel komutu sil")
          .addStringOption((o) => o.setName("isim").setDescription("Komut adı").setRequired(true)),
      )
      .addSubcommand((sc) => sc.setName("liste").setDescription("Tüm özel komutları listele"))
      .addSubcommand((sc) =>
        sc
          .setName("calistir")
          .setDescription("Özel komutu çalıştır")
          .addStringOption((o) =>
            o.setName("isim").setDescription("Komut adı").setRequired(true).setAutocomplete(true),
          ),
      )
      .setDMPermission(false),
    guildOnly: true,
    autocomplete: async (interaction) => {
      if (!interaction.guild) {
        await interaction.respond([]);
        return;
      }
      if (interaction.options.getSubcommand() !== "calistir") {
        await interaction.respond([]);
        return;
      }
      const focused = interaction.options.getFocused();
      const list = await CustomCommandModel.find({
        guildId: interaction.guild.id,
        name: new RegExp(`^${escapeRe(focused)}`, "i"),
      })
        .limit(25)
        .lean();
      await interaction.respond(
        list.map((c) => ({ name: c.name, value: c.name })),
      );
    },
    execute: async (interaction) => {
      if (!interaction.guild) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "calistir") {
        const name = interaction.options.getString("isim", true).toLowerCase().trim();
        const doc = await CustomCommandModel.findOne({
          guildId: interaction.guild.id,
          name,
        }).lean();
        if (!doc) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "bilgelik",
                title: "📜 Komut Bulunamadı",
                description: "Bu isimle kayıtlı özel komut yok. Önce `/ozel liste` ile kontrol et.",
              }),
            ],
            ephemeral: true,
          });
          return;
        }
        if (doc.embedJson) {
          try {
            const data = JSON.parse(doc.embedJson) as Record<string, unknown>;
            const embed = new EmbedBuilder(data);
            ensureEmbedStandard({
              embed,
              subsystem: "bilgelik",
              fallbackTitle: "📜 Özel Komut",
              fallbackDescription: doc.response,
              fallbackKind: "neutral",
            });
            await interaction.reply({ embeds: [embed], ephemeral: doc.ephemeral });
            return;
          } catch {
            /* fall through */
          }
        }
        await interaction.reply({
          embeds: [
            infoEmbed({
              subsystem: "bilgelik",
              title: "📜 Özel Komut Sonucu",
              description: doc.response,
            }),
          ],
          ephemeral: doc.ephemeral,
        });
        return;
      }
      const admin = await requireAdmin(interaction);
      if (!admin) return;
      if (sub === "liste") {
        const all = await CustomCommandModel.find({ guildId: interaction.guild.id })
          .select("name")
          .lean();
        await interaction.reply({
          embeds: [
            all.length > 0
              ? infoEmbed({
                  subsystem: "bilgelik",
                  title: "📜 Özel Komutlar",
                  description: all.length
                    ? all.map((c) => `\`${c.name}\``).join(", ")
                    : "—",
                })
              : warningEmbed({
                  subsystem: "bilgelik",
                  title: "📜 Henüz Komut Yok",
                  description: "Henüz kayıtlı özel komut bulunmuyor.",
                }),
          ],
          ephemeral: true,
        });
        return;
      }
      if (sub === "sil") {
        const name = interaction.options.getString("isim", true).toLowerCase().trim();
        const res = await CustomCommandModel.deleteOne({
          guildId: interaction.guild.id,
          name,
        });
        await interaction.reply({
          embeds: [
            res.deletedCount > 0
              ? successEmbed({
                  subsystem: "bilgelik",
                  title: "✅ Silme Tamamlandı",
                  description: `\`/${name}\` komutu silindi.`,
                })
              : warningEmbed({
                  subsystem: "bilgelik",
                  title: "📜 Bulunamadı",
                  description: `\`/${name}\` komutu bulunamadı.`,
                }),
          ],
          ephemeral: true,
        });
        return;
      }
      const name = interaction.options.getString("isim", true).toLowerCase().trim();
      const yanit = interaction.options.getString("yanit", true);
      const gizli = interaction.options.getBoolean("gizli") ?? false;
      await CustomCommandModel.findOneAndUpdate(
        { guildId: interaction.guild.id, name },
        {
          $set: {
            response: yanit,
            ephemeral: gizli,
            embedJson: null,
          },
          $setOnInsert: { guildId: interaction.guild.id, name },
        },
        { upsert: true, new: true },
      );
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "bilgelik",
            title: "✅ Özel Komut Oluşturuldu",
            description: `\`/${name}\` komutu artık \`/ozel calistir\` ile kullanılabilir.`,
          }),
        ],
        ephemeral: true,
      });
    },
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
