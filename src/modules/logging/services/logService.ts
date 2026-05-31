import {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
  PermissionFlagsBits,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildBasedChannel,
  type GuildMember,
  type Invite,
  type PartialUser,
  type TextBasedChannel,
  type User,
} from "discord.js";
import { LogConfigModel } from "../../../database/models/LogConfig.js";
import { getRedis } from "../../../services/redis.js";
import { redisKeys } from "../../../config/redisKeys.js";
import { INVITE_CACHE_LRU_MAX } from "../../../config/constants.js";
import { LOG_CATEGORY_NAME, LOG_CHANNEL_DEFINITIONS, type LogChannelKey } from "../types.js";
import { getCachedLogConfig, invalidateLogConfigCache } from "../../../services/logConfigCache.js";
import { shouldLogEventWithAutoRoles } from "./logFiltering.js";
import { ensureEmbedStandard } from "../../../utils/embeds.js";
import { LruCache } from "../../../utils/lruCache.js";

type InviteSnapshot = Record<string, number>;

export class LogService {
  private static inviteCache = new LruCache<string, InviteSnapshot>(INVITE_CACHE_LRU_MAX);
  private static kickDedupe = new Set<string>();

  static async ensureSetup(guild: Guild): Promise<Record<LogChannelKey, string | null>> {
    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    const category = await this.ensureCategory(guild);
    const channelMap: Record<LogChannelKey, string | null> = {
      memberLogs: null,
      messageLogs: null,
      moderationLogs: null,
      voiceLogs: null,
      roleLogs: null,
      channelLogs: null,
      serverLogs: null,
      inviteLogs: null,
      emojiStickerLogs: null,
    };

    for (const spec of LOG_CHANNEL_DEFINITIONS) {
      const existing = guild.channels.cache.find(
        (ch) =>
          ch.type === ChannelType.GuildText &&
          ch.name === spec.name &&
          (ch.parentId === category?.id || ch.parent?.name === LOG_CATEGORY_NAME),
      );
      if (existing?.id) {
        channelMap[spec.key] = existing.id;
        continue;
      }
      const created = await guild.channels.create({
        name: spec.name,
        type: ChannelType.GuildText,
        parent: category?.id,
        topic: spec.description,
        reason: "Automatic logging setup",
      });
      if (me) {
        await created.permissionOverwrites.edit(me.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }
      channelMap[spec.key] = created.id;
    }

    await LogConfigModel.updateOne(
      { guildId: guild.id },
      {
        guildId: guild.id,
        $set: {
          categoryId: category?.id ?? null,
          channels: {
            ...channelMap,
            modLogs: channelMap.moderationLogs,
            emojiLogs: channelMap.emojiStickerLogs,
          },
        },
      },
      { upsert: true },
    );
    invalidateLogConfigCache(guild.id);
    return channelMap;
  }

  static async sendLog(
    guild: Guild,
    key: LogChannelKey,
    embed: EmbedBuilder,
    filter?: {
      eventType: string;
      channelId?: string | null;
      user?: User | PartialUser | null;
      memberRoleIds?: string[];
    },
  ): Promise<void> {
    await this.sendLogs(guild, key, [embed], filter);
  }

  static async sendLogs(
    guild: Guild,
    key: LogChannelKey,
    embeds: EmbedBuilder[],
    filter?: {
      eventType: string;
      channelId?: string | null;
      user?: User | PartialUser | null;
      memberRoleIds?: string[];
    },
  ): Promise<void> {
    if (filter) {
      const ok = await shouldLogEventWithAutoRoles({
        guild,
        eventType: filter.eventType,
        channelId: filter.channelId,
        user: filter.user,
        memberRoleIds: filter.memberRoleIds,
      });
      if (!ok) return;
    }

    const cfg = await getCachedLogConfig(guild.id);
    const targetId = cfg?.channels?.[key] ?? null;
    if (!targetId) return;
    const channel = await guild.channels.fetch(targetId).catch(() => null);
    if (!channel?.isTextBased()) return;
    if (!this.isSendableTextChannel(channel)) return;
    for (const embed of embeds) {
      const json = embed.toJSON();
      ensureEmbedStandard({
        embed,
        subsystem: "moderasyon",
        fallbackTitle: (json.title as string) ?? "🦉 Log",
        fallbackDescription: (json.description as string) ?? "Kayıt",
        fallbackKind: "info",
      });
      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  static createBaseEmbed(
    title: string,
    color: number,
    actor?: User | null,
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
    if (actor) {
      embed.setThumbnail(actor.displayAvatarURL()).setFooter({
        text: `${actor.tag} (${actor.id})`,
      });
    }
    return embed;
  }

  static formatUser(user: User): string {
    return `${user} (\`${user.tag}\`) • \`${user.id}\``;
  }

  static formatActor(user: User | PartialUser): string {
    if ("tag" in user && user.tag) return `${user} (\`${user.tag}\`) • \`${user.id}\``;
    return `<@${user.id}> • \`${user.id}\``;
  }

  static slice(value: string | null | undefined, max = 1000): string {
    if (!value) return "N/A";
    return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
  }

  static chunkText(value: string, size = 1000): string[] {
    if (!value) return ["N/A"];
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }
    return chunks.length ? chunks : ["N/A"];
  }

  static extractLinks(content: string): string[] {
    const matches = content.match(/https?:\/\/[^\s)]+/g) ?? [];
    return [...new Set(matches)];
  }

  static formatRoleSnapshot(member: GuildMember | null): string {
    if (!member) return "Unknown";
    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => `${role} (\`${role.id}\`)`);
    return roles.length ? this.slice(roles.join("\n"), 1024) : "No roles";
  }

