import { AuditLogEvent, Events, type Client, type Message, type PartialMessage } from "discord.js";
import { dispatchLog } from "../core/logService.js";
import { chunkText, extractLinks, slice } from "../core/logFormatters.js";

type GhostSnapshot = {
  users: string[];
  roles: string[];
  channels: string[];
};

const ghostCache = new Map<string, GhostSnapshot>();
const pinState = new Map<string, number | null>();
const MAX_GHOST_CACHE = 5000;

function attachmentList(message: Message | PartialMessage): string {
  if (!message.attachments.size) return "Yok";
  return slice(
    message.attachments
      .map((att) => `[${att.name ?? "ek"}](${att.url})`)
      .slice(0, 8)
      .join("\n"),
    1024,
  );
}

function stickerList(message: Message | PartialMessage): string {
  if (!message.stickers.size) return "Yok";
  return slice(message.stickers.map((s) => `\`${s.name ?? s.id}\` (\`${s.id}\`)`).join("\n"), 1024);
}

function mentionList(message: Message | PartialMessage): string {
  const users = message.mentions.users.map((u) => `${u} (\`${u.id}\`)`).join(", ") || "Yok";
  const roles = message.mentions.roles.map((r) => `${r} (\`${r.id}\`)`).join(", ") || "Yok";
  const channels = message.mentions.channels.map((c) => `${c} (\`${c.id}\`)`).join(", ") || "Yok";
  return `Kullanıcılar: ${slice(users, 850)}\nRoller: ${slice(roles, 850)}\nKanallar: ${slice(channels, 850)}`;
}

