import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type TextChannel,
} from "discord.js";
import type { SlashCommand } from "../../commands/types.js";
import { requireModerator } from "../../utils/permissions.js";
import { M } from "../../utils/messages.js";
import { parseDurationToMs } from "../../utils/time.js";
import { createModCase, sendModLog, addWarn, applyProgressiveTimeoutIfNeeded } from "./service.js";
import { fetchModerationLogChannel } from "../logging/services/modLogChannel.js";
import { errorEmbed, successEmbed, warningEmbed } from "../../utils/embeds.js";

export const moderationCommands: SlashCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName("yasakla")
      .setDescription("Üyeyi sunucudan yasakla")
      .addUserOption((o) => o.setName("uye").setDescription("Hedef üye").setRequired(true))
      .addStringOption((o) => o.setName("sebep").setDescription("Sebep"))
      .addIntegerOption((o) =>
        o
          .setName("mesaj_gun")
          .setDescription("Son kaç günün mesajlarını sil (0-7)")
          .setMinValue(0)
          .setMaxValue(7),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      if (!mod || !interaction.guild) return;
      const target = interaction.options.getUser("uye", true);
      const reason = interaction.options.getString("sebep") ?? "Sebep belirtilmedi";
      const days = interaction.options.getInteger("mesaj_gun") ?? 0;
      const deleteMessageSeconds = Math.min(604_800, Math.max(0, days) * 86_400);
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member && !member.bannable) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "moderasyon",
              title: "⚠️ Bot Yetkileri Yetersiz",
              description: `${M.botNoPerms}\n\nRol hiyerarşisini ve yetkileri kontrol et.`,
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      await interaction.guild.members.ban(target, {
        deleteMessageSeconds,
        reason: `${mod.user.tag}: ${reason}`,
      });
      const { caseId } = await createModCase({
        guildId: interaction.guild.id,
        action: "BAN",
        targetId: target.id,
        moderatorId: mod.id,
        reason,
        metadata: { days },
      });
      const logCh = await fetchModerationLogChannel(interaction.guild);
      if (logCh)
        await sendModLog(logCh, {
          caseId,
          action: "BAN",
          targetTag: target.tag,
          targetId: target.id,
          moderatorTag: mod.user.tag,
          reason,
        });
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Yasaklama Tamamlandı",
            description: `**${target.tag}** sunucudan yasaklandı.\nVaka: \`#${caseId}\``,
          }),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("at")
      .setDescription("Üyeyi sunucudan at")
      .addUserOption((o) => o.setName("uye").setDescription("Hedef üye").setRequired(true))
      .addStringOption((o) => o.setName("sebep").setDescription("Sebep"))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      if (!mod || !interaction.guild) return;
      const target = interaction.options.getUser("uye", true);
      const reason = interaction.options.getString("sebep") ?? "Sebep belirtilmedi";
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "moderasyon",
              title: "❌ Üye Bulunamadı",
              description:
                "Belirttiğin kullanıcı bu sunucuda bulunamadı. Etiketi/ID’yi kontrol edip tekrar dene.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      if (!member.kickable) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "moderasyon",
              title: "⚠️ Bot Yetkileri Yetersiz",
              description: `${M.botNoPerms}\n\nKick işlemi için gerekli yetkileri doğrula.`,
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      await member.kick(`${mod.user.tag}: ${reason}`);
      const { caseId } = await createModCase({
        guildId: interaction.guild.id,
        action: "KICK",
        targetId: target.id,
        moderatorId: mod.id,
        reason,
      });
      const logCh = await fetchModerationLogChannel(interaction.guild);
      if (logCh)
        await sendModLog(logCh, {
          caseId,
          action: "KICK",
          targetTag: target.tag,
          targetId: target.id,
          moderatorTag: mod.user.tag,
          reason,
        });
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Atma Tamamlandı",
            description: `**${target.tag}** sunucudan atıldı.\nVaka: \`#${caseId}\``,
          }),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("sustur")
      .setDescription("Üyeyi zaman aşımı ile sustur (Discord timeout)")
      .addUserOption((o) => o.setName("uye").setDescription("Hedef üye").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("sure")
          .setDescription("Süre: 10m, 1h, 1d")
          .setRequired(true),
      )
      .addStringOption((o) => o.setName("sebep").setDescription("Sebep"))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      if (!mod || !interaction.guild) return;
      const target = interaction.options.getUser("uye", true);
      const dur = interaction.options.getString("sure", true);
      const reason = interaction.options.getString("sebep") ?? "Sebep belirtilmedi";
      const ms = parseDurationToMs(dur);
      if (!ms || ms > 28 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
          embeds: [
            warningEmbed({
              subsystem: "moderasyon",
              title: "⚠️ Geçersiz Süre",
              description: "Örnek: `10m`, `2h`, `1d` (en fazla 28 gün).",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member?.moderatable) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "moderasyon",
              title: "⚠️ Bot Yetkileri Yetersiz",
              description: `${M.botNoPerms}\n\nTimeout işlemi için gerekli yetkileri doğrula.`,
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      await member.timeout(ms, `${mod.user.tag}: ${reason}`);
      const { caseId } = await createModCase({
        guildId: interaction.guild.id,
        action: "MUTE",
        targetId: target.id,
        moderatorId: mod.id,
        reason,
        metadata: { ms },
      });
      const logCh = await fetchModerationLogChannel(interaction.guild);
      if (logCh)
        await sendModLog(logCh, {
          caseId,
          action: "MUTE",
          targetTag: target.tag,
          targetId: target.id,
          moderatorTag: mod.user.tag,
          reason,
        });
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Susturma Tamamlandı",
            description: `**${target.tag}** timeout aldı.\nVaka: \`#${caseId}\``,
          }),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("uyar")
      .setDescription("Üyeyi uyar (kademeli ceza sayacı)")
      .addUserOption((o) => o.setName("uye").setDescription("Hedef üye").setRequired(true))
      .addStringOption((o) => o.setName("sebep").setDescription("Sebep"))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      if (!mod || !interaction.guild) return;
      const target = interaction.options.getUser("uye", true);
      const reason = interaction.options.getString("sebep") ?? "Sebep belirtilmedi";
      const { warnCount } = await addWarn(interaction.guild.id, target.id, mod.id, reason);
      const { caseId } = await createModCase({
        guildId: interaction.guild.id,
        action: "WARN",
        targetId: target.id,
        moderatorId: mod.id,
        reason,
      });
      const progressive = await applyProgressiveTimeoutIfNeeded({
        guildId: interaction.guild.id,
        userId: target.id,
        guild: interaction.guild,
      });
      const logCh = await fetchModerationLogChannel(interaction.guild);
      if (logCh)
        await sendModLog(logCh, {
          caseId,
          action: "WARN",
          targetTag: target.tag,
          targetId: target.id,
          moderatorTag: mod.user.tag,
          reason,
        });
      let msg = `🦉 **${target.tag}** uyarıldı. Toplam uyarı: **${warnCount}**. Vaka \`#${caseId}\`.`;
      if (progressive) msg += `\n${progressive}`;
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Uyarı Verildi",
            description: msg.replace(/^🦉\s*/u, ""),
          }),
        ],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("temizle")
      .setDescription("Kanaldaki son mesajları toplu sil")
      .addIntegerOption((o) =>
        o
          .setName("adet")
          .setDescription("1–100 arası")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addChannelOption((o) =>
        o
          .setName("kanal")
          .setDescription("Hedef metin kanalı")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .setDMPermission(false),
    guildOnly: true,
    execute: async (interaction) => {
      const mod = await requireModerator(interaction);
      if (!mod || !interaction.guild) return;
      const amount = interaction.options.getInteger("adet", true);
      const ch =
        (interaction.options.getChannel("kanal") as TextChannel | null) ??
        (interaction.channel as TextChannel);
      if (!ch?.isTextBased()) {
        await interaction.reply({
          embeds: [
            errorEmbed({
              subsystem: "moderasyon",
              title: "❌ Geçerli Kanal Seç",
              description: "Lütfen geçerli bir metin kanalı seç.",
            }),
          ],
          ephemeral: true,
        });
        return;
      }
      const deleted = await ch.bulkDelete(amount, true).catch(() => null);
      const n = deleted?.size ?? 0;
      const { caseId } = await createModCase({
        guildId: interaction.guild.id,
        action: "PURGE",
        targetId: interaction.guild.id,
        moderatorId: mod.id,
        reason: `${ch.id}: ${n} mesaj`,
        metadata: { channelId: ch.id, n },
      });
      const logCh = await fetchModerationLogChannel(interaction.guild);
      if (logCh)
        await sendModLog(logCh, {
          caseId,
          action: "PURGE",
          targetTag: ch.name,
          targetId: ch.id,
          moderatorTag: mod.user.tag,
          reason: `${n} mesaj silindi`,
        });
      await interaction.reply({
        embeds: [
          successEmbed({
            subsystem: "moderasyon",
            title: "✅ Temizleme Tamamlandı",
            description: `**${n}** mesaj temizlendi.\nVaka: \`#${caseId}\``,
          }),
        ],
        ephemeral: true,
      });
    },
  },
];
