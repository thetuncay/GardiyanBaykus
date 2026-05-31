export const REDIS_PREFIX = "bilgebaykus:";

export const BOT_DISPLAY_NAME = "BilgeBaykuş";

/** Redis + bellek log yapılandırması önbelleği */
export const LOG_CONFIG_CACHE_TTL_MS = 45_000;

/** GuildConfig bellek katmanı (Redis öncesi) */
export const GUILD_MEMORY_CACHE_TTL_MS = 45_000;
export const GUILD_MEMORY_CACHE_MAX = 2_000;

export const GUILD_CACHE_TTL_SEC = 300;

/** LogService davet snapshot bellek LRU */
export const INVITE_CACHE_LRU_MAX = 150;

/** Ghost ping mention önbelleği */
export const GHOST_PING_CACHE_MAX = 4_000;

/** Slash komut: kullanıcı başına saniye */
export const COOLDOWN_SLASH_SEC = 2;

/** Çekiliş Katıl butonu */
export const COOLDOWN_GIVEAWAY_BUTTON_SEC = 3;

/** Geçici ses panel butonları */
export const COOLDOWN_TEMP_VOICE_BUTTON_SEC = 2;
