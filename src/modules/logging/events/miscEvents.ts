import {
  AuditLogEvent,
  Events,
  type Channel,
  type Client,
  type GuildBasedChannel,
  type GuildEmoji,
  type Sticker,
} from "discord.js";
import { dispatchLog } from "../core/logService.js";
import { permissionDiff, slice } from "../core/logFormatters.js";

function overwriteSnapshot(channel: GuildBasedChannel): string {
  if (!("permissionOverwrites" in channel)) return "Yok";
  const rows = channel.permissionOverwrites.cache.map((ow) => {
    const allow = ow.allow.toArray().join(", ") || "Yok";
    const deny = ow.deny.toArray().join(", ") || "Yok";
    return `Hedef \`${ow.id}\`\nİzin: ${allow}\nEngel: ${deny}`;
  });
  return rows.length ? slice(rows.join("\n\n"), 1024) : "Yok";
}

function channelLabel(channel: Channel): string {
  const c = channel as { id?: string; toString: () => string };
  return `${c.toString()} (\`${c.id ?? "bilinmiyor"}\`)`;
}

function stickerLabel(sticker: Sticker): string {
  return `\`${sticker.name}\` (\`${sticker.id}\`)`;
}

function emojiLabel(emoji: GuildEmoji): string {
  return `${emoji.toString()} (\`${emoji.id}\`)`;
}

