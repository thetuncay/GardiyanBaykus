import { EmbedBuilder, type ColorResolvable } from "discord.js";

export const COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  neutral: 0x2b2d31,
  brandIndigo: 0x3a3f7a,
} as const satisfies Record<string, number>;

export type EmbedKind = "success" | "error" | "warning" | "info" | "neutral" | "brand";

export type Subsystem = "bilgelik" | "moderasyon" | "ses";

export const SUBSYSTEM_FOOTERS: Record<Subsystem, string> = {
  bilgelik: "BaykuşBot • Bilgelik Sistemi",
  moderasyon: "BaykuşBot • Moderasyon Sistemi",
  ses: "BaykuşBot • Ses Odası Sistemi",
};

function colorForKind(kind: EmbedKind): ColorResolvable {
  switch (kind) {
    case "success":
      return COLORS.success as ColorResolvable;
    case "error":
      return COLORS.error as ColorResolvable;
    case "warning":
      return COLORS.warning as ColorResolvable;
    case "info":
      return COLORS.info as ColorResolvable;
    case "brand":
      return COLORS.brandIndigo as ColorResolvable;
    case "neutral":
      return COLORS.neutral as ColorResolvable;
  }
}

export function buildStandardEmbed(options: {
  kind: EmbedKind;
  subsystem: Subsystem;
  title: string;
  description: string;
  timestampAt?: Date;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setColor(colorForKind(options.kind))
    .setFooter({ text: SUBSYSTEM_FOOTERS[options.subsystem] });

  embed.setTimestamp(options.timestampAt ?? new Date());
  return embed;
}

export function successEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "success" });
}

export function errorEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "error" });
}

export function warningEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "warning" });
}

export function infoEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "info" });
}

export function neutralEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "neutral" });
}

export function brandEmbed(options: Omit<Parameters<typeof buildStandardEmbed>[0], "kind">): EmbedBuilder {
  return buildStandardEmbed({ ...options, kind: "brand" });
}

export function ensureEmbedStandard(options: {
  embed: EmbedBuilder;
  subsystem: Subsystem;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackKind?: EmbedKind;
}): EmbedBuilder {
  const json = options.embed.toJSON();

  if (!json.title) options.embed.setTitle(options.fallbackTitle);
  if (!json.description) options.embed.setDescription(options.fallbackDescription);
  if (json.color == null) {
    options.embed.setColor(colorForKind(options.fallbackKind ?? "neutral"));
  }

  options.embed.setFooter({ text: SUBSYSTEM_FOOTERS[options.subsystem] });
  options.embed.setTimestamp();
  return options.embed;
}
