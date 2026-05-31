import { AuditLogEvent, type Guild } from "discord.js";
import type { LogDispatchPayload } from "./logCategories.js";
import { buildLogEmbed } from "./logEmbedBuilder.js";
import { shouldLogByConfig } from "./logFilter.js";
import { resolveAuditEntry } from "./auditResolver.js";
import { resolveLogChannelId } from "./logChannelManager.js";
import { enqueueLogSend } from "./logQueue.js";
import { createLogger } from "../../../services/logger.js";

const log = createLogger("log-service");
const dispatchDedupe = new Map<string, number>();
const DISPATCH_DEDUPE_MS = 1200;
let dedupeCleanupTick = 0;

type DispatchOptions = {
  memberRoleIds?: string[];
  includeAudit?: {
    type: AuditLogEvent;
    targetId?: string | null;
    channelIdHint?: string | null;
    maxAgeMs?: number;
  };
};

async function enrichAudit(
  guild: Guild,
  payload: LogDispatchPayload,
  includeAudit: DispatchOptions["includeAudit"],
): Promise<void> {
  if (!includeAudit) return;
  const { entry, confidence } = await resolveAuditEntry({
    guild,
    type: includeAudit.type,
    targetId: includeAudit.targetId ?? payload.target?.id ?? null,
    channelIdHint: includeAudit.channelIdHint ?? payload.channelId ?? null,
    maxAgeMs: includeAudit.maxAgeMs,
  });
  payload.audit = {
    confidence,
    executorId: entry?.executor?.id ?? null,
    executorTag: entry?.executor?.tag ?? null,
    reason: entry?.reason ?? null,
    createdTimestamp: entry?.createdTimestamp ?? null,
  };
}

export async function dispatchLog(
  guild: Guild,
  payload: LogDispatchPayload,
  options?: DispatchOptions,
): Promise<void> {
  try {
    const dedupeKey = `${guild.id}:${payload.category}:${payload.eventType}:${payload.action}:${payload.channelId ?? "-"}:${payload.target?.id ?? "-"}:${payload.actor?.id ?? "-"}`;
    const now = Date.now();
    const prev = dispatchDedupe.get(dedupeKey) ?? 0;
    if (now - prev < DISPATCH_DEDUPE_MS) return;
    dispatchDedupe.set(dedupeKey, now);
    dedupeCleanupTick += 1;
    if (dedupeCleanupTick % 500 === 0) {
      for (const [key, ts] of dispatchDedupe) {
        if (now - ts > DISPATCH_DEDUPE_MS * 3) dispatchDedupe.delete(key);
      }
    }

    const allow = await shouldLogByConfig({
      guild,
      category: payload.category,
      eventType: payload.eventType,
      channelId: payload.channelId,
      actorId: payload.actor?.id,
      actorIsBot: payload.actor?.isBot,
      memberRoleIds: options?.memberRoleIds,
    });
    if (!allow) return;

    await enrichAudit(guild, payload, options?.includeAudit);
    const channelId = await resolveLogChannelId(guild.id, payload.category);
    if (!channelId) return;

    const embed = buildLogEmbed(payload);
    await enqueueLogSend({ guild, channelId, embeds: [embed] });
  } catch (err) {
    log.warn("dispatchLog failed safely", {
      guildId: guild.id,
      eventType: payload.eventType,
      category: payload.category,
      err: String(err),
    });
  }
}

export async function dispatchLogBatch(
  guild: Guild,
  payloads: LogDispatchPayload[],
  options?: DispatchOptions,
): Promise<void> {
  if (!payloads.length) return;
  for (const payload of payloads) {
    await dispatchLog(guild, payload, options);
  }
}
