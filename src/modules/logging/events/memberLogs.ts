import { AuditLogEvent, Events, type Client } from "discord.js";
import { getRedis } from "../../../services/redis.js";
import { redisKeys } from "../../../config/redisKeys.js";
import { getGuildConfig } from "../../../services/guildSettingsCache.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter, listOrFallback, unixTime } from "./helpers.js";

export function registerMemberLogs(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    const embed = LogService.createBaseEmbed("👋 Member Joined", 0x2ecc71, member.user)
      .setDescription(`User: ${LogService.formatUser(member.user)}`)
      .addFields(
        { name: "Account Created", value: unixTime(member.user.createdTimestamp), inline: false },
        { name: "Account Age", value: `${accountAgeDays} days`, inline: true },
        { name: "Joined At", value: unixTime(Date.now()), inline: false },
        { name: "Avatar URL", value: member.user.displayAvatarURL() },
        { name: "Member Count", value: `\`${member.guild.memberCount}\`` },
      );

    const usedInvite = await LogService.findUsedInvite(member.guild);
    if (usedInvite) {
      embed.addFields({
        name: "Invite Used",
        value: `Code: \`${usedInvite.code}\` • Uses: \`${usedInvite.uses ?? 0}\`\nInviter: ${
          usedInvite.inviter ? LogService.formatUser(usedInvite.inviter) : "Unknown"
        }`,
      });
    }
    if (member.user.bot) {
      embed.setTitle("🤖 Bot Added to Server");
    }
    await LogService.sendLog(member.guild, "memberLogs", embed, {
      eventType: "member_join",
      user: member.user,
      memberRoleIds: [...member.roles.cache.keys()],
    });

    const cfg = await getGuildConfig(member.guild.id);
    if (cfg?.moderation?.antiRaid) {
      const redis = getRedis();
      const k = redisKeys.raidCounter(member.guild.id);
      const n = await redis.incr(k);
      const win = cfg.moderation.raidWindowSec ?? 10;
      if (n === 1) await redis.expire(k, win);
      const threshold = cfg.moderation.raidJoinsPerSec ?? 8;
      if (n >= threshold) {
        const alert = LogService.createBaseEmbed("🦉 Possible raid spike", 0xe67e22)
          .setDescription(
            `**${n}** joins in ~${win}s window. Check moderation.`,
          )
          .setFooter({ text: "BilgeBaykuş" });
        await LogService.sendLog(member.guild, "moderationLogs", alert, { eventType: "raid_alert" });
      }
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.user) return;
    const kickAudit = await LogService.fetchRelevantAuditEntry(
      member.guild,
      AuditLogEvent.MemberKick,
      member.id,
    );
    const joined = member.joinedTimestamp ?? null;
    const timeInGuild = joined
      ? `${Math.floor((Date.now() - joined) / (1000 * 60 * 60 * 24))} days`
      : "Unknown";
    const rolesOnLeave =
      "roles" in member && "cache" in member.roles
        ? LogService.slice(
            member.roles.cache
              .filter((role) => role.id !== member.guild.id)
              .map((role) => `${role} (\`${role.id}\`)`)
              .join("\n") || "No roles",
            1024,
          )
        : "Unknown";
    const embed = LogService.createBaseEmbed("🚪 Member Left", 0xe67e22, member.user).setDescription(
      `User: ${LogService.formatUser(member.user)}`,
    );
    embed.addFields(
      { name: "Roles", value: rolesOnLeave },
      { name: "Joined At", value: joined ? unixTime(joined) : "Unknown", inline: true },
      { name: "Time In Server", value: timeInGuild, inline: true },
      {
        name: "Kick Detection",
        value: kickAudit?.executor
          ? `Possibly kicked by ${LogService.formatActor(kickAudit.executor)}`
          : "No kick audit correlation",
      },
    );
    if (member.user.bot) {
      embed.setTitle("🤖 Bot Removed from Server");
    }
    await LogService.sendLog(member.guild, "memberLogs", embed, {
      eventType: "member_leave",
      user: member.user,
    });
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    const roleAdded = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const roleRemoved = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    const nickChanged = before.nickname !== after.nickname;
    const avatarChanged = before.avatar !== after.avatar;
    const boostedChanged = before.premiumSinceTimestamp !== after.premiumSinceTimestamp;
    if (!nickChanged && !avatarChanged && !roleAdded.size && !roleRemoved.size && !boostedChanged) return;

    const embed = LogService.createBaseEmbed("🧍 Member Updated", 0x3498db, after.user).setDescription(
      `User: ${LogService.formatUser(after.user)}`,
    );

    if (nickChanged) addBeforeAfter(embed, before.nickname ?? "None", after.nickname ?? "None");
    if (avatarChanged) {
      embed.addFields({
        name: "Avatar Change",
        value: `Before: ${before.displayAvatarURL()}\nAfter: ${after.displayAvatarURL()}`,
      });
    }
    if (roleAdded.size || roleRemoved.size) {
      embed.addFields(
        { name: "Roles Added", value: listOrFallback(roleAdded.map((r) => r.toString())) },
        { name: "Roles Removed", value: listOrFallback(roleRemoved.map((r) => r.toString())) },
      );
    }
    const roleIds = [...after.roles.cache.keys()];
    if (boostedChanged) {
      const label = after.premiumSinceTimestamp ? "Started boosting" : "Stopped boosting";
      embed.addFields({ name: "Boost Status", value: label });
      await LogService.sendLog(after.guild, "serverLogs", embed, {
        eventType: "member_update",
        user: after.user,
        memberRoleIds: roleIds,
      });
    } else {
      await LogService.sendLog(after.guild, "memberLogs", embed, {
        eventType: "member_update",
        user: after.user,
        memberRoleIds: roleIds,
      });
      if (roleAdded.size || roleRemoved.size) {
        await LogService.sendLog(after.guild, "roleLogs", embed, {
          eventType: "role_update",
          user: after.user,
          memberRoleIds: roleIds,
        });
      }
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    const audit = await LogService.fetchRelevantAuditEntry(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id,
    );
    const reason = audit?.reason ?? ban.reason ?? "No reason";
    const embed = LogService.createBaseEmbed("🔨 Member Banned", 0xe74c3c, ban.user)
      .setDescription(`Target: ${LogService.formatUser(ban.user)}`)
      .addFields(
        { name: "Executor", value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown" },
        { name: "Reason", value: LogService.slice(reason, 1024) },
      );
    await LogService.sendLog(ban.guild, "moderationLogs", embed, {
      eventType: "member_ban",
      user: ban.user,
    });
    await LogService.sendLog(ban.guild, "memberLogs", embed, {
      eventType: "member_ban",
      user: ban.user,
    });
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    const audit = await LogService.fetchRelevantAuditEntry(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id,
    );
    const embed = LogService.createBaseEmbed("🔓 Member Unbanned", 0x2ecc71, ban.user)
      .setDescription(`Target: ${LogService.formatUser(ban.user)}`)
      .addFields({
        name: "Executor",
        value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
      });
    await LogService.sendLog(ban.guild, "moderationLogs", embed, {
      eventType: "member_unban",
      user: ban.user,
    });
    await LogService.sendLog(ban.guild, "memberLogs", embed, {
      eventType: "member_unban",
      user: ban.user,
    });
  });
}
