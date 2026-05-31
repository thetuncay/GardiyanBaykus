# BilgeBaykuş — Refaktör özeti (2026)

## 1. Yapılan değişikliklerin listesi

### Aşama 1 — Ölü kod temizliği
- Kayıt dışı kalan `src/events/guildMember*.ts`, `guildBanAdd.ts`, `messageDelete.ts`, `messageUpdate.ts` kaldırıldı (işlevleri logging modülüne zaten taşınmıştı).
- `src/modules/advanced_logging/` ve `src/systems/logging/` (filtering, advancedMessage*, embeds, diff) kaldırıldı.
- `src/modules/logging/service.ts` (`sendGuildLog`, `sendBaykusLogByKey`, `GuildConfig.channels.log` yolu) kaldırıldı — tek log hattı `LogService` + `LogConfig`.

### Aşama 2 — Olay sistemi
- `src/events/registry.ts` eklendi: tüm çekirdek olaylar + `registerLoggingEvents` tek girişten yükleniyor.
- `src/events/index.ts` yalnızca `registerAllEvents` dışa aktarıyor.

### Aşama 3 — Log tekilleştirme
- Moderasyon log kanalı ve otomatik moderasyon: `fetchModerationLogChannel` → `LogConfig.channels.moderationLogs` / `modLogs`.
- `/kanal-ayar`: `GuildConfig.channels` yerine `LogConfig` güncelleniyor (`serverLogs`, `moderationLogs` + uyumluluk için `modLogs`).
- `LogService.sendLog` / `sendLogs`: isteğe bağlı **filtre** (`shouldLogEventWithAutoRoles`) + `ensureEmbedStandard` ile gömülü standardizasyon.
- Raid uyarısı `memberLogs` içinde `antiRaid` + Redis sayacı ile yeniden etkin.

### Aşama 4 — Veritabanı
- Kaldırılan modeller: `LogEntry`, `GhostPing`, `MessageEdit`, `ReactionRoleBinding`.
- `GuildConfig`: kullanılmayan `channels` (log/modLog/register/level), `levels`, `registration`, `modules` içi levels/reactionRoles/registration/music kaldırıldı.
- `UserStats`: XP/level/lastXpAt alanları ve ilgili indeksler kaldırıldı; uyarı sayacı korundu.

### Aşama 5 — Performans / önbellek
- `logConfigCache.ts`: LogConfig için bellek LRU (500 guild) + TTL (`LOG_CONFIG_CACHE_TTL_MS`).
- `guildSettingsCache.ts`: Redis öncesi bellek katmanı (`GUILD_MEMORY_CACHE_*`).
- `messageCreate`: gereksiz `getGuildConfig` çağrısı kaldırıldı (automod zaten yüklüyor).
- `LogService.sendLogs`: `findOne` yerine önbellekli config.
- `rateLimiter`: bucket artık prefix içermiyor; anahtar `redisKeys.rateLimit(bucket)`.
- `redisKeys.ts`: tüm Redis anahtar desenleri tek yerde.

### Aşama 6 — Cooldown / rate limit
- `cooldownService.ts` (Redis `SET NX EX`).
- Slash komut: kullanıcı+komut başına (`COOLDOWN_SLASH_SEC`).
- Çekiliş “Katıl” butonu (`COOLDOWN_GIVEAWAY_BUTTON_SEC`).
- Geçici ses panel + modal (`COOLDOWN_TEMP_VOICE_BUTTON_SEC`).
- `owl` metin komutları: sliding window (`owlcmd:...`).

### Aşama 7 — Modül mimarisi (kısmi)
- `modules/core/commands/index.ts` ve `modules/logging/commands/index.ts` barrel yapısı.
- Diğer modüller hâlâ `commands.ts` kökünde; tam `commands/events/services` ayrımı gelecek iterasyonlarda genişletilebilir.

### Aşama 8 — Logger
- `interactionCreate`, `messageCreate`, `voiceStateUpdate`, `deploy`: `console.*` → `createLogger`.

