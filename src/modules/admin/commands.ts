import { SlashCommandBuilder, ChannelType } from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { requireAdmin } from "../../utils/permissions.js";
import { LogConfigModel } from "../../database/models/LogConfig.js";
import { invalidateLogConfigCache } from "../../services/logConfigCache.js";
import { successEmbed } from "../../utils/embeds.js";

export const adminCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("kanal-ayar")
      .setDescription("Log kanallarını ayarla (LogConfig)")
      .addStringOption((o) =>
        o
          .setName("tur")
          .setDescription("Kanal türü")
          .setRequired(true)
          .addChoices(
            { name: "Sunucu / genel log", value: "serverLogs" },
            { name: "Mod / ceza logu", value: "moderationLogs" },
          ),
      )
      .addChannelOption((o) =>
        o
          .setName("kanal")
          .setDescription("Hedef kanal (boş = kaldır)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const admin = await requireAdmin(interaction);
      if (!admin || !interaction.guild) return;
      const tur = interaction.options.getString("tur", true) as "serverLogs" | "moderationLogs";
      const channel = interaction.options.getChannel("kanal");
      const id = channel?.id ?? null;

      const setPath =
        tur === "moderationLogs"
          ? ({
              "channels.moderationLogs": id,
              "channels.modLogs": id,
            } as const)
          : ({ "channels.serverLogs": id } as const);

      await LogConfigModel.updateOne(
        { guildId: interaction.guild.id },
        { $set: { guildId: interaction.guild.id, ...setPath } },
        { upsert: true },
      );
      invalidateLogConfigCache(interaction.guild.id);

      const label = tur === "moderationLogs" ? "Mod / ceza logu" : "Sunucu / genel log";
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "⚙️ Kanal Ayarı Güncellendi",
            description: channel
              ? `${label} <#${channel.id}> olarak ayarlandı.`
              : `${label} kaldırıldı.`,
          }),
        ],
        ephemeral: true,
      });
    },
  },
];
