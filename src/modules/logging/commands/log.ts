import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../../../commands/types.js";
import { LOG_CATEGORIES, LOG_CATEGORY_META, type LogCategory } from "../core/logCategories.js";
import {
  getCategoryStates,
  setCategoryChannel,
  setCategoryEnabled,
  validateLogChannelPermissions,
} from "../core/logChannelManager.js";
import { infoEmbed, successEmbed, warningEmbed } from "../../../utils/embeds.js";

function toCategoryChoices() {
  return LOG_CATEGORIES.map((key) => ({
    name: `${LOG_CATEGORY_META[key].emoji} ${LOG_CATEGORY_META[key].title}`,
    value: key,
  }));
}

export const logCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("Gelişmiş log yönetimi")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sc) =>
      sc
        .setName("kanal")
        .setDescription("Kategori log kanalını ayarla")
        .addStringOption((o) =>
          o
            .setName("kategori")
            .setDescription("Log kategorisi")
            .setRequired(true)
            .addChoices(...toCategoryChoices()),
        )
        .addChannelOption((o) =>
          o
            .setName("kanal")
            .setDescription("Hedef kanal (boş bırakılırsa kaldırılır)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("ac")
        .setDescription("Kategori loglarını aç")
        .addStringOption((o) =>
          o
            .setName("kategori")
            .setDescription("Log kategorisi")
            .setRequired(true)
            .addChoices(...toCategoryChoices()),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("kapat")
        .setDescription("Kategori loglarını kapat")
        .addStringOption((o) =>
          o
            .setName("kategori")
            .setDescription("Log kategorisi")
            .setRequired(true)
            .addChoices(...toCategoryChoices()),
        ),
    )
    .addSubcommand((sc) => sc.setName("durum").setDescription("Tüm log kategorilerinin durumunu göster")),
  guildOnly: true,
  execute: async (interaction) => {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "durum") {
      const states = await getCategoryStates(interaction.guild.id);
      const rows = LOG_CATEGORIES.map((key) => {
        const state = states[key];
        const enabled = state.enabled ? "Açık" : "Kapalı";
        const channel = state.channelId ? `<#${state.channelId}>` : "Ayarlanmamış";
        return `- **${LOG_CATEGORY_META[key].title}**: ${enabled} • ${channel}`;
      });
      await interaction.reply({
        embeds: [
          infoEmbed({
            subsystem: "moderasyon",
            title: "🧾 Log Durumu",
            description: rows.join("\n"),
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = interaction.options.getString("kategori", true) as LogCategory;
    if (sub === "kanal") {
      const channel = interaction.options.getChannel("kanal");
      if (channel) {
        const ok = await validateLogChannelPermissions(interaction.guild, channel.id);
        if (!ok) {
          await interaction.reply({
            embeds: [
              warningEmbed({
                subsystem: "moderasyon",
                title: "⚠️ İzin Eksik",
                description:
                  "Bot bu kanala log yazamıyor. `Kanalları Gör`, `Mesaj Gönder`, `Bağlantı Ekle` izinlerini kontrol et.",
              }),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      await setCategoryChannel(interaction.guild.id, category, channel?.id ?? null);
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Log Kanalı Güncellendi",
            description: channel
              ? `${LOG_CATEGORY_META[category].title} -> <#${channel.id}>`
              : `${LOG_CATEGORY_META[category].title} kanal ataması kaldırıldı.`,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "ac" || sub === "kapat") {
      const enabled = sub === "ac";
      await setCategoryEnabled(interaction.guild.id, category, enabled);
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: enabled ? "✅ Log Kategorisi Açıldı" : "✅ Log Kategorisi Kapatıldı",
            description: `${LOG_CATEGORY_META[category].title}: **${enabled ? "Açık" : "Kapalı"}**`,
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
