import { Events, type Client, type Message, type PartialMessage } from "discord.js";
import { GHOST_PING_CACHE_MAX } from "../../../config/constants.js";
import { LruCache } from "../../../utils/lruCache.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

type GhostPingSnapshot = {
  mentionedUsers: string[];
  mentionedRoles: string[];
  mentionedChannels: string[];
};

const ghostPingCache = new LruCache<string, GhostPingSnapshot>(GHOST_PING_CACHE_MAX);

function attachmentList(message: Message | PartialMessage): string {
  if (!message.attachments.size) return "None";
  return LogService.slice(
    message.attachments
      .map((att) => `[${att.name ?? "attachment"}](${att.url})`)
      .slice(0, 8)
      .join("\n"),
    1024,
  );
}

function stickerList(message: Message | PartialMessage): string {
  if (!message.stickers.size) return "None";
  return LogService.slice(message.stickers.map((s) => `\`${s.name ?? s.id}\` (\`${s.id}\`)`).join("\n"), 1024);
}

function embedList(message: Message | PartialMessage): string {
  if (!message.embeds.length) return "None";
  return LogService.slice(
    message.embeds
      .map((e, i) => `${i + 1}. ${e.title ?? "No title"} • ${e.url ?? "no url"}`)
      .join("\n"),
    1024,
  );
}

function mentionList(message: Message | PartialMessage): string {
  const users = message.mentions.users.map((u) => `${u} (\`${u.id}\`)`).join(", ") || "None";
  const roles = message.mentions.roles.map((r) => `${r} (\`${r.id}\`)`).join(", ") || "None";
  const channels =
    message.mentions.channels.map((c) => `${c} (\`${c.id}\`)`).join(", ") || "None";
  return `Users: ${LogService.slice(users, 900)}\nRoles: ${LogService.slice(roles, 900)}\nChannels: ${LogService.slice(channels, 900)}`;
}

