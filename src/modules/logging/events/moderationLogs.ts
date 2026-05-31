import { AuditLogEvent, Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";

export function registerModerationLogs(client: Client): void {
  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.user) return;
    if (LogService.shouldSkipKickLog(member.guild.id, member.id)) return;
    const entry = await LogService.fetchRelevantAuditEntry(
      member.guild,
      AuditLogEvent.MemberKick,
      member.id,
    );
    if (!entry) return;
    const embed = LogService.createBaseEmbed("🥾 Member Kicked", 0xe67e22, member.user)
      .setDescription(`Target: ${LogService.formatUser(member.user)}`)
      .addFields(
        { name: "Executor", value: entry.executor ? LogService.formatActor(entry.executor) : "Unknown" },
        { name: "Reason", value: LogService.slice(entry.reason ?? "No reason", 1024) },
      );
    await LogService.sendLog(member.guild, "moderationLogs", embed, {
      eventType: "moderation_kick",
      user: member.user,
    });
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    const beforeTimeout = before.communicationDisabledUntilTimestamp ?? 0;
    const afterTimeout = after.communicationDisabledUntilTimestamp ?? 0;
    if (beforeTimeout === afterTimeout) return;
    const entry = await LogService.fetchRelevantAuditEntry(
      after.guild,
      AuditLogEvent.MemberUpdate,
      after.id,
    );
    const isTimeout = afterTimeout > Date.now();
    const embed = LogService.createBaseEmbed(
      isTimeout ? "⏳ Member Timed Out" : "✅ Timeout Removed",
      isTimeout ? 0xe67e22 : 0x2ecc71,
      after.user,
    )
      .setDescription(`Target: ${LogService.formatUser(after.user)}`)
      .addFields({
        name: "Executor",
        value: entry?.executor ? LogService.formatActor(entry.executor) : "Unknown",
      });

    if (isTimeout) {
      embed.addFields({
        name: "Expires",
        value: `<t:${Math.floor(afterTimeout / 1000)}:F>`,
      });
    }
    await LogService.sendLog(after.guild, "moderationLogs", embed, {
      eventType: "moderation_timeout",
      user: after.user,
      memberRoleIds: [...after.roles.cache.keys()],
    });
  });
}
