import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  COMMAND_REGISTER_GUILD_ONLY: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Bot sahibinin Discord kullanıcı ID'si — /sunucu komutuna erişim için zorunlu */
  BOT_OWNER_ID: z.string().min(1),
  /** Virgülle ayrılmış guild ID'leri — bot başlarken otomatik izin verilir (ilk kurulum) */
  SEED_GUILD_IDS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return cached;
}
