import { Redis } from "ioredis";
import { createLogger } from "./logger.js";

const log = createLogger("redis");

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) throw new Error("Redis not initialized");
  return client;
}

export async function connectRedis(url: string): Promise<Redis> {
  if (client) return client;
  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  client.on("error", (err: Error) => log.error("Redis error", { err: String(err) }));
  await client.ping();
  log.info("Redis connected");
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    log.info("Redis disconnected");
  }
}
