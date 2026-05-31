import { Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";

const joinedAtMap = new Map<string, number>();

export function registerVoiceLogs(client: Client): void {
  client.on(Events.VoiceStateUpdate, async (before, after) => {
    const user = after.member?.user ?? before.member?.user;
    const guild = after.guild ?? before.guild;
    if (!guild || !user) return;

    const embed = LogService.createBaseEmbed("🔊 Voice State Updated", 0x5865f2, user).addFields({
      name: "User",
      value: LogService.formatUser(user),
    });

    if (before.channelId !== after.channelId) {
      if (!before.channelId && after.channelId) {
        joinedAtMap.set(`${guild.id}:${user.id}`, Date.now());
        embed.setTitle("🔊 Voice Join").addFields({ name: "Channel", value: `<#${after.channelId}>` });
      } else if (before.channelId && !after.channelId) {
        const key = `${guild.id}:${user.id}`;
        const joinedAt = joinedAtMap.get(key);
        joinedAtMap.delete(key);
        if (joinedAt) {
          const durationSec = Math.floor((Date.now() - joinedAt) / 1000);
          embed.addFields({ name: "Time Spent", value: `${durationSec}s`, inline: true });
        }
        embed.setTitle("🔇 Voice Leave").addFields({ name: "Channel", value: `<#${before.channelId}>` });
      } else {
        embed
          .setTitle("🔁 Voice Move")
          .addFields(
            { name: "From", value: `<#${before.channelId}>`, inline: true },
            { name: "To", value: `<#${after.channelId}>`, inline: true },
          );
      }
    }

    if (before.serverMute !== after.serverMute || before.serverDeaf !== after.serverDeaf) {
      embed.addFields({
        name: "Server Mute/Deaf",
        value: `Mute: \`${before.serverMute}\` -> \`${after.serverMute}\`\nDeaf: \`${before.serverDeaf}\` -> \`${after.serverDeaf}\``,
      });
    }

    if (before.selfMute !== after.selfMute || before.selfDeaf !== after.selfDeaf) {
      embed.addFields({
        name: "Self Mute/Deaf",
        value: `Mute: \`${before.selfMute}\` -> \`${after.selfMute}\`\nDeaf: \`${before.selfDeaf}\` -> \`${after.selfDeaf}\``,
      });
    }

    if (before.streaming !== after.streaming || before.selfVideo !== after.selfVideo) {
      embed.addFields({
        name: "Streaming/Video",
        value: `Streaming: \`${before.streaming}\` -> \`${after.streaming}\`\nVideo: \`${before.selfVideo}\` -> \`${after.selfVideo}\``,
      });
    }

    if (embed.data.fields?.length === 1) return;
    const member = after.member ?? before.member;
    await LogService.sendLog(guild, "voiceLogs", embed, {
      eventType: "voice_update",
      user,
      memberRoleIds: member ? [...member.roles.cache.keys()] : undefined,
    });
  });
}
