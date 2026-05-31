import { AuditLogEvent, Events, type Client, type GuildChannel } from "discord.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

function overwriteSnapshot(channel: GuildChannel): string {
  const values = channel.permissionOverwrites.cache.map((ow) => {
    const allow = ow.allow.toArray().join(", ") || "None";
    const deny = ow.deny.toArray().join(", ") || "None";
    return `Target \`${ow.id}\`\nAllow: ${allow}\nDeny: ${deny}`;
  });
  return values.length ? LogService.slice(values.join("\n\n"), 1024) : "None";
}

export function registerChannelLogs(client: Client): void {
  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const audit = await LogService.fetchRelevantAuditEntry(
      channel.guild,
      AuditLogEvent.ChannelCreate,
      channel.id,
    );
    const embed = LogService.createBaseEmbed("🆕 Channel Created", 0x2ecc71).addFields(
      { name: "Channel", value: `${String(channel)} (\`${channel.id}\`)` },
      { name: "Type", value: `\`${channel.type}\``, inline: true },
      { name: "Parent", value: "parent" in channel && channel.parent ? `${channel.parent}` : "None", inline: true },
      {
        name: "Executor",
        value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
      },
    );
    await LogService.sendLog(channel.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: channel.id,
    });
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const audit = await LogService.fetchRelevantAuditEntry(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id,
    );
    const embed = LogService.createBaseEmbed("🗑️ Channel Deleted", 0xe74c3c).addFields(
      { name: "Name", value: `\`${"name" in channel ? channel.name : "unknown"}\`` },
      { name: "ID", value: `\`${channel.id}\`` },
      {
        name: "Executor",
        value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
      },
    );
    await LogService.sendLog(channel.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: channel.id,
    });
  });

  client.on(Events.ChannelUpdate, async (before, after) => {
    if (!("guild" in after) || !after.guild) return;
    const beforeName = "name" in before ? before.name : null;
    const afterName = "name" in after ? after.name : null;
    const beforeParentId = "parentId" in before ? before.parentId : null;
    const afterParentId = "parentId" in after ? after.parentId : null;
    const beforeTopic = "topic" in before ? (before.topic ?? null) : null;
    const afterTopic = "topic" in after ? (after.topic ?? null) : null;
    const beforeNsfw = "nsfw" in before ? before.nsfw : null;
    const afterNsfw = "nsfw" in after ? after.nsfw : null;
    const beforeBitrate = "bitrate" in before ? before.bitrate : null;
    const afterBitrate = "bitrate" in after ? after.bitrate : null;
    const beforeUserLimit = "userLimit" in before ? before.userLimit : null;
    const afterUserLimit = "userLimit" in after ? after.userLimit : null;
    const beforeSlowmode = "rateLimitPerUser" in before ? before.rateLimitPerUser : null;
    const afterSlowmode = "rateLimitPerUser" in after ? after.rateLimitPerUser : null;
    const changed =
      beforeName !== afterName ||
      beforeParentId !== afterParentId ||
      before.type !== after.type ||
      beforeTopic !== afterTopic ||
      beforeNsfw !== afterNsfw ||
      beforeBitrate !== afterBitrate ||
      beforeUserLimit !== afterUserLimit ||
      beforeSlowmode !== afterSlowmode ||
      overwriteSnapshot(before as GuildChannel) !== overwriteSnapshot(after as GuildChannel);
    if (!changed) return;
    const audit = await LogService.fetchRelevantAuditEntry(after.guild, AuditLogEvent.ChannelUpdate, after.id);
    const embed = LogService.createBaseEmbed("✏️ Channel Updated", 0xf1c40f).addFields({
      name: "Channel",
      value: `${after} (\`${after.id}\`)`,
    });
    if (beforeName !== afterName) addBeforeAfter(embed, beforeName ?? "None", afterName ?? "None");
    if (beforeTopic !== afterTopic) addBeforeAfter(embed, beforeTopic ?? "None", afterTopic ?? "None");
    if (beforeParentId !== afterParentId) addBeforeAfter(embed, beforeParentId ?? "None", afterParentId ?? "None");
    if (before.type !== after.type) addBeforeAfter(embed, String(before.type), String(after.type));
    if (beforeNsfw !== afterNsfw) addBeforeAfter(embed, String(beforeNsfw), String(afterNsfw));
    if (beforeBitrate !== afterBitrate) addBeforeAfter(embed, String(beforeBitrate), String(afterBitrate));
    if (beforeUserLimit !== afterUserLimit) addBeforeAfter(embed, String(beforeUserLimit), String(afterUserLimit));
    if (beforeSlowmode !== afterSlowmode) addBeforeAfter(embed, String(beforeSlowmode), String(afterSlowmode));
    const beforeOw = overwriteSnapshot(before as GuildChannel);
    const afterOw = overwriteSnapshot(after as GuildChannel);
    if (beforeOw !== afterOw) {
      addBeforeAfter(embed, beforeOw, afterOw);
    }
    embed.addFields({
      name: "Executor",
      value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
    });
    await LogService.sendLog(after.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: after.id,
    });
  });
}