export function registerMiscEvents(client: Client): void {
  client.on(Events.GuildRoleCreate, async (role) => {
    await dispatchLog(
      role.guild,
      {
        guildId: role.guild.id,
        eventType: "role_create",
        action: "CREATE",
        category: "role",
        title: "🆕 Rol Oluşturuldu",
        target: { id: role.id, label: `${role}` },
        fields: [
          { name: "Renk", value: `\`${role.hexColor}\`` },
          { name: "Mentionable", value: `\`${role.mentionable}\`` },
          { name: "Hoist", value: `\`${role.hoist}\`` },
        ],
      },
      { includeAudit: { type: AuditLogEvent.RoleCreate, targetId: role.id } },
    );
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    await dispatchLog(
      role.guild,
      {
        guildId: role.guild.id,
        eventType: "role_delete",
        action: "DELETE",
        category: "role",
        title: "🗑️ Rol Silindi",
        target: { id: role.id, label: role.name },
      },
      { includeAudit: { type: AuditLogEvent.RoleDelete, targetId: role.id } },
    );
  });

  client.on(Events.GuildRoleUpdate, async (before, after) => {
    if (
      before.name === after.name &&
      before.hexColor === after.hexColor &&
      before.permissions.bitfield === after.permissions.bitfield &&
      before.mentionable === after.mentionable &&
      before.hoist === after.hoist
    ) {
      return;
    }
    const diff = permissionDiff(before.permissions.bitfield, after.permissions.bitfield);
    await dispatchLog(
      after.guild,
      {
        guildId: after.guild.id,
        eventType: "role_update",
        action: "UPDATE",
        category: "role",
        title: "✏️ Rol Güncellendi",
        target: { id: after.id, label: `${after}` },
        beforeAfter: [
          ...(before.name !== after.name ? [{ label: "İsim", before: before.name, after: after.name }] : []),
          ...(before.hexColor !== after.hexColor
            ? [{ label: "Renk", before: before.hexColor, after: after.hexColor }]
            : []),
          ...(before.mentionable !== after.mentionable
            ? [{ label: "Mentionable", before: String(before.mentionable), after: String(after.mentionable) }]
            : []),
          ...(before.hoist !== after.hoist
            ? [{ label: "Hoist", before: String(before.hoist), after: String(after.hoist) }]
            : []),
        ],
        fields: [
          { name: "Eklenen İzinler", value: diff.added.length ? diff.added.join(", ") : "Yok" },
          { name: "Kaldırılan İzinler", value: diff.removed.length ? diff.removed.join(", ") : "Yok" },
        ],
      },
      { includeAudit: { type: AuditLogEvent.RoleUpdate, targetId: after.id } },
    );
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel)) return;
    await dispatchLog(
      channel.guild,
      {
        guildId: channel.guild.id,
        eventType: "channel_create",
        action: "CREATE",
        category: "channel",
        title: "🆕 Kanal Oluşturuldu",
        channelId: channel.id,
        target: { id: channel.id, label: channelLabel(channel) },
        fields: [{ name: "Tür", value: `\`${channel.type}\`` }],
      },
      { includeAudit: { type: AuditLogEvent.ChannelCreate, targetId: channel.id } },
    );
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel)) return;
    await dispatchLog(
      channel.guild,
      {
        guildId: channel.guild.id,
        eventType: "channel_delete",
        action: "DELETE",
        category: "channel",
        title: "🗑️ Kanal Silindi",
        target: {
          id: channel.id,
          label:
            "name" in channel
              ? channel.name
              : (channel as unknown as { id?: string }).id ?? "bilinmiyor",
        },
      },
      { includeAudit: { type: AuditLogEvent.ChannelDelete, targetId: channel.id } },
    );
  });

  client.on(Events.ChannelUpdate, async (before, after) => {
    if (!("guild" in after)) return;
    const beforeOw = overwriteSnapshot(before as GuildBasedChannel);
    const afterOw = overwriteSnapshot(after as GuildBasedChannel);
    const beforeName = "name" in before ? before.name : "";
    const afterName = "name" in after ? after.name : "";
    if (beforeName === afterName && beforeOw === afterOw) return;

    await dispatchLog(
      after.guild,
      {
        guildId: after.guild.id,
        eventType: "channel_update",
        action: "UPDATE",
        category: "channel",
        title: "✏️ Kanal Güncellendi",
        channelId: after.id,
        target: { id: after.id, label: channelLabel(after) },
        beforeAfter: [
          ...(beforeName !== afterName ? [{ label: "İsim", before: beforeName, after: afterName }] : []),
          ...(beforeOw !== afterOw ? [{ label: "İzinler", before: beforeOw, after: afterOw }] : []),
        ],
      },
      { includeAudit: { type: AuditLogEvent.ChannelUpdate, targetId: after.id } },
    );
  });

  client.on(Events.GuildUpdate, async (before, after) => {
    if (
      before.name === after.name &&
      before.icon === after.icon &&
      before.banner === after.banner &&
      before.vanityURLCode === after.vanityURLCode &&
      before.verificationLevel === after.verificationLevel &&
      before.rulesChannelId === after.rulesChannelId &&
      before.systemChannelId === after.systemChannelId &&
      before.publicUpdatesChannelId === after.publicUpdatesChannelId
    ) {
      return;
    }
    await dispatchLog(after, {
      guildId: after.id,
      eventType: "guild_update",
      action: "UPDATE",
      category: "server",
      title: "🏰 Sunucu Güncellendi",
      target: { id: after.id, label: after.name },
      beforeAfter: [
        ...(before.name !== after.name ? [{ label: "İsim", before: before.name, after: after.name }] : []),
        ...(before.vanityURLCode !== after.vanityURLCode
          ? [{ label: "Vanity URL", before: before.vanityURLCode ?? "Yok", after: after.vanityURLCode ?? "Yok" }]
          : []),
        ...(before.verificationLevel !== after.verificationLevel
          ? [{ label: "Doğrulama", before: String(before.verificationLevel), after: String(after.verificationLevel) }]
          : []),
      ],
      fields: [
        ...(before.icon !== after.icon
          ? [{ name: "Icon", value: `Önce: ${before.iconURL() ?? "Yok"}\nSonra: ${after.iconURL() ?? "Yok"}` }]
          : []),
        ...(before.banner !== after.banner
          ? [{ name: "Banner", value: `Önce: ${before.bannerURL() ?? "Yok"}\nSonra: ${after.bannerURL() ?? "Yok"}` }]
          : []),
      ],
    });
  });

  client.on(Events.InviteCreate, async (invite) => {
    if (!invite.guild) return;
    const guild = client.guilds.cache.get(invite.guild.id);
    if (!guild) return;
    await dispatchLog(guild, {
      guildId: guild.id,
      eventType: "invite_create",
      action: "CREATE",
      category: "invite",
      title: "📨 Davet Oluşturuldu",
      channelId: invite.channelId,
      actor: invite.inviter
        ? {
            id: invite.inviter.id,
            tag: invite.inviter.tag,
            mention: `${invite.inviter}`,
            avatarUrl: invite.inviter.displayAvatarURL(),
            isBot: invite.inviter.bot,
          }
        : null,
      fields: [
        { name: "Kod", value: `\`${invite.code}\``, inline: true },
        { name: "Kullanım", value: `\`${invite.uses ?? 0}\``, inline: true },
        { name: "Maks", value: `\`${invite.maxUses ?? 0}\``, inline: true },
      ],
    });
  });

  client.on(Events.InviteDelete, async (invite) => {
    if (!invite.guild) return;
    const guild = client.guilds.cache.get(invite.guild.id);
    if (!guild) return;
    await dispatchLog(guild, {
      guildId: guild.id,
      eventType: "invite_delete",
      action: "DELETE",
      category: "invite",
      title: "📪 Davet Silindi",
      channelId: invite.channelId,
      fields: [{ name: "Kod", value: `\`${invite.code}\`` }],
    });
  });

  client.on(Events.GuildEmojiCreate, async (emoji) => {
    await dispatchLog(emoji.guild, {
      guildId: emoji.guild.id,
      eventType: "emoji_create",
      action: "CREATE",
      category: "emojiSticker",
      title: "😀 Emoji Oluşturuldu",
      target: { id: emoji.id, label: emojiLabel(emoji) },
    });
  });

  client.on(Events.GuildEmojiDelete, async (emoji) => {
    await dispatchLog(emoji.guild, {
      guildId: emoji.guild.id,
      eventType: "emoji_delete",
      action: "DELETE",
      category: "emojiSticker",
      title: "🗑️ Emoji Silindi",
      target: { id: emoji.id, label: emoji.name ?? emoji.id },
    });
  });

  client.on(Events.GuildEmojiUpdate, async (before, after) => {
    if (before.name === after.name) return;
    await dispatchLog(after.guild, {
      guildId: after.guild.id,
      eventType: "emoji_update",
      action: "UPDATE",
      category: "emojiSticker",
      title: "✏️ Emoji Güncellendi",
      target: { id: after.id, label: emojiLabel(after) },
      beforeAfter: [{ label: "İsim", before: before.name ?? "Yok", after: after.name ?? "Yok" }],
    });
  });

  client.on(Events.GuildStickerCreate, async (sticker) => {
    if (!sticker.guild) return;
    await dispatchLog(sticker.guild, {
      guildId: sticker.guild.id,
      eventType: "sticker_create",
      action: "CREATE",
      category: "emojiSticker",
      title: "🆕 Sticker Oluşturuldu",
      target: { id: sticker.id, label: stickerLabel(sticker) },
      fields: [{ name: "Açıklama", value: slice(sticker.description ?? "Yok", 1024) }],
    });
  });

  client.on(Events.GuildStickerDelete, async (sticker) => {
    if (!sticker.guild) return;
    await dispatchLog(sticker.guild, {
      guildId: sticker.guild.id,
      eventType: "sticker_delete",
      action: "DELETE",
      category: "emojiSticker",
      title: "🗑️ Sticker Silindi",
      target: { id: sticker.id, label: stickerLabel(sticker) },
    });
  });

  client.on(Events.GuildStickerUpdate, async (before, after) => {
    if (!after.guild) return;
    if (before.name === after.name && before.description === after.description) return;
    await dispatchLog(after.guild, {
      guildId: after.guild.id,
      eventType: "sticker_update",
      action: "UPDATE",
      category: "emojiSticker",
      title: "✏️ Sticker Güncellendi",
      target: { id: after.id, label: stickerLabel(after) },
      beforeAfter: [
        ...(before.name !== after.name ? [{ label: "İsim", before: before.name, after: after.name }] : []),
        ...(before.description !== after.description
          ? [{ label: "Açıklama", before: before.description ?? "Yok", after: after.description ?? "Yok" }]
          : []),
      ],
    });
  });

  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    if (!thread.guild || !newlyCreated) return;
    await dispatchLog(thread.guild, {
      guildId: thread.guild.id,
      eventType: "thread_create",
      action: "CREATE",
      category: "thread",
      title: "🧵 Thread Oluşturuldu",
      channelId: thread.parentId,
      target: { id: thread.id, label: thread.name },
      fields: [
        { name: "Arşiv", value: `\`${thread.archived}\``, inline: true },
        { name: "Kilit", value: `\`${thread.locked}\``, inline: true },
      ],
    });
  });

  client.on(Events.ThreadDelete, async (thread) => {
    if (!thread.guild) return;
    await dispatchLog(thread.guild, {
      guildId: thread.guild.id,
      eventType: "thread_delete",
      action: "DELETE",
      category: "thread",
      title: "🗑️ Thread Silindi",
      channelId: thread.parentId,
      target: { id: thread.id, label: thread.name },
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
    await dispatchLog(after.guild, {
      guildId: after.guild.id,
      eventType: "thread_update",
      action: "UPDATE",
      category: "thread",
      title: "✏️ Thread Güncellendi",
      channelId: after.parentId,
      target: { id: after.id, label: after.name },
      beforeAfter: [
        ...(before.name !== after.name ? [{ label: "İsim", before: before.name, after: after.name }] : []),
        ...(before.archived !== after.archived
          ? [{ label: "Arşiv", before: String(before.archived), after: String(after.archived) }]
          : []),
        ...(before.locked !== after.locked
          ? [{ label: "Kilit", before: String(before.locked), after: String(after.locked) }]
          : []),
      ],
    });
  });

  client.on(Events.WebhooksUpdate, async (channel) => {
    if (!channel.guild) return;
    await dispatchLog(channel.guild, {
      guildId: channel.guild.id,
      eventType: "webhook_update",
      action: "UPDATE",
      category: "webhook",
      title: "🪝 Webhook Değişikliği",
      channelId: channel.id,
      fields: [{ name: "Not", value: "Webhook create/update/delete tespit edildi." }],
    });
  });

  client.on(Events.GuildIntegrationsUpdate, async (guild) => {
    await dispatchLog(guild, {
      guildId: guild.id,
      eventType: "integration_update",
      action: "UPDATE",
      category: "integration",
      title: "🔌 Entegrasyon Güncellendi",
      fields: [{ name: "Sunucu", value: `${guild.name} (\`${guild.id}\`)` }],
    });
  });

  client.on(Events.AutoModerationRuleCreate, async (rule) => {
    await dispatchLog(rule.guild, {
      guildId: rule.guild.id,
      eventType: "automod_rule_create",
      action: "CREATE",
      category: "automod",
      title: "🤖 AutoMod Kuralı Oluşturuldu",
      target: { id: rule.id, label: rule.name },
    });
  });

  client.on(Events.AutoModerationRuleUpdate, async (before, after) => {
    if (!before) return;
    if (before.name === after.name && before.enabled === after.enabled) return;
    await dispatchLog(after.guild, {
      guildId: after.guild.id,
      eventType: "automod_rule_update",
      action: "UPDATE",
      category: "automod",
      title: "🤖 AutoMod Kuralı Güncellendi",
      target: { id: after.id, label: after.name },
      beforeAfter: [
        ...(before.name !== after.name ? [{ label: "Kural Adı", before: before.name, after: after.name }] : []),
        ...(before.enabled !== after.enabled
          ? [{ label: "Aktif", before: String(before.enabled), after: String(after.enabled) }]
          : []),
      ],
    });
  });

  client.on(Events.AutoModerationRuleDelete, async (rule) => {
    await dispatchLog(rule.guild, {
      guildId: rule.guild.id,
      eventType: "automod_rule_delete",
      action: "DELETE",
      category: "automod",
      title: "🤖 AutoMod Kuralı Silindi",
      target: { id: rule.id, label: rule.name },
    });
  });

  client.on(Events.AutoModerationActionExecution, async (execution) => {
    const guild = execution.guild;
    if (!guild) return;
    await dispatchLog(guild, {
      guildId: guild.id,
      eventType: "automod_trigger",
      action: "MODERATION",
      category: "automod",
      title: "🤖 AutoMod Tetiklendi",
      target: { id: execution.userId, label: "Kullanıcı", mention: `<@${execution.userId}>` },
      channelId: execution.channelId ?? null,
      fields: [
        { name: "Kural", value: `\`${execution.ruleId}\`` },
        { name: "Aksiyon", value: `\`${execution.action.type}\`` },
        { name: "İçerik", value: slice(execution.content ?? "Yok", 1000) },
      ],
    });
  });
}

