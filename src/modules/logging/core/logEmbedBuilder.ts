import { EmbedBuilder } from "discord.js";
import type { LogDispatchPayload } from "./logCategories.js";
import { LOG_CATEGORY_META } from "./logCategories.js";
import { ensureEmbedStandard } from "../../../utils/embeds.js";
import { formatActor, slice, unixTime } from "./logFormatters.js";

function fallbackColor(payload: LogDispatchPayload): number {
  return payload.color ?? LOG_CATEGORY_META[payload.category].defaultColor;
}

function actionLabel(action: LogDispatchPayload["action"]): string {
  switch (action) {
    case "CREATE":
      return "Oluşturuldu";
    case "UPDATE":
      return "Güncellendi";
    case "DELETE":
      return "Silindi";
    case "MODERATION":
      return "Moderasyon";
    default:
      return "Bilgi";
  }
}

export function buildLogEmbed(payload: LogDispatchPayload): EmbedBuilder {
  const meta = LOG_CATEGORY_META[payload.category];
  const title = payload.title || `${meta.emoji} ${meta.title} • ${actionLabel(payload.action)}`;

  const embed = new EmbedBuilder().setColor(fallbackColor(payload)).setTitle(title);
  if (payload.description) {
    embed.setDescription(slice(payload.description, 4096));
  }

  if (payload.actor) {
    embed.setThumbnail(payload.actor.avatarUrl ?? null);
    embed.addFields({
      name: "Aktör",
      value: formatActor({
        id: payload.actor.id,
        tag: payload.actor.tag,
        mention: payload.actor.mention,
      }),
      inline: false,
    });
  }

  if (payload.target && (payload.target.id || payload.target.label)) {
    const mention = payload.target.mention ? `${payload.target.mention} • ` : "";
    const label = payload.target.label ? `${payload.target.label} ` : "";
    const id = payload.target.id ? `(\`${payload.target.id}\`)` : "";
    embed.addFields({
      name: "Hedef",
      value: `${mention}${label}${id}`.trim() || "Bilinmiyor",
      inline: false,
    });
  }

  if (payload.channelId) {
    embed.addFields({
      name: "Kanal",
      value: `<#${payload.channelId}> (\`${payload.channelId}\`)`,
      inline: true,
    });
  }

  if (payload.audit) {
    const exec =
      payload.audit.executorId != null
        ? `${payload.audit.executorTag ? `\`${payload.audit.executorTag}\` • ` : ""}<@${payload.audit.executorId}> (\`${payload.audit.executorId}\`)`
        : "Bilinmiyor";
    const confidenceLabel =
      payload.audit.confidence === "HIGH"
        ? "Kesin"
        : payload.audit.confidence === "LOW"
          ? "Tahmini"
          : "Yok";
    embed.addFields(
      { name: "Denetim Kaydı Aktörü", value: exec, inline: false },
      { name: "Doğruluk", value: confidenceLabel, inline: true },
      {
        name: "Sebep",
        value: slice(payload.audit.reason ?? "Sebep yok", 1024),
        inline: true,
      },
    );
    if (payload.audit.createdTimestamp) {
      embed.addFields({
        name: "Denetim Kaydı Zamanı",
        value: unixTime(payload.audit.createdTimestamp),
        inline: false,
      });
    }
  }

  for (const row of payload.beforeAfter ?? []) {
    embed.addFields({
      name: `${row.label} (Önce → Sonra)`,
      value: `\`\`\`diff\n- ${slice(row.before, 400)}\n+ ${slice(row.after, 400)}\n\`\`\``,
      inline: false,
    });
  }

  for (const field of payload.fields ?? []) {
    embed.addFields({
      name: slice(field.name, 256),
      value: slice(field.value, 1024),
      inline: field.inline ?? false,
    });
  }

  if (payload.links?.length) {
    embed.addFields({
      name: "Bağlantılar",
      value: slice(payload.links.join("\n"), 1024),
      inline: false,
    });
  }

  ensureEmbedStandard({
    embed,
    subsystem: "moderasyon",
    fallbackTitle: title,
    fallbackDescription: payload.description ?? `${meta.title} kaydı`,
    fallbackKind: "info",
  });
  return embed;
}
