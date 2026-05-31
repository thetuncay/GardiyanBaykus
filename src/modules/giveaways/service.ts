import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ColorResolvable,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type TextChannel,
} from "discord.js";
import { randomInt } from "node:crypto";
import type { Client } from "discord.js";
import { GiveawayModel } from "../../database/models/Giveaway.js";
import { getRedis } from "../../services/redis.js";
import { redisKeys } from "../../config/redisKeys.js";
import { ensureEmbedStandard } from "../../utils/embeds.js";

function entrantsKey(messageId: string): string {
  return redisKeys.giveawayEntrants(messageId);
}

export function giveawayEnterCustomId(messageId: string): string {
  return `gw:enter:${messageId}`;
}

export async function addGiveawayEntrant(
  messageId: string,
  userId: string,
): Promise<boolean> {
  const g = await GiveawayModel.findOne({ messageId, ended: false });
  if (!g) return false;
  await getRedis().sadd(entrantsKey(messageId), userId);
  return true;
}

export async function pickRandomWinners(
  messageId: string,
  count: number,
): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers(entrantsKey(messageId));
  if (members.length === 0) return [];
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function endGiveawayMessage(msg: Message): Promise<void> {
  const doc = await GiveawayModel.findOne({ messageId: msg.id });
  if (!doc || doc.ended) return;
  const winners = await pickRandomWinners(msg.id, doc.winnerCount);
  await GiveawayModel.updateOne(
    { _id: doc._id },
    { $set: { ended: true, winnersUserIds: winners } },
  );
  const base = msg.embeds[0];
  const embed = base ? EmbedBuilder.from(base) : new EmbedBuilder();
  embed
    .setTitle("🦉 Çekiliş bitti")
    .setColor(0x57f287 as ColorResolvable)
    .setDescription(
      winners.length
        ? `Kazananlar: ${winners.map((id) => `<@${id}>`).join(", ")}`
        : "Katılımcı olmadı.",
    );
  ensureEmbedStandard({
    embed,
    subsystem: "bilgelik",
    fallbackTitle: "🦉 Çekiliş bitti",
    fallbackDescription: "Çekiliş sonucu güncellendi.",
    fallbackKind: "success",
  });
  await msg.edit({ embeds: [embed], components: [] });
}

export async function postGiveaway(options: {
  channel: GuildTextBasedChannel;
  prize: string;
  endsAt: Date;
  winnerCount: number;
  requiredRoleIds: string[];
  createdBy: string;
}): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🦉 BilgeBaykuş Çekilişi")
    .setDescription(
      `**Ödül:** ${options.prize}\n` +
        `**Bitiş:** <t:${Math.floor(options.endsAt.getTime() / 1000)}:R>\n` +
        (options.requiredRoleIds.length
          ? `**Gerekli roller:** ${options.requiredRoleIds.map((id) => `<@&${id}>`).join(" ")}\n`
          : "") +
        `Katılmak için **Katıl** düğmesine bas.`,
    )
    .setColor(0xfee75c as ColorResolvable);

  ensureEmbedStandard({
    embed,
    subsystem: "bilgelik",
    fallbackTitle: "🦉 BilgeBaykuş Çekilişi",
    fallbackDescription: "Yeni çekiliş duyurusu.",
    fallbackKind: "warning",
  });
  const msg = await options.channel.send({ embeds: [embed] });
  await GiveawayModel.create({
    guildId: options.channel.guildId,
    channelId: options.channel.id,
    messageId: msg.id,
    prize: options.prize,
    endsAt: options.endsAt,
    winnerCount: options.winnerCount,
    requiredRoleIds: options.requiredRoleIds,
    ended: false,
    createdBy: options.createdBy,
  });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(giveawayEnterCustomId(msg.id))
      .setLabel("🦉 Katıl")
      .setStyle(ButtonStyle.Primary),
  );
  await msg.edit({ components: [row] });
}

export async function sweepDueGiveaways(client: Client): Promise<void> {
  const now = new Date();
  const due = await GiveawayModel.find({ ended: false, endsAt: { $lte: now } }).limit(50);
  for (const g of due) {
    try {
      const ch = (await client.channels.fetch(g.channelId).catch(() => null)) as
        | TextChannel
        | null;
      if (!ch?.isTextBased()) continue;
      const msg = await ch.messages.fetch(g.messageId).catch(() => null);
      if (msg) await endGiveawayMessage(msg);
    } catch {
      /* ignore */
    }
  }
}

export function memberMeetsGiveawayRoles(
  member: GuildMember,
  requiredRoleIds: string[],
): boolean {
  if (requiredRoleIds.length === 0) return true;
  return requiredRoleIds.every((id) => member.roles.cache.has(id));
}

export async function rerollGiveaway(
  message: Message,
  winnerCount: number,
): Promise<string[]> {
  const doc = await GiveawayModel.findOne({ messageId: message.id, ended: true });
  if (!doc) return [];
  const winners = await pickRandomWinners(message.id, winnerCount);
  await GiveawayModel.updateOne({ _id: doc._id }, { $set: { winnersUserIds: winners } });
  const base = message.embeds[0];
  const embed = base ? EmbedBuilder.from(base) : new EmbedBuilder();
  embed
    .setTitle("🦉 Çekiliş bitti")
    .setDescription(
      winners.length
        ? `Yeniden çekilen kazananlar: ${winners.map((id) => `<@${id}>`).join(", ")}`
        : "Yeniden çekilecek katılımcı yok.",
    )
    .setColor(0x57f287 as ColorResolvable);
  ensureEmbedStandard({
    embed,
    subsystem: "bilgelik",
    fallbackTitle: "🦉 Çekiliş bitti",
    fallbackDescription: "Yeniden çekim sonucu.",
    fallbackKind: "success",
  });
  await message.edit({ embeds: [embed] });
  return winners;
}
