import type { Guild } from "discord.js";
import { getCachedLogConfig } from "../../../services/logConfigCache.js";
import type { LogCategory } from "./logCategories.js";

export async function shouldLogByConfig(params: {
  guild: Guild;
  category: LogCategory;
  eventType: string;
  channelId?: string | null;
  actorId?: string | null;
  actorIsBot?: boolean;
  memberRoleIds?: string[];
}): Promise<boolean> {
  const cfg = await getCachedLogConfig(params.guild.id);
  if (!cfg) return true;

  if (cfg.disabledEvents.includes(params.eventType)) return false;
  if (cfg.disabledCategories.includes(params.category)) return false;
  if (cfg.categories[params.category]?.enabled === false) return false;

  if (params.channelId && cfg.ignoredChannels.includes(params.channelId)) return false;
  if (params.actorIsBot && cfg.ignoreBots) return false;

  if (params.memberRoleIds?.length && cfg.ignoredRoles.length) {
    if (params.memberRoleIds.some((roleId) => cfg.ignoredRoles.includes(roleId))) {
      return false;
    }
  }
  return true;
}
