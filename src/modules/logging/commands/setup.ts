import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../../commands/types.js";
import { ensureLoggingChannelsSetup } from "../core/logChannelManager.js";
import { LOG_CATEGORIES, LOG_CATEGORY_META } from "../core/logCategories.js";
import { successEmbed, errorEmbed } from "../../../utils/embeds.js";

export const setupLoggingCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Automatically set up the full logging system")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  guildOnly: true,
  execute: async (interaction) => {
    if (!interaction.guild) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const channels = await ensureLoggingChannelsSetup(interaction.guild);

      const lines = LOG_CATEGORIES.map((key) => {
        const id = channels[key];
        return `- \`${LOG_CATEGORY_META[key].defaultChannelName}\`: ${id ? `<#${id}>` : "atanamadı"}`;
      }).join("\n");

      await interaction.editReply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Logging Kurulumu Tamamlandı",
            description: `Tüm kategoriler otomatik kanal eşleştirmesiyle etkinleştirildi.\n\n${lines}`,
          }),
        ],
      });
    } catch (err) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            subsystem: "moderasyon",
            title: "❌ Logging Kurulumu Başarısız",
            description: `Kurulum sırasında hata oluştu: \`${String(err)}\``,
          }),
        ],
      });
    }
  },
};
