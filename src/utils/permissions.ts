import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { M } from "./messages.js";
import { warningEmbed } from "./embeds.js";

export function isModerator(member: GuildMember | null): boolean {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers)
  );
}

export async function requireModerator(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "moderasyon",
          title: "🌙 Sunucu Gerekli",
          description: `${M.onlyGuild}\n\nDM yerine bir sunucuda dene.`,
        }),
      ],
      ephemeral: true,
    });
    return null;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!isModerator(member)) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "moderasyon",
          title: "⚠️ Yetki Gerekli",
          description: `${M.noPermsMod}\n\nLütfen yetkili role sahip olduğunu doğrula.`,
        }),
      ],
      ephemeral: true,
    });
    return null;
  }
  return member;
}

export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "moderasyon",
          title: "🌙 Sunucu Gerekli",
          description: `${M.onlyGuild}\n\nDM yerine bir sunucuda dene.`,
        }),
      ],
      ephemeral: true,
    });
    return null;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "moderasyon",
          title: "⚙️ Yönetici Yetkisi Gerekli",
          description: `${M.noPermsAdmin}\n\nGerekli yetkilere sahip olduğundan emin ol.`,
        }),
      ],
      ephemeral: true,
    });
    return null;
  }
  return member;
}