  static permissionDiff(before: bigint, after: bigint): { added: string[]; removed: string[] } {
    const beforePerms = new Set(new PermissionsBitField(before).toArray());
    const afterPerms = new Set(new PermissionsBitField(after).toArray());
    const added = [...afterPerms].filter((perm) => !beforePerms.has(perm));
    const removed = [...beforePerms].filter((perm) => !afterPerms.has(perm));
    return { added, removed };
  }

  static async resolveMessageDeleteExecutor(
    guild: Guild,
    authorId: string,
    channelId: string,
  ): Promise<string> {
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 6 });
      const entry = logs.entries.find((item) => {
        if (item.targetId !== authorId) return false;
        const extra = item.extra as { channel?: { id?: string } } | null;
        return extra?.channel?.id === channelId || !extra?.channel?.id;
      });
      if (!entry?.executor) return "Unknown (possibly self-delete)";
      return this.formatActor(entry.executor);
    } catch {
      return "Unknown (possibly self-delete)";
    }
  }

  static async fetchRelevantAuditEntry<T extends AuditLogEvent>(
    guild: Guild,
    type: T,
    targetId: string,
    maxAgeMs = 10_000,
  ): Promise<GuildAuditLogsEntry<T> | null> {
    const logs = await guild.fetchAuditLogs({ type, limit: 6 }).catch(() => null);
    if (!logs) return null;
    const now = Date.now();
    const entry = logs.entries.find((item) => {
      if (item.targetId !== targetId) return false;
      if (!item.createdTimestamp) return false;
      return now - item.createdTimestamp <= maxAgeMs;
    });
    return (entry as GuildAuditLogsEntry<T> | undefined) ?? null;
  }

  static shouldSkipKickLog(guildId: string, userId: string): boolean {
    const key = `${guildId}:${userId}`;
    if (this.kickDedupe.has(key)) return true;
    this.kickDedupe.add(key);
    setTimeout(() => this.kickDedupe.delete(key), 7_500);
    return false;
  }

  static async cacheGuildInvites(guild: Guild): Promise<void> {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    const snapshot: InviteSnapshot = {};
    for (const invite of invites.values()) snapshot[invite.code] = invite.uses ?? 0;
    this.inviteCache.set(guild.id, snapshot);
    await this.writeInviteSnapshotToRedis(guild.id, snapshot);
  }

  static async updateInviteSnapshotFromInvite(invite: Invite): Promise<void> {
    const snapshot = this.inviteCache.get(invite.guild!.id) ?? {};
    snapshot[invite.code] = invite.uses ?? 0;
    this.inviteCache.set(invite.guild!.id, snapshot);
    await this.writeInviteSnapshotToRedis(invite.guild!.id, snapshot);
  }

  static async deleteInviteFromSnapshot(guildId: string, code: string): Promise<void> {
    const snapshot = this.inviteCache.get(guildId) ?? {};
    delete snapshot[code];
    this.inviteCache.set(guildId, snapshot);
    await this.writeInviteSnapshotToRedis(guildId, snapshot);
  }

  static async findUsedInvite(guild: Guild): Promise<Invite | null> {
    const before = await this.getInviteSnapshot(guild.id);
    const current = await guild.invites.fetch().catch(() => null);
    if (!current) return null;

    let used: Invite | null = null;
    for (const invite of current.values()) {
      const prevUses = before[invite.code] ?? 0;
      const nowUses = invite.uses ?? 0;
      if (nowUses > prevUses) {
        used = invite;
        break;
      }
    }

    const updated: InviteSnapshot = {};
    for (const invite of current.values()) updated[invite.code] = invite.uses ?? 0;
    this.inviteCache.set(guild.id, updated);
    await this.writeInviteSnapshotToRedis(guild.id, updated);
    return used;
  }

  private static async ensureCategory(guild: Guild): Promise<GuildBasedChannel | null> {
    const existing = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildCategory && ch.name === LOG_CATEGORY_NAME,
    );
    if (existing) return existing;
    return guild.channels.create({
      name: LOG_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.SendMessages],
        },
      ],
      reason: "Automatic logging setup",
    });
  }

  private static isSendableTextChannel(channel: TextBasedChannel): boolean {
    return "send" in channel && typeof channel.send === "function";
  }

  private static async getInviteSnapshot(guildId: string): Promise<InviteSnapshot> {
    const hit = this.inviteCache.get(guildId);
    if (hit) return hit;
    const fromRedis = await this.readInviteSnapshotFromRedis(guildId);
    this.inviteCache.set(guildId, fromRedis);
    return fromRedis;
  }

  private static async writeInviteSnapshotToRedis(
    guildId: string,
    snapshot: InviteSnapshot,
  ): Promise<void> {
    try {
      const redis = getRedis();
      await redis.set(redisKeys.inviteSnapshot(guildId), JSON.stringify(snapshot), "EX", 60 * 60 * 6);
    } catch {
      /* Redis isteğe bağlı */
    }
  }

  private static async readInviteSnapshotFromRedis(guildId: string): Promise<InviteSnapshot> {
    try {
      const redis = getRedis();
      const raw = await redis.get(redisKeys.inviteSnapshot(guildId));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as InviteSnapshot;
    } catch {
      return {};
    }
  }
}