### Aşama 9 — Bellek / LRU
- `ghostPingCache`: `LruCache` + `GHOST_PING_CACHE_MAX`.
- Davet snapshot: `LruCache` + `INVITE_CACHE_LRU_MAX`.

### Aşama 10 — Kod kalitesi
- Çekiliş kazanan karıştırma: `crypto.randomInt` + Fisher–Yates.
- Boş `enforceTempVoiceLock` kaldırıldı.
- `client.cooldowns` koleksiyonu kaldırıldı (cooldown Redis’te).
- Moderasyon `temizle` komutunda eksik `ChannelType` / `TextChannel` import düzeltmesi.

---

## 2. Silinen dosyalar

- `src/events/guildMemberAdd.ts`, `guildMemberRemove.ts`, `guildMemberUpdate.ts`, `guildBanAdd.ts`, `messageDelete.ts`, `messageUpdate.ts`
- `src/modules/logging/service.ts`, `src/modules/logging/commands.ts`
- `src/modules/core/commands.ts`
- `src/modules/advanced_logging/commands.ts`, `embeds.ts`
- `src/systems/logging/*` (tümü)
- `src/database/models/LogEntry.ts`, `GhostPing.ts`, `MessageEdit.ts`, `ReactionRoleBinding.ts`

---

## 3. Yeni / önemli klasör ve dosya yapısı

```
src/
  config/
    redisKeys.ts          # Redis anahtar fabrikası
    constants.ts          # TTL, cooldown, LRU limitleri
  services/
    logConfigCache.ts
    cooldownService.ts
    guildSettingsCache.ts # bellek + Redis
    rateLimiter.ts
    logger.ts
  utils/
    lruCache.ts
  events/
    registry.ts           # tek kayıt girişi
    index.ts
    ready.ts
    interactionCreate.ts
    messageCreate.ts
    voiceStateUpdate.ts
  modules/
    core/commands/index.ts
    logging/
      commands/index.ts
      commands/setup.ts
      services/
        logService.ts
        logFiltering.ts
        modLogChannel.ts
      events/...
```

---

## 4. Performans iyileştirmeleri

- Mesaj başına gereksiz guild config okuması kaldırıldı.
- LogConfig ve GuildConfig için kısa ömürlü bellek önbelleği.
- Log gönderiminde tekrarlayan Mongo `findOne` azaltıldı.
- Davet ve ghost ping için sınırlı LRU.

---

## 5. Güvenlik iyileştirmeleri

- Slash / buton / modal / `owl` için hız sınırları.
- Çekiliş kazanan seçiminde daha uygun rastgele karıştırma.
- Ölü `advanced_logging` ve özel embed JSON komut yüzeyi kaldırıldı (saldırı yüzeyi azaltma).

---

## 6. Gelecekte eklenebilecek özellikler

- Tüm modüller için tam `commands/` + `events/` + `services/` ayrımı ve boş `events/index.ts` toplayıcıları.
- LogConfig için yönetim komutları (olay devre dışı, ignore listeleri).
- `GuildConfig` şeması ile Mongo belgelerinde kalan eski alanlar için migrasyon script’i.
- Merkezi hata raporlama (Sentry vb.).
- Sharding gerekiyorsa `src/shard.ts` ve `package.json` script’inin yeniden eklenmesi.

---

## 7. Kırılan / dikkat gerektiren davranışlar

- `/kanal-ayar` seçenekleri: **Sunucu / genel log** → `LogConfig.channels.serverLogs`; **Mod / ceza logu** → `moderationLogs` (+ `modLogs`).
- Eski `GuildConfig.channels.log` / `modLog` artık okunmuyor; gerekirse bir kerelik manuel taşıma veya `/kanal-ayar` ile yeniden seçim.
- Kaldırılan Mongo koleksiyonları veritabanında durabilir; istenirse manuel drop edilebilir.
