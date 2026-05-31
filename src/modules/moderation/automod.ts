import type { Message } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "../../services/guildSettingsCache.js";
import { slidingWindowHit } from "../../services/rateLimiter.js";
import { resolveLogChannel } from "../logging/core/logChannelManager.js";
import { createModCase, sendModLog } from "./service.js";
import type { TextChannel } from "discord.js";

const URL_RE =
  /https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord(app)?\.com\/invite\/[^\s]+/gi;

export async function runAutomod(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const guildId = message.guild.id;
  const cfg = await getGuildConfig(guildId);
  if (!cfg?.modules?.moderation) return false;

  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return false;

  const ignoredCh = cfg.automodIgnoredChannels ?? [];
  const ignoredRoles = cfg.automodIgnoredRoles ?? [];
  if (ignoredCh.includes(message.channelId)) return false;
  if (member.roles.cache.some((r) => ignoredRoles.includes(r.id))) return false;

  const mod = cfg.moderation;
  if (mod?.antiSpam) {
    const bucket = `spam:${guildId}:${message.author.id}`;
    const { allowed, count } = await slidingWindowHit(
      bucket,
      mod.spamThreshold ?? 6,
      mod.spamWindowSec ?? 8,
    );
    if (!allowed) {
      await message.delete().catch(() => null);
      const ch = await resolveLogChannel(message.guild, "moderation");
      if (ch) {
        if (ch.isTextBased()) {
          const { caseId } = await createModCase({
            guildId,
            action: "WARN",
            targetId: message.author.id,
            moderatorId: message.client.user.id,
            reason: "Otomatik: spam",
            metadata: { count },
          });
          await sendModLog(ch as TextChannel, {
            caseId,
            action: "AUTOMOD_SPAM",
            targetTag: message.author.tag,
            targetId: message.author.id,
            moderatorTag: message.client.user.tag,
            reason: `Mesaj silindi — spam (${count} mesaj / pencere)`,
          });
        }
      }
      return true;
    }
  }

  if (mod?.antiLink) {
    const text = message.content;
    if (URL_RE.test(text)) {
      URL_RE.lastIndex = 0;
      const allow = new Set(
        (mod.linkAllowlist ?? []).map((d) => d.toLowerCase().replace(/^https?:\/\//, "")),
      );
      const matches = text.match(URL_RE) ?? [];
      let blocked = false;
      for (const m of matches) {
        try {
          const host = new URL(m.startsWith("http") ? m : `https://${m}`).hostname.toLowerCase();
          if (![...allow].some((a) => host === a || host.endsWith(`.${a}`))) {
            blocked = true;
            break;
          }
        } catch {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        await message.delete().catch(() => null);
        return true;
      }
    }
  }

  return false;
}
