import { Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

export function registerAdvancedLogs(client: Client): void {
  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    if (!thread.guild || !newlyCreated) return;
    const embed = LogService.createBaseEmbed("🧵 Thread Created", 0x2ecc71).addFields(
      { name: "Thread", value: `${thread} (\`${thread.id}\`)` },
      { name: "Parent Channel", value: thread.parentId ? `<#${thread.parentId}> (\`${thread.parentId}\`)` : "Unknown" },
      { name: "Owner ID", value: thread.ownerId ? `\`${thread.ownerId}\`` : "Unknown" },
      { name: "Archived", value: `\`${thread.archived}\``, inline: true },
      { name: "Locked", value: `\`${thread.locked}\``, inline: true },
    );
    await LogService.sendLog(thread.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: thread.parentId,
    });
  });

  client.on(Events.ThreadDelete, async (thread) => {
    if (!thread.guild) return;
    const embed = LogService.createBaseEmbed("🗑️ Thread Deleted", 0xe74c3c).addFields(
      { name: "Thread Name", value: `\`${thread.name}\`` },
      { name: "Thread ID", value: `\`${thread.id}\`` },
      { name: "Parent Channel", value: thread.parentId ? `<#${thread.parentId}> (\`${thread.parentId}\`)` : "Unknown" },
    );
    await LogService.sendLog(thread.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: thread.parentId,
    });
  });

  client.on(Events.ThreadUpdate, async (before, after) => {
    if (!after.guild) return;
    if (
      before.name === after.name &&
      before.archived === after.archived &&
      before.locked === after.locked &&
      before.rateLimitPerUser === after.rateLimitPerUser
    ) {
      return;
    }
    const embed = LogService.createBaseEmbed("🧵 Thread Updated", 0xf1c40f).addFields({
      name: "Thread",
      value: `${after} (\`${after.id}\`)`,
    });
    if (before.name !== after.name) addBeforeAfter(embed, before.name, after.name);
    if (before.archived !== after.archived) addBeforeAfter(embed, String(before.archived), String(after.archived));
    if (before.locked !== after.locked) addBeforeAfter(embed, String(before.locked), String(after.locked));
    if (before.rateLimitPerUser !== after.rateLimitPerUser) {
      addBeforeAfter(embed, String(before.rateLimitPerUser), String(after.rateLimitPerUser));
    }
    await LogService.sendLog(after.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: after.parentId,
    });
  });

  client.on(Events.ThreadMembersUpdate, async (oldMembers, newMembers, thread) => {
    if (!thread.guild) return;
    const removed = oldMembers.filter((m) => !newMembers.has(m.id));
    const added = newMembers.filter((m) => !oldMembers.has(m.id));
    if (!removed.size && !added.size) return;
    const embed = LogService.createBaseEmbed("👥 Thread Member Update", 0x3498db).addFields(
      { name: "Thread", value: `${thread} (\`${thread.id}\`)` },
      {
        name: "Added",
        value: added.size ? added.map((m) => `<@${m.id}> (\`${m.id}\`)`).join(", ") : "None",
      },
      {
        name: "Removed",
        value: removed.size ? removed.map((m) => `<@${m.id}> (\`${m.id}\`)`).join(", ") : "None",
      },
    );
    await LogService.sendLog(thread.guild, "channelLogs", embed, {
      eventType: "channel_update",
      channelId: thread.parentId,
    });
  });

  client.on(Events.GuildScheduledEventCreate, async (event) => {
    if (!event.guild) return;
    const embed = LogService.createBaseEmbed("📅 Scheduled Event Created", 0x2ecc71).addFields(
      { name: "Name", value: `\`${event.name}\`` },
      { name: "Event ID", value: `\`${event.id}\`` },
      { name: "Creator", value: event.creator ? LogService.formatUser(event.creator) : "Unknown" },
      { name: "Start Time", value: event.scheduledStartTimestamp ? `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:F>` : "Unknown" },
    );
    await LogService.sendLog(event.guild, "serverLogs", embed, { eventType: "server_update" });
  });

  client.on(Events.GuildScheduledEventDelete, async (event) => {
    if (!event.guild) return;
    const embed = LogService.createBaseEmbed("🗑️ Scheduled Event Deleted", 0xe74c3c).addFields(
      { name: "Name", value: `\`${event.name}\`` },
      { name: "Event ID", value: `\`${event.id}\`` },
    );
    await LogService.sendLog(event.guild, "serverLogs", embed, { eventType: "server_update" });
  });

  client.on(Events.GuildScheduledEventUpdate, async (before, after) => {
    if (!after.guild) return;
    if (!before) {
      const fallback = LogService.createBaseEmbed("📅 Scheduled Event Updated", 0xf1c40f).addFields(
        { name: "Event", value: `\`${after.name}\` (\`${after.id}\`)` },
        { name: "Change", value: "State changed, previous snapshot unavailable." },
      );
      await LogService.sendLog(after.guild, "serverLogs", fallback, { eventType: "server_update" });
      return;
    }
    if (
      before.name === after.name &&
      before.description === after.description &&
      before.scheduledStartTimestamp === after.scheduledStartTimestamp &&
      before.scheduledEndTimestamp === after.scheduledEndTimestamp &&
      before.status === after.status
    ) {
      return;
    }
    const embed = LogService.createBaseEmbed("📅 Scheduled Event Updated", 0xf1c40f).addFields({
      name: "Event",
      value: `\`${after.name}\` (\`${after.id}\`)`,
    });
    if (before.name !== after.name) addBeforeAfter(embed, before.name, after.name);
    if (before.description !== after.description) addBeforeAfter(embed, before.description ?? "None", after.description ?? "None");
    if (before.scheduledStartTimestamp !== after.scheduledStartTimestamp) {
      addBeforeAfter(embed, String(before.scheduledStartTimestamp), String(after.scheduledStartTimestamp));
    }
    if (before.scheduledEndTimestamp !== after.scheduledEndTimestamp) {
      addBeforeAfter(embed, String(before.scheduledEndTimestamp), String(after.scheduledEndTimestamp));
    }
    if (before.status !== after.status) addBeforeAfter(embed, String(before.status), String(after.status));
    await LogService.sendLog(after.guild, "serverLogs", embed, { eventType: "server_update" });
  });

  client.on(Events.WebhooksUpdate, async (channel) => {
    if (!channel.guild) return;
    const embed = LogService.createBaseEmbed("🪝 Webhook Updated", 0x3498db).addFields(
      { name: "Channel", value: `${channel} (\`${channel.id}\`)` },
      { name: "Guild ID", value: `\`${channel.guild.id}\`` },
      { name: "Note", value: "Webhook create/update/delete detected on this channel." },
    );
    await LogService.sendLog(channel.guild, "serverLogs", embed, {
      eventType: "server_update",
      channelId: channel.id,
    });
  });

  client.on(Events.UserUpdate, async (before, after) => {
    if (before.username === after.username && before.avatar === after.avatar) return;
    for (const guild of client.guilds.cache.values()) {
      const member = guild.members.cache.get(after.id) ?? (await guild.members.fetch(after.id).catch(() => null));
      if (!member) continue;
      const embed = LogService.createBaseEmbed("🪪 User Profile Updated", 0x3498db, after).addFields({
        name: "User",
        value: LogService.formatUser(after),
      });
      if (before.username !== after.username) addBeforeAfter(embed, before.username, after.username);
      if (before.avatar !== after.avatar) {
        embed.addFields({
          name: "Avatar",
          value: `Before: ${before.displayAvatarURL()}\nAfter: ${after.displayAvatarURL()}`,
        });
      }
      await LogService.sendLog(guild, "memberLogs", embed, {
        eventType: "member_update",
        user: after,
        memberRoleIds: [...member.roles.cache.keys()],
      });
    }
  });
}
