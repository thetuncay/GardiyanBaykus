import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../../commands/types.js";
import { LogService } from "../services/logService.js";
import { LOG_CHANNEL_DEFINITIONS } from "../types.js";

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
    const channels = await LogService.ensureSetup(interaction.guild);

    const lines = LOG_CHANNEL_DEFINITIONS.map((def) => {
      const id = channels[def.key];
      return `- \`${def.name}\`: ${id ? `<#${id}>` : "not available"}`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Logging setup complete")
      .setDescription("The logging system is now active with automatic channel routing.")
      .addFields({ name: "Configured channels", value: lines })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
