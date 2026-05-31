import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { requireAdmin } from "../../utils/permissions.js";
import { GuildConfigModel } from "../../database/models/GuildConfig.js";
import { invalidateGuildConfig } from "../../services/guildSettingsCache.js";
import { successEmbed } from "../../utils/embeds.js";

export const tempVoiceCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("gecici-ses")
      .setDescription("Geçici ses yuvaları (hub kanalı)")
      .addSubcommand((sc) =>
        sc
          .setName("kur")
          .setDescription("Hub ses kanalını ve isteğe bağlı kategoriyi ayarla")
          .addChannelOption((o) =>
            o
              .setName("hub")
              .setDescription("Girildiğinde yuva açılacak ses kanalı")
              .addChannelTypes(ChannelType.GuildVoice)
              .setRequired(true),
          )
          .addChannelOption((o) =>
            o
              .setName("kategori")
              .setDescription("Yeni kanalların oluşacağı kategori")
              .addChannelTypes(ChannelType.GuildCategory),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("sablon")
          .setDescription("Yeni kanal adı şablonu")
          .addStringOption((o) =>
            o
              .setName("metin")
              .setDescription("Örn: 🦉 {displayName} Yuvası")
              .setRequired(true),
          ),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const admin = await requireAdmin(interaction);
      if (!admin || !interaction.guild) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "kur") {
        const hub = interaction.options.getChannel("hub", true);
        const cat = interaction.options.getChannel("kategori");
        await GuildConfigModel.updateOne(
          { guildId: interaction.guild.id },
          {
            $set: {
              "tempVoice.hubChannelId": hub.id,
              "tempVoice.categoryId": cat?.id ?? null,
            },
          },
          { upsert: true },
        );
        await invalidateGuildConfig(interaction.guild.id);
        await interaction.reply({
          embeds: [
            successEmbed({
              subsystem: "ses",
              title: "✅ Ses Yuvası Ayarlandı",
              description: `Hub: ${hub}${cat ? ` · Kategori: ${cat}` : ""}. Üyeler girdiğinde yuva açılır.`,
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      const metin = interaction.options.getString("metin", true);
      await GuildConfigModel.updateOne(
        { guildId: interaction.guild.id },
        { $set: { "tempVoice.nameTemplate": metin } },
        { upsert: true },
      );
      await invalidateGuildConfig(interaction.guild.id);
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "ses",
            title: "✅ Şablon Güncellendi",
            description: "Yuva adı şablonu güncellendi.",
          }),
        ],
        ephemeral: true,
      });
    },
  },
];