export function registerMessageLogs(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    const mentions = message.mentions.users.map((u) => u.id);
    if (!mentions.length) return;
    ghostPingCache.set(message.id, {
      mentionedUsers: mentions,
      mentionedRoles: message.mentions.roles.map((r) => r.id),
      mentionedChannels: message.mentions.channels.map((c) => c.id),
    });
  });

  client.on(Events.MessageDelete, async (message) => {
    const full = message.partial ? await message.fetch().catch(() => null) : message;
    if (!full?.guild || !full.author) return;
    const member = await full.guild.members.fetch(full.author.id).catch(() => null);
    const links = LogService.extractLinks(full.content);
    const deletedBy = await LogService.resolveMessageDeleteExecutor(
      full.guild,
      full.author.id,
      full.channelId,
    );
    const coreEmbed = LogService.createBaseEmbed("🗑️ Message Deleted", 0xe74c3c, full.author)
      .addFields(
        { name: "Author", value: LogService.formatUser(full.author), inline: false },
        { name: "Deleted By", value: deletedBy, inline: false },
        { name: "Channel", value: `<#${full.channelId}> (\`${full.channelId}\`)`, inline: false },
        { name: "Guild ID", value: `\`${full.guild.id}\``, inline: true },
        { name: "Message ID", value: `\`${full.id}\``, inline: true },
        { name: "Created At", value: `<t:${Math.floor(full.createdTimestamp / 1000)}:F>`, inline: true },
        { name: "Deleted At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: "Mentions", value: mentionList(full), inline: false },
        { name: "Attachments", value: attachmentList(full) },
        { name: "Stickers", value: stickerList(full) },
        { name: "Embeds", value: embedList(full) },
        { name: "Links", value: links.length ? LogService.slice(links.join("\n"), 1024) : "None" },
        { name: "Roles At Deletion", value: LogService.formatRoleSnapshot(member) },
        {
          name: "User Context",
          value: `Account Created: <t:${Math.floor(full.author.createdTimestamp / 1000)}:F>\nServer Join: ${
            member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Unknown"
          }`,
        },
      );

    const embeds = [coreEmbed];
    const contentChunks = LogService.chunkText(full.content || "No text content", 1000);
    for (let i = 0; i < contentChunks.length; i += 1) {
      embeds.push(
        LogService.createBaseEmbed(`🧾 Message Content (${i + 1}/${contentChunks.length})`, 0xe74c3c, full.author).addFields(
          { name: "Content Chunk", value: contentChunks[i] || "N/A" },
        ),
      );
    }

    const ghost = ghostPingCache.get(full.id);
    const hasGhost = Boolean(ghost?.mentionedUsers.length);
    if (ghost && hasGhost) {
      embeds.push(
        LogService.createBaseEmbed("👻 Ghost Ping Detected", 0x8e44ad, full.author).addFields(
          { name: "Author", value: LogService.formatUser(full.author) },
          {
            name: "Mentioned Users",
            value: ghost.mentionedUsers.map((id) => `<@${id}> (\`${id}\`)`).join(", "),
          },
          {
            name: "Mentioned Roles",
            value: ghost.mentionedRoles.length
              ? ghost.mentionedRoles.map((id) => `<@&${id}> (\`${id}\`)`).join(", ")
              : "None",
          },
          {
            name: "Mentioned Channels",
            value: ghost.mentionedChannels.length
              ? ghost.mentionedChannels.map((id) => `<#${id}> (\`${id}\`)`).join(", ")
              : "None",
          },
        ),
      );
      ghostPingCache.delete(full.id);
    }

    const baseFilter = {
      eventType: "message_delete" as const,
      channelId: full.channelId,
      user: full.author,
      memberRoleIds: member ? [...member.roles.cache.keys()] : undefined,
    };

    if (hasGhost) {
      const mainEmbeds = embeds.slice(0, -1);
      const ghostEmbeds = embeds.slice(-1);
      await LogService.sendLogs(full.guild, "messageLogs", mainEmbeds, baseFilter);
      await LogService.sendLogs(full.guild, "messageLogs", ghostEmbeds, {
        eventType: "ghost_ping",
        channelId: full.channelId,
        user: full.author,
        memberRoleIds: member ? [...member.roles.cache.keys()] : undefined,
      });
    } else {
      await LogService.sendLogs(full.guild, "messageLogs", embeds, baseFilter);
    }
  });

  client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first();
    if (!first?.guild) return;
    const embed = LogService.createBaseEmbed("🧹 Bulk Message Delete", 0xe67e22).addFields(
      { name: "Channel", value: first.channelId ? `<#${first.channelId}>` : "Unknown", inline: true },
      { name: "Count", value: `\`${messages.size}\``, inline: true },
      {
        name: "Sample Messages",
        value:
          messages
            .first(5)
            .map((m) => `- ${m.author ? m.author.tag : "Unknown"}: ${LogService.slice(m.content, 120)}`)
            .join("\n") || "No sample available",
      },
    );
    await LogService.sendLog(first.guild, "messageLogs", embed, {
      eventType: "bulk_delete",
      channelId: first.channelId,
    });
  });

  client.on(Events.MessageUpdate, async (before, after) => {
    const oldMsg = before.partial ? await before.fetch().catch(() => null) : before;
    const newMsg = after.partial ? await after.fetch().catch(() => null) : after;
    if (!oldMsg || !newMsg || !newMsg.guild || !newMsg.author) return;
    if (
      oldMsg.content === newMsg.content &&
      oldMsg.attachments.size === newMsg.attachments.size &&
      oldMsg.embeds.length === newMsg.embeds.length
    ) {
      return;
    }
    const member = await newMsg.guild.members.fetch(newMsg.author.id).catch(() => null);
    const embed = LogService.createBaseEmbed("✏️ Message Updated", 0xf1c40f, newMsg.author).addFields(
      { name: "Author", value: LogService.formatUser(newMsg.author), inline: false },
      { name: "Channel", value: `<#${newMsg.channelId}> (\`${newMsg.channelId}\`)`, inline: false },
      { name: "Message ID", value: `\`${newMsg.id}\``, inline: true },
      { name: "Edit Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "Jump", value: `[Go to message](${newMsg.url})`, inline: true },
      { name: "Attachments (Before)", value: attachmentList(oldMsg) },
      { name: "Attachments (After)", value: attachmentList(newMsg) },
      { name: "Embeds (Before)", value: embedList(oldMsg) },
      { name: "Embeds (After)", value: embedList(newMsg) },
    );
    addBeforeAfter(embed, oldMsg.content || "No text content", newMsg.content || "No text content");
    await LogService.sendLog(newMsg.guild, "messageLogs", embed, {
      eventType: "message_edit",
      channelId: newMsg.channelId,
      user: newMsg.author,
      memberRoleIds: member ? [...member.roles.cache.keys()] : undefined,
    });
  });
}
