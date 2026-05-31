import { EmbedBuilder } from "discord.js";
import { LogService } from "../services/logService.js";

export function addBeforeAfter(
  embed: EmbedBuilder,
  beforeValue: string | null | undefined,
  afterValue: string | null | undefined,
): EmbedBuilder {
  embed.addFields(
    { name: "Before", value: LogService.slice(beforeValue ?? "N/A"), inline: false },
    { name: "After", value: LogService.slice(afterValue ?? "N/A"), inline: false },
  );
  return embed;
}

export function listOrFallback(values: string[], fallback = "N/A"): string {
  if (!values.length) return fallback;
  return LogService.slice(values.join(", "), 1024);
}

export function unixTime(ms: number | Date): string {
  const millis = typeof ms === "number" ? ms : ms.getTime();
  return `<t:${Math.floor(millis / 1000)}:F> (<t:${Math.floor(millis / 1000)}:R>)`;
}
