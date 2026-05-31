import { redisKeys } from "../config/redisKeys.js";
import { getRedis } from "./redis.js";

/** Redis NX + EX — true = cooldown tüketildi (izin var), false = çok erken */
export async function tryConsumeCooldown(
  scope: string,
  subKey: string,
  ttlSec: number,
): Promise<boolean> {
  const redis = getRedis();
  const key = redisKeys.cooldown(scope, subKey);
  const res = await redis.set(key, "1", "EX", Math.max(1, ttlSec), "NX");
  return res === "OK";
}
