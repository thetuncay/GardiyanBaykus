import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../../commands/types.js";
import { BOT_DISPLAY_NAME } from "../../../config/constants.js";
import { infoEmbed } from "../../../utils/embeds.js";

export const coreCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("yardim")
      .setDescription("BilgeBaykuş komutları ve rehber")
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const embed = infoEmbed({
        subsystem: "bilgelik",
        title: `📜 ${BOT_DISPLAY_NAME} Yardım`,
        description: "Wise Owl seni yönlendirir. İhtiyacın olan sistemi seç.",
      }).addFields(
        {
          name: "🛡️ Moderasyon",
          value: "`/yasakla`, `/at`, `/sustur`, `/uyar`, `/temizle`",
          inline: false,
        },
        { name: "🎁 Çekiliş", value: "`/cekilis`", inline: false },
        {
          name: "🎙️ Geçici Ses",
          value: "`/gecici-ses` (hub / şablon)",
          inline: false,
        },
        {
          name: "⚙️ Diğer",
          value: "`/kanal-ayar` (log kanalları), `/setup` (tam log kurulumu), `/ozel`, `/ping`",
          inline: false,
        },
        {
          name: "🌙 Özel Ses Odası",
          value: "_`owl` komutları ve panel butonlarıyla yönetim._",
          inline: false,
        },
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Gecikme kontrolü — baykuş ne kadar hızlı?")
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const sent = await interaction.reply({
        embeds: [
          infoEmbed({
            subsystem: "bilgelik",
            title: "🔍 Gecikme Ölçümü",
            description: "Wise Owl ölçümü başlattı...",
          }),
        ],
        fetchReply: true,
        ephemeral: true,
      });
      const ws = interaction.client.ws.ping;
      const rt = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply({
        embeds: [
          infoEmbed({
            subsystem: "bilgelik",
            title: "🏓 Gecikme Sonucu",
            description: `WebSocket: \`${ws}ms\`\nYanıt: \`${rt}ms\``,
          }),
        ],
      });
    },
  },
];
