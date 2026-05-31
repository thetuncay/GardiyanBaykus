/** Kullanıcıya dönük kısa Türkçe metinler — BilgeBaykuş 🦉 */

export const M = {
  onlyGuild: "🦉 Bu komut yalnızca sunucularda kullanılabilir.",
  noPermsMod: "🦉 Bunu kullanmak için **Moderasyon** yetkilerine ihtiyacın var. Baykuş seni izliyor.",
  noPermsAdmin: "🦉 Bunun için **Yönetici** yetkisi gerekir.",
  botNoPerms: "🦉 Gerekli izinlere sahip değilim (rol hiyerarşisine dikkat).",
  genericError: "🦉 Bir terslik oldu. Kısa süre sonra yeniden dene.",
  spamWarn: "🦉 Baykuş seni izliyor… spam yapma!",
  levelXpGain: "🦉 Bilgelik puanın arttı!",
  levelUp: (lvl: number) => `🦉 Seviye atladın! Yeni bilgelik seviyesi: **${lvl}**`,
  tempVoiceCreated: "🦉 Bu yuvayı sana ayırdım. İyi sohbetler!",
  queueDone: "🦉 Çalma sırası bitti. Sessizlik bazen en güzel melodi.",
  nowPlaying: (t: string) => `🦉 Şu an çalıyor: **${t}**`,
  playFailed: "🦉 Parçayı çalamadım. Bağlantı veya kaynak sorunu olabilir.",
  joinVcFirst: "🦉 Önce bir ses kanalına gir; gözcü seni duysun.",
} as const;

export function owl(title: string, body: string): string {
  return `**${title}**\n🦉 ${body}`;
}
