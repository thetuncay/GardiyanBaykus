import { AuditLogEvent, Events, type Client } from "discord.js";
import { dispatchLog } from "../core/logService.js";
import { formatRoleSnapshot, unixTime } from "../core/logFormatters.js";

export function registerMemberEvents(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    await dispatchLog(member.guild, {
      guildId: member.guild.id,
      eventType: "member_join",
      action: "CREATE",
      category: "member",
      title: member.user.bot ? "🤖 Bot Sunucuya Eklendi" : "👋 Üye Katıldı",
      actor: {
        id: member.user.id,
        tag: member.user.tag,
        mention: `${member.user}`,
        avatarUrl: member.user.displayAvatarURL(),
        isBot: member.user.bot,
      },
      target: { id: member.user.id, label: "Üye", mention: `${member.user}` },
      fields: [
        { name: "Hesap Açılış", value: unixTime(member.user.createdTimestamp), inline: false },
        { name: "Katılma", value: unixTime(Date.now()), inline: false },
        { name: "Sunucu Üye Sayısı", value: `\`${member.guild.memberCount}\``, inline: true },
      ],
    });
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.user) return;

    const { entry, confidence } = await (async () => {
      const result = await import("../core/auditResolver.js");
      return result.resolveAuditEntry({
        guild: member.guild,
        type: AuditLogEvent.MemberKick,
        targetId: member.id,
      });
    })();
    const isKick = Boolean(entry);

    await dispatchLog(
      member.guild,
      {
        guildId: member.guild.id,
        eventType: isKick ? "member_kick" : "member_leave",
        action: isKick ? "MODERATION" : "DELETE",
        category: isKick ? "moderation" : "member",
        title: isKick ? "🥾 Üye Atıldı" : "🚪 Üye Ayrıldı",
        actor: {
          id: member.user.id,
          tag: member.user.tag,
          mention: `${member.user}`,
          avatarUrl: member.user.displayAvatarURL(),
          isBot: member.user.bot,
        },
        target: { id: member.id, label: "Üye", mention: `${member.user}` },
        fields: [
          { name: "Roller", value: "roles" in member ? formatRoleSnapshot(member as any) : "Bilinmiyor", inline: false },
          {
            name: "Sunucuda Geçen Süre",
            value: member.joinedTimestamp ? unixTime(member.joinedTimestamp) : "Bilinmiyor",
            inline: false,
          },
        ],
        audit: {
          confidence,
          executorId: entry?.executor?.id ?? null,
          executorTag: entry?.executor?.tag ?? null,
          reason: entry?.reason ?? null,
          createdTimestamp: entry?.createdTimestamp ?? null,
        },
      },
      { memberRoleIds: [...member.roles.cache.keys()] },
    );
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    const beforeTimeout = before.communicationDisabledUntilTimestamp ?? 0;
    const afterTimeout = after.communicationDisabledUntilTimestamp ?? 0;
    const timeoutChanged = beforeTimeout !== afterTimeout;
    const nickChanged = before.nickname !== after.nickname;
    const avatarChanged = before.avatar !== after.avatar;
    const roleAdded = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
    const roleRemoved = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
    const boostedChanged = before.premiumSinceTimestamp !== after.premiumSinceTimestamp;

    if (!timeoutChanged && !nickChanged && !avatarChanged && !roleAdded.size && !roleRemoved.size && !boostedChanged) {
      return;
    }

    if (timeoutChanged) {
      await dispatchLog(
        after.guild,
        {
          guildId: after.guild.id,
          eventType: afterTimeout > Date.now() ? "member_timeout" : "member_timeout_remove",
          action: "MODERATION",
          category: "moderation",
          title: afterTimeout > Date.now() ? "⏳ Zaman Aşımı Uygulandı" : "✅ Zaman Aşımı Kaldırıldı",
          actor: {
            id: after.user.id,
            tag: after.user.tag,
            mention: `${after.user}`,
            avatarUrl: after.user.displayAvatarURL(),
            isBot: after.user.bot,
          },
          target: { id: after.id, label: "Üye", mention: `${after.user}` },
          fields: afterTimeout > Date.now()
            ? [{ name: "Bitiş", value: unixTime(afterTimeout), inline: false }]
            : [],
        },
        {
          includeAudit: {
            type: AuditLogEvent.MemberUpdate,
            targetId: after.id,
            maxAgeMs: 12_000,
          },
          memberRoleIds: [...after.roles.cache.keys()],
        },
      );
    }

    if (nickChanged || avatarChanged || roleAdded.size || roleRemoved.size || boostedChanged) {
      await dispatchLog(after.guild, {
        guildId: after.guild.id,
        eventType: "member_update",
        action: "UPDATE",
        category: "member",
        title: "🧍 Üye Güncellendi",
        actor: {
          id: after.user.id,
          tag: after.user.tag,
          mention: `${after.user}`,
          avatarUrl: after.user.displayAvatarURL(),
          isBot: after.user.bot,
        },
        target: { id: after.id, label: "Üye", mention: `${after.user}` },
        beforeAfter: [
          ...(nickChanged
            ? [{ label: "Takma Ad", before: before.nickname ?? "Yok", after: after.nickname ?? "Yok" }]
            : []),
          ...(boostedChanged
            ? [
                {
                  label: "Boost",
                  before: before.premiumSinceTimestamp ? "Aktif" : "Pasif",
                  after: after.premiumSinceTimestamp ? "Aktif" : "Pasif",
                },
              ]
            : []),
        ],
        fields: [
          ...(avatarChanged
            ? [
                {
                  name: "Avatar",
                  value: `Önce: ${before.displayAvatarURL()}\nSonra: ${after.displayAvatarURL()}`,
                  inline: false,
                },
              ]
            : []),
          ...(roleAdded.size
            ? [{ name: "Eklenen Roller", value: roleAdded.map((r) => `${r}`).join(", "), inline: false }]
            : []),
          ...(roleRemoved.size
            ? [{ name: "Çıkarılan Roller", value: roleRemoved.map((r) => `${r}`).join(", "), inline: false }]
            : []),
        ],
      });
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    await dispatchLog(
      ban.guild,
      {
        guildId: ban.guild.id,
        eventType: "member_ban",
        action: "MODERATION",
        category: "moderation",
        title: "🔨 Üye Yasaklandı",
        actor: {
          id: ban.user.id,
          tag: ban.user.tag,
          mention: `${ban.user}`,
          avatarUrl: ban.user.displayAvatarURL(),
          isBot: ban.user.bot,
        },
        target: { id: ban.user.id, label: "Hedef", mention: `${ban.user}` },
      },
      {
        includeAudit: {
          type: AuditLogEvent.MemberBanAdd,
          targetId: ban.user.id,
        },
      },
    );
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    await dispatchLog(
      ban.guild,
      {
        guildId: ban.guild.id,
        eventType: "member_unban",
        action: "MODERATION",
        category: "moderation",
        title: "🔓 Üye Yasağı Kaldırıldı",
        actor: {
          id: ban.user.id,
          tag: ban.user.tag,
          mention: `${ban.user}`,
          avatarUrl: ban.user.displayAvatarURL(),
          isBot: ban.user.bot,
        },
        target: { id: ban.user.id, label: "Hedef", mention: `${ban.user}` },
      },
      {
        includeAudit: {
          type: AuditLogEvent.MemberBanRemove,
          targetId: ban.user.id,
        },
      },
    );
  });

  client.on(Events.UserUpdate, async (before, after) => {
    const usernameChanged = before.username !== after.username;
    const avatarChanged = before.avatar !== after.avatar;
    const globalNameChanged = before.globalName !== after.globalName;
    if (!usernameChanged && !avatarChanged && !globalNameChanged) return;

    for (const guild of client.guilds.cache.values()) {
      const member = guild.members.cache.get(after.id) ?? (await guild.members.fetch(after.id).catch(() => null));
      if (!member) continue;

      await dispatchLog(guild, {
        guildId: guild.id,
        eventType: "user_profile_update",
        action: "UPDATE",
        category: "member",
        title: "🪪 Kullanıcı Profili Güncellendi",
        actor: {
          id: after.id,
          tag: after.tag,
          mention: `<@${after.id}>`,
          avatarUrl: after.displayAvatarURL(),
          isBot: after.bot,
        },
        target: { id: after.id, label: "Kullanıcı", mention: `<@${after.id}>` },
        beforeAfter: [
          ...(usernameChanged
            ? [{ label: "Kullanıcı Adı", before: before.username ?? "Yok", after: after.username ?? "Yok" }]
            : []),
          ...(globalNameChanged
            ? [{ label: "Global Ad", before: before.globalName ?? "Yok", after: after.globalName ?? "Yok" }]
            : []),
        ],
        fields: avatarChanged
          ? [{ name: "Avatar", value: `Önce: ${before.displayAvatarURL()}\nSonra: ${after.displayAvatarURL()}` }]
          : [],
      });
    }
  });
}

