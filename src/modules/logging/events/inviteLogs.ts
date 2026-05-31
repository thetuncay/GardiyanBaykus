import { Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";

export function registerInviteLogs(client: Client): void {
  client.on(Events.ClientReady, async (readyClient) => {
    for (const guild of readyClient.guilds.cache.values()) {
      await LogService.cacheGuildInvites(guild).catch(() => null);
    }
  });

  client.on(Events.InviteCreate, async (invite) => {
    const guildId = invite.guild?.id;
    if (!guildId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    await LogService.updateInviteSnapshotFromInvite(invite);
    const embed = LogService.createBaseEmbed("📨 Invite Created", 0x2ecc71).addFields(
      { name: "Code", value: `\`${invite.code}\``, inline: true },
      { name: "Channel", value: invite.channelId ? `<#${invite.channelId}>` : "Unknown", inline: true },
      { name: "Max Uses", value: `\`${invite.maxUses ?? 0}\``, inline: true },
      { name: "Uses", value: `\`${invite.uses ?? 0}\``, inline: true },
      { name: "Inviter", value: invite.inviter ? LogService.formatUser(invite.inviter) : "Unknown", inline: false },
    );
    await LogService.sendLog(guild, "inviteLogs", embed, {
      eventType: "invite",
      channelId: invite.channelId,
      user: invite.inviter ?? undefined,
    });
  });

  client.on(Events.InviteDelete, async (invite) => {
    const guildId = invite.guild?.id;
    if (!guildId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    await LogService.deleteInviteFromSnapshot(guild.id, invite.code);
    const embed = LogService.createBaseEmbed("📪 Invite Deleted", 0xe74c3c).addFields(
      { name: "Code", value: `\`${invite.code}\``, inline: true },
      { name: "Channel", value: invite.channelId ? `<#${invite.channelId}>` : "Unknown", inline: true },
    );
    await LogService.sendLog(guild, "inviteLogs", embed, {
      eventType: "invite",
      channelId: invite.channelId,
    });
  });
}
