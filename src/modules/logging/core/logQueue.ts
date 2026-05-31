import { type EmbedBuilder, type Guild, type TextBasedChannel } from "discord.js";
import { createLogger } from "../../../services/logger.js";

const log = createLogger("log-queue");

type QueueJob = {
  guild: Guild;
  channelId: string;
  embeds: EmbedBuilder[];
};

const channelChains = new Map<string, Promise<void>>();
const pendingByChannel = new Map<
  string,
  { guild: Guild; channelId: string; embeds: EmbedBuilder[]; timer: ReturnType<typeof setTimeout> | null; waiters: Array<() => void> }
>();
const AGGREGATION_WINDOW_MS = 180;

function isSendable(channel: TextBasedChannel): channel is TextBasedChannel & {
  send: (payload: { embeds: EmbedBuilder[] }) => Promise<unknown>;
} {
  return "send" in channel && typeof channel.send === "function";
}

async function execute(job: QueueJob): Promise<void> {
  const channel = await job.guild.channels.fetch(job.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  if (!isSendable(channel)) return;

  const chunkSize = 10;
  for (let i = 0; i < job.embeds.length; i += chunkSize) {
    const chunk = job.embeds.slice(i, i + chunkSize);
    await channel.send({ embeds: chunk }).catch((err) => {
      log.warn("LogQueue channel send failed", {
        guildId: job.guild.id,
        channelId: job.channelId,
        err: String(err),
      });
    });
  }
}

export async function enqueueLogSend(job: QueueJob): Promise<void> {
  const key = `${job.guild.id}:${job.channelId}`;
  const pending = pendingByChannel.get(key);
  if (pending) {
    pending.embeds.push(...job.embeds);
    await new Promise<void>((resolve) => pending.waiters.push(resolve));
    return;
  }

  await new Promise<void>((resolve) => {
    const row = {
      guild: job.guild,
      channelId: job.channelId,
      embeds: [...job.embeds],
      timer: null as ReturnType<typeof setTimeout> | null,
      waiters: [resolve] as Array<() => void>,
    };
    row.timer = setTimeout(() => {
      pendingByChannel.delete(key);
      const previous = channelChains.get(key) ?? Promise.resolve();
      const next = previous.then(async () =>
        execute({ guild: row.guild, channelId: row.channelId, embeds: row.embeds }),
      );
      channelChains.set(
        key,
        next.finally(() => {
          if (channelChains.get(key) === next) channelChains.delete(key);
          for (const done of row.waiters) done();
        }),
      );
    }, AGGREGATION_WINDOW_MS);
    pendingByChannel.set(key, row);
  });
}
