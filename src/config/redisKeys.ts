import { REDIS_PREFIX } from "./constants.js";

/** Tek tip Redis anahtarları — prefix her zaman buradan. */
export const redisKeys = {
  rateLimit: (bucket: string) => `${REDIS_PREFIX}rl:${bucket}`,
  guildConfig: (guildId: string) => `${REDIS_PREFIX}guildcfg:${guildId}`,
  logConfig: (guildId: string) => `${REDIS_PREFIX}logcfg:${guildId}`,
  giveawayEntrants: (messageId: string) => `${REDIS_PREFIX}gw:entrants:${messageId}`,
  tempVoiceOwner: (channelId: string) => `${REDIS_PREFIX}tempvc:owner:${channelId}`,
  tempVoiceLocked: (channelId: string) => `${REDIS_PREFIX}tempvc:locked:${channelId}`,
  /** "1" iken @everyone Bağlan: açık (herkes girebilir, kanalı görebiliyorsa). */
  tempVoicePublic: (channelId: string) => `${REDIS_PREFIX}tempvc:public:${channelId}`,
  tempVoiceHidden: (channelId: string) => `${REDIS_PREFIX}tempvc:hidden:${channelId}`,
  tempVoicePanelMsg: (channelId: string) => `${REDIS_PREFIX}tempvc:panelmsg:${channelId}`,
  tempVoiceLockBackup: (channelId: string) => `${REDIS_PREFIX}tempvc:lockbak:${channelId}`,
  /** Kullanıcının açık geçici ses kanalı (çift oluşturmayı önler). */
  tempVoiceUserChannel: (guildId: string, userId: string) =>
    `${REDIS_PREFIX}tempvc:userch:${guildId}:${userId}`,
  /** Hub'a girişte aynı anda tek createTempChannel (yarış önleme). */
  tempVoiceCreateLock: (guildId: string, userId: string) =>
    `${REDIS_PREFIX}tempvc:mklock:${guildId}:${userId}`,
  raidCounter: (guildId: string) => `${REDIS_PREFIX}raid:${guildId}`,
  inviteSnapshot: (guildId: string) => `${REDIS_PREFIX}logging:invites:${guildId}`,
  cooldown: (scope: string, id: string) => `${REDIS_PREFIX}cd:${scope}:${id}`,
} as const;
