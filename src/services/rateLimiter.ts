import { redisKeys } from "../config/redisKeys.js";
import { getRedis } from "./redis.js";

/** bucket: prefix içermez, örn. `spam:${guildId}:${userId}` */
export async function slidingWindowHit(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; count: number }> {
  const redis = getRedis();
  const k = redisKeys.rateLimit(bucket);
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const pipeline = redis.multi();
  pipeline.zremrangebyscore(k, 0, now - windowMs);
  pipeline.zadd(k, now, `${now}:${Math.random()}`);
  pipeline.zcard(k);
  pipeline.expire(k, windowSec + 1);
  const res = await pipeline.exec();
  const count = (res?.[2]?.[1] as number) ?? 0;
  return { allowed: count <= limit, count };
}
