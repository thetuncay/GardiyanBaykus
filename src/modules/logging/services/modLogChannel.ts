import { ChannelType, type Guild, type TextChannel } from "discord.js";
import { getCachedLogConfig } from "../../../services/logConfigCache.js";

export async function fetchModerationLogChannel(guild: Guild): Promise<TextChannel | null> {
  const cfg = await getCachedLogConfig(guild.id);
  const id = cfg?.channels?.moderationLogs ?? cfg?.channels?.modLogs ?? null;
  if (!id) return null;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return null;
  if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) return null;
  return ch as TextChannel;
}
