import { EmbedBuilder, type ColorResolvable, type TextChannel } from "discord.js";
import { ModCaseModel } from "../../database/models/ModCase.js";
import { nextModCaseId } from "../../database/models/GuildCounter.js";
import { WarningModel } from "../../database/models/Warning.js";
import { UserStatsModel } from "../../database/models/UserStats.js";
import { getGuildConfig } from "../../services/guildSettingsCache.js";
import type { ModCaseDoc } from "../../database/models/ModCase.js";
import { ensureEmbedStandard } from "../../utils/embeds.js";

const actionTr: Record<string, string> = {
  BAN: "Yasaklama",
  KICK: "Atma",
  MUTE: "Susturma",
  WARN: "Uyarı",
  UNMUTE: "Susturma kaldırma",
  PURGE: "Toplu silme",
  AUTOMOD_SPAM: "Otomatik — spam",
};

export async function createModCase(input: {
  guildId: string;
  action: ModCaseDoc["action"];
  targetId: string;
  moderatorId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ caseId: number }> {
  const caseId = await nextModCaseId(input.guildId);
  await ModCaseModel.create({
    guildId: input.guildId,
    caseId,
    action: input.action,
    targetId: input.targetId,
    moderatorId: input.moderatorId,
    reason: input.reason ?? "",
    metadata: input.metadata ?? {},
  });
  return { caseId };
}

export async function sendModLog(
  channel: TextChannel,
  payload: {
    caseId: number;
    action: string;
    targetTag: string;
    targetId: string;
    moderatorTag: string;
    reason: string;
  },
): Promise<void> {
  const label = actionTr[payload.action] ?? payload.action;
  const embed = new EmbedBuilder()
    .setTitle(`🦉 Vaka #${payload.caseId} — ${label}`)
    .setDescription("Wise Owl moderasyon kaydı.")
    .setColor(0xed4245 as ColorResolvable)
    .addFields(
      { name: "Üye", value: `${payload.targetTag} (${payload.targetId})` },
      { name: "Moderatör", value: payload.moderatorTag },
      { name: "Sebep", value: payload.reason || "—" },
    );
  ensureEmbedStandard({
    embed,
    subsystem: "moderasyon",
    fallbackTitle: `🦉 Vaka #${payload.caseId} — ${label}`,
    fallbackDescription: "Wise Owl moderasyon kaydı.",
    fallbackKind: "error",
  });
  await channel.send({ embeds: [embed] });
}

export async function addWarn(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string,
): Promise<{ warnCount: number }> {
  await WarningModel.create({
    guildId,
    userId,
    moderatorId,
    reason,
    active: true,
  });
  const stats = await UserStatsModel.findOneAndUpdate(
    { guildId, userId },
    { $inc: { warnCount: 1 }, $setOnInsert: { guildId, userId } },
    { new: true, upsert: true },
  );
  return { warnCount: stats?.warnCount ?? 1 };
}

export async function applyProgressiveTimeoutIfNeeded(options: {
  guildId: string;
  userId: string;
  guild: import("discord.js").Guild;
}): Promise<string | null> {
  const cfg = await getGuildConfig(options.guildId);
  if (!cfg?.moderation) return null;
  const threshold = cfg.moderation.progressiveWarnsToTimeout ?? 3;
  const minutes = cfg.moderation.progressiveTimeoutMinutes ?? 10;
  const stats = await UserStatsModel.findOne({
    guildId: options.guildId,
    userId: options.userId,
  });
  const warns = stats?.warnCount ?? 0;
  if (warns > 0 && warns % threshold === 0) {
    const member = await options.guild.members.fetch(options.userId).catch(() => null);
    if (member?.moderatable) {
      await member.timeout(
        minutes * 60_000,
        `BilgeBaykuş: kademeli ceza (uyarı eşiği, ${warns} uyarı)`,
      );
      return `🦉 **Kademeli ceza:** ${minutes} dakika zaman aşımı uygulandı (toplam uyarı: ${warns}).`;
    }
  }
  return null;
}