export function registerMessageEvents(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    const mentions = message.mentions.users.map((u) => u.id);
    if (!mentions.length) return;
    ghostCache.set(message.id, {
      users: mentions,
      roles: message.mentions.roles.map((r) => r.id),
      channels: message.mentions.channels.map((c) => c.id),
    });
    if (ghostCache.size > MAX_GHOST_CACHE) {
      const firstKey = ghostCache.keys().next().value;
      if (firstKey) ghostCache.delete(firstKey);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    const full = message.partial ? await message.fetch().catch(() => null) : message;
    if (!full?.guild || !full.author) return;
    const ghost = ghostCache.get(full.id);
    ghostCache.delete(full.id);

    await dispatchLog(
      full.guild,
      {
        guildId: full.guild.id,
        eventType: "message_delete",
        action: "DELETE",
        category: "message",
        title: "🗑️ Mesaj Silindi",
        channelId: full.channelId,
        actor: {
          id: full.author.id,
          tag: full.author.tag,
          mention: `${full.author}`,
          avatarUrl: full.author.displayAvatarURL(),
          isBot: full.author.bot,
        },
        target: { id: full.id, label: "Mesaj" },
        fields: [
          { name: "Mesaj Bağlantısı", value: `[Git](${full.url})`, inline: false },
          { name: "Oluşturulma", value: `<t:${Math.floor(full.createdTimestamp / 1000)}:F>`, inline: true },
          { name: "Silinme", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: "Ekler", value: attachmentList(full), inline: false },
          { name: "Sticker", value: stickerList(full), inline: false },
          { name: "Etiketler", value: mentionList(full), inline: false },
          ...chunkText(full.content || "Metin yok", 950).map((chunk, index) => ({
            name: `İçerik ${index + 1}`,
            value: chunk,
            inline: false,
          })),
        ],
        links: extractLinks(full.content),
      },
      {
        includeAudit: {
          type: AuditLogEvent.MessageDelete,
          targetId: full.author.id,
          channelIdHint: full.channelId,
          maxAgeMs: 15_000,
        },
      },
    );

    if (ghost?.users.length) {
      await dispatchLog(full.guild, {
        guildId: full.guild.id,
        eventType: "ghost_ping",
        action: "INFO",
        category: "message",
        title: "👻 Ghost Ping",
        channelId: full.channelId,
        actor: {
          id: full.author.id,
          tag: full.author.tag,
          mention: `${full.author}`,
          avatarUrl: full.author.displayAvatarURL(),
          isBot: full.author.bot,
        },
        fields: [
          {
            name: "Etiketlenen Kullanıcılar",
            value: ghost.users.map((id) => `<@${id}> (\`${id}\`)`).join(", "),
          },
          {
            name: "Etiketlenen Roller",
            value: ghost.roles.length
              ? ghost.roles.map((id) => `<@&${id}> (\`${id}\`)`).join(", ")
              : "Yok",
          },
          {
            name: "Etiketlenen Kanallar",
            value: ghost.channels.length
              ? ghost.channels.map((id) => `<#${id}> (\`${id}\`)`).join(", ")
              : "Yok",
          },
        ],
      });
    }
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

    await dispatchLog(newMsg.guild, {
      guildId: newMsg.guild.id,
      eventType: "message_update",
      action: "UPDATE",
      category: "message",
      title: "✏️ Mesaj Düzenlendi",
      channelId: newMsg.channelId,
      actor: {
        id: newMsg.author.id,
        tag: newMsg.author.tag,
        mention: `${newMsg.author}`,
        avatarUrl: newMsg.author.displayAvatarURL(),
        isBot: newMsg.author.bot,
      },
      target: { id: newMsg.id, label: "Mesaj" },
      fields: [
        { name: "Mesaj Bağlantısı", value: `[Git](${newMsg.url})` },
        { name: "Ekler (Önce)", value: attachmentList(oldMsg), inline: false },
        { name: "Ekler (Sonra)", value: attachmentList(newMsg), inline: false },
      ],
      beforeAfter: [
        {
          label: "Mesaj İçeriği",
          before: oldMsg.content || "Metin yok",
          after: newMsg.content || "Metin yok",
        },
      ],
      links: [...extractLinks(oldMsg.content), ...extractLinks(newMsg.content)],
    });
  });

  client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first();
    if (!first?.guild) return;

    await dispatchLog(first.guild, {
      guildId: first.guild.id,
      eventType: "message_bulk_delete",
      action: "DELETE",
      category: "message",
      title: "🧹 Toplu Mesaj Silme",
      channelId: first.channelId,
      fields: [
        { name: "Silinen Mesaj", value: `\`${messages.size}\``, inline: true },
        {
          name: "Örnek Mesajlar",
          value:
            messages
              .first(5)
              .map((m) => `- ${m.author ? m.author.tag : "Bilinmiyor"}: ${slice(m.content, 120)}`)
              .join("\n") || "Örnek yok",
          inline: false,
        },
      ],
      links: [],
    });
  });

  client.on(Events.ChannelPinsUpdate, async (channel, lastPinTimestamp) => {
    if (!channel.isTextBased() || !("guild" in channel) || !channel.guild) return;
    const prev = pinState.get(channel.id) ?? null;
    const lastPinMs = lastPinTimestamp ? lastPinTimestamp.getTime() : null;
    pinState.set(channel.id, lastPinMs);
    const isPin = Boolean(lastPinMs && (!prev || lastPinMs > prev));

    await dispatchLog(channel.guild, {
      guildId: channel.guild.id,
      eventType: isPin ? "message_pin" : "message_unpin",
      action: "UPDATE",
      category: "message",
      title: isPin ? "📌 Mesaj Sabitlendi" : "📌 Sabit Mesaj Kaldırıldı",
      channelId: channel.id,
      fields: [
        {
          name: "Not",
          value: "Discord API bu eventte mesaj ve aktör bilgisini her zaman sağlamaz.",
          inline: false,
        },
        {
          name: "Son Sabitleme Zamanı",
          value: lastPinMs ? `<t:${Math.floor(lastPinMs / 1000)}:F>` : "Yok",
          inline: false,
        },
      ],
    });
  });
}

