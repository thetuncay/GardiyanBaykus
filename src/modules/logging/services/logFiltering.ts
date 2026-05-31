import type { Guild, User, PartialUser } from "discord.js";
import type { LogConfigDoc } from "../../../database/models/LogConfig.js";
import { getCachedLogConfig } from "../../../services/logConfigCache.js";

export type LogEventType =
  | "message_delete"
  | "message_edit"
  | "ghost_ping"
  | "member_join"
  | "member_leave"
  | "member_update"
  | "voice_update"
  | "channel_update"
  | "role_update"
  | "server_update"
  | "moderation"
  | "invite"
  | "emoji"
  | "bulk_delete"
  | string;

const defaultConfig = {
  disabledEvents: [] as string[],
  ignoredChannels: [] as string[],
  ignoredRoles: [] as string[],
  ignoreBots: true,
};

export async function getLogConfigOrDefault(guildId: string): Promise<LogConfigDoc | typeof defaultConfig> {
  const doc = await getCachedLogConfig(guildId);
  if (!doc) return defaultConfig;
  return doc;
}

export function extractSnowflake(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/\d{15,19}/);
  return m ? m[0] : null;
}

export async function shouldLogEvent(params: {
  guild: Guild;
  eventType: LogEventType;
  channelId?: string | null;
  user?: User | PartialUser | null;
  memberRoleIds?: string[];
}): Promise<boolean> {
  const cfg = await getLogConfigOrDefault(params.guild.id);
  const disabledEvents =
    "disabledEvents" in cfg ? cfg.disabledEvents : defaultConfig.disabledEvents;
  const ignoredChannels =
    "ignoredChannels" in cfg ? cfg.ignoredChannels : defaultConfig.ignoredChannels;
  const ignoredRoles =
    "ignoredRoles" in cfg ? cfg.ignoredRoles : defaultConfig.ignoredRoles;
  const ignoreBots =
    "ignoreBots" in cfg ? cfg.ignoreBots : defaultConfig.ignoreBots;

  if (disabledEvents.includes(params.eventType)) return false;
  if (params.channelId && ignoredChannels.includes(params.channelId)) return false;
  if (params.user?.bot && ignoreBots) return false;

  const roleIds = params.memberRoleIds;
  if (roleIds && roleIds.length > 0 && ignoredRoles.length > 0) {
    if (roleIds.some((rid) => ignoredRoles.includes(rid))) return false;
  }

  return true;
}

export async function getMemberRoleIds(guild: Guild, userId: string): Promise<string[]> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return [];
  return [...member.roles.cache.keys()];
}

/** ignoredRoles tanımlıysa üye rollerini çeker; aksi halde gereksiz fetch yok. */
export async function shouldLogEventWithAutoRoles(params: {
  guild: Guild;
  eventType: LogEventType;
  channelId?: string | null;
  user?: User | PartialUser | null;
  memberRoleIds?: string[];
}): Promise<boolean> {
  let memberRoleIds = params.memberRoleIds;
  if (memberRoleIds === undefined && params.user && !params.user.bot) {
    const cfg = await getLogConfigOrDefault(params.guild.id);
    const ignored =
      "ignoredRoles" in cfg && Array.isArray(cfg.ignoredRoles) ? cfg.ignoredRoles : [];
    if (ignored.length > 0) {
      memberRoleIds = await getMemberRoleIds(params.guild, params.user.id);
    }
  }
  return shouldLogEvent({ ...params, memberRoleIds });
}
