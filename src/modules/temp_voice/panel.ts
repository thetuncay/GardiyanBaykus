import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Guild,
  type Message,
  type ModalSubmitInteraction,
  type VoiceChannel,
} from "discord.js";
import { getRedis } from "../../services/redis.js";
import { redisKeys } from "../../config/redisKeys.js";
import { COOLDOWN_TEMP_VOICE_BUTTON_SEC } from "../../config/constants.js";
import { slidingWindowHit } from "../../services/rateLimiter.js";
import { tryConsumeCooldown } from "../../services/cooldownService.js";
import { errorEmbed, infoEmbed, warningEmbed, brandEmbed } from "../../utils/embeds.js";
import {
  persistAllowedAdd,
  persistAllowedRemove,
  persistBanAdd,
  persistBanRemove,
  persistBitrate,
  persistChannelName,
  persistEveryonePublic,
  persistHidden,
  persistUserLimit,
} from "./profileService.js";
import { removeVoiceRoom } from "./roomService.js";

const ownerKey = (channelId: string) => redisKeys.tempVoiceOwner(channelId);
const lockedKey = (channelId: string) => redisKeys.tempVoiceLocked(channelId);
const publicKey = (channelId: string) => redisKeys.tempVoicePublic(channelId);
const hiddenKey = (channelId: string) => redisKeys.tempVoiceHidden(channelId);
const panelMsgKey = (channelId: string) => redisKeys.tempVoicePanelMsg(channelId);
const lockBackupKey = (channelId: string) => redisKeys.tempVoiceLockBackup(channelId);

const TTL = 86_400;

export async function isTempVoiceOwner(channelId: string, userId: string): Promise<boolean> {
  const o = await getRedis().get(ownerKey(channelId));
  return o === userId;
}

/** @everyone için Bağlan açık mı (herkes girebilir modu)? */
async function getEveryonePublic(channelId: string): Promise<boolean> {
  return (await getRedis().get(publicKey(channelId))) === "1";
}

async function getHidden(channelId: string): Promise<boolean> {
  return (await getRedis().get(hiddenKey(channelId))) === "1";
}

export async function clearTempVoiceRedis(channelId: string, guildId?: string): Promise<void> {
  const r = getRedis();
  const userId = await r.get(ownerKey(channelId));
  await r.del(
    ownerKey(channelId),
    lockedKey(channelId),
    publicKey(channelId),
    hiddenKey(channelId),
    panelMsgKey(channelId),
    lockBackupKey(channelId),
  );
  if (guildId && userId) {
    await r.del(redisKeys.tempVoiceUserChannel(guildId, userId));
  }
}

function owlCommandsBlock(): string {
  return (
    "```\n" +
    "owl kapat       — yuvayı kapat\n" +
    "owl kilit       — herkese aç / sadece davetliler\n" +
    "owl gizle       — gizle / göster\n" +
    "owl isim <ad>   — ad değiştir\n" +
    "owl limit <n>   — kullanıcı limiti\n" +
    "owl kbps <n>    — bitrate (kbps)\n" +
    "owl ekle @üye   — giriş izni\n" +
    "owl cikar @üye  — izin kaldır\n" +
    "owl ban @üye    — yasakla\n" +
    "owl unban @üye  — yasak kaldır\n" +
    "owl kick @üye   — odadan at\n" +
    "owl stats       — istatistik\n" +
    "```"
  );
}

export function buildTempVoiceEmbed(options: {
  channel: VoiceChannel;
  ownerDisplayName: string;
  openedAt: Date;
}): EmbedBuilder {
  const opened = options.openedAt.toLocaleString("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  return brandEmbed({
    subsystem: "ses",
    title: `${options.ownerDisplayName} — Özel Yuva 🦉`,
    description:
      "🌙 BilgeBaykuş bu yuvayı senin için açtı.\n\nAşağıdaki **owl** komutlarını yazabilir veya **butonlarla** hızlıca yönetebilirsin.",
    timestampAt: options.openedAt,
  }).addFields(
    {
      name: "🦉 owl komutları",
      value: owlCommandsBlock(),
      inline: false,
    },
    {
      name: "🪶 İpuçları",
      value: "Bu panel **yalnızca yuva sahibine** aittir. Wise Owl seni yönlendirir.",
      inline: false,
    },
    {
      name: "📍 Yuva bilgisi",
      value: `**Kanal:** ${options.channel.name}\n**Açılış:** ${opened}`,
      inline: false,
    },
  );
}

export async function buildTempVoiceRows(channelId: string): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const everyonePublic = await getEveryonePublic(channelId);
  const hidden = await getHidden(channelId);
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv:b:lock:${channelId}`)
      .setLabel(everyonePublic ? "🔒 Sadece davetliler" : "🌐 Herkese aç")
      .setStyle(everyonePublic ? ButtonStyle.Primary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tv:b:hide:${channelId}`)
      .setLabel(hidden ? "👁️ Göster" : "👁️ Gizle")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`tv:b:kbps:${channelId}`)
      .setLabel("📶 Kbps")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`tv:b:limit:${channelId}`)
      .setLabel("👥 Limit")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`tv:b:name:${channelId}`)
      .setLabel("✏️ İsim")
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tv:b:close:${channelId}`)
      .setLabel("🦉 Yuvayı Kapat")
      .setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

async function refreshPanelDisplay(guild: Guild, channelId: string): Promise<void> {
  const redis = getRedis();
  const mid = await redis.get(panelMsgKey(channelId));
  const ch = (await guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
  if (!ch?.isVoiceBased() || !mid) return;
  const msg = await ch.messages.fetch(mid).catch(() => null);
  if (!msg?.editable) return;
  const owner = await redis.get(ownerKey(channelId));
  if (!owner) return;
  const member = await guild.members.fetch(owner).catch(() => null);
  const displayName = member?.displayName ?? "Üye";
  const embed = buildTempVoiceEmbed({ channel: ch, ownerDisplayName: displayName, openedAt: msg.createdAt });
  const rows = await buildTempVoiceRows(channelId);
  await msg.edit({ embeds: [embed], components: rows }).catch(() => null);
}

export async function postTempVoicePanel(
  channel: VoiceChannel,
  ownerId: string,
  guild: Guild,
  openedAt: Date,
): Promise<void> {
  const member = await guild.members.fetch(ownerId).catch(() => null);
  const displayName = member?.displayName ?? "Üye";
  const embed = buildTempVoiceEmbed({ channel, ownerDisplayName: displayName, openedAt });
  const rows = await buildTempVoiceRows(channel.id);
  const msg = await channel.send({
    content: `<@${ownerId}>`,
    embeds: [embed],
    components: rows,
    allowedMentions: { users: [ownerId] },
  });
  await getRedis().set(panelMsgKey(channel.id), msg.id, "EX", TTL);
}

async function runLockToggle(
  channel: VoiceChannel,
  channelId: string,
): Promise<string> {
  const redis = getRedis();
  const everyone = channel.guild.roles.everyone;
  const isPublic = await getEveryonePublic(channelId);
  const owner = await redis.get(ownerKey(channelId));

  if (!isPublic) {
    await channel.permissionOverwrites.edit(everyone, { Connect: true });
    await redis.set(publicKey(channelId), "1", "EX", TTL);
    if (owner) await persistEveryonePublic(channel.guild.id, owner, true);
    return "🦉 **Herkese açık:** Sunucudaki herkes bu odaya bağlanabilir (kanalı listede görebiliyorsa). `owl ekle` ile eklediğin üyelerin izinleri aynen kalır. Tekrar `owl kilit` ile sadece davetlilere dönebilirsin.";
  }

  await channel.permissionOverwrites.edit(everyone, { Connect: false });
  await redis.del(publicKey(channelId));
  if (owner) await persistEveryonePublic(channel.guild.id, owner, false);
  return "🦉 **Sadece davetliler:** Oda yalnızca yuva sahibi ve `owl ekle` ile eklenen üyelere açık; önceden eklenenlerin izinleri silinmez. Herkese açmak için tekrar `owl kilit` yaz.";
}

async function runHideToggle(
  channel: VoiceChannel,
  guild: Guild,
  channelId: string,
): Promise<string> {
  const redis = getRedis();
  const hidden = await getHidden(channelId);
  const everyone = guild.roles.everyone;
  const botId = channel.client.user.id;
  const owner = (await redis.get(ownerKey(channelId)))!;
  if (!hidden) {
    await redis.set(hiddenKey(channelId), "1", "EX", TTL);
    await channel.permissionOverwrites.edit(everyone, {
      ViewChannel: false,
      Connect: false,
    });
    await channel.permissionOverwrites.edit(owner, {
      ViewChannel: true,
      Connect: true,
    });
    await channel.permissionOverwrites.edit(botId, {
      ViewChannel: true,
      SendMessages: true,
      EmbedLinks: true,
      ReadMessageHistory: true,
    });
    await persistHidden(guild.id, owner, true);
    return "🦉 Yuva listeden gizlendi (sen ve bot görebilirsiniz).";
  }
  await redis.del(hiddenKey(channelId));
  await channel.permissionOverwrites.edit(everyone, {
    ViewChannel: true,
    Connect: false,
  });
  await persistHidden(guild.id, owner, false);
  return "🦉 Yuva tekrar görünür.";
}

export async function closeTempVoiceChannel(channel: VoiceChannel, channelId: string): Promise<void> {
  for (const [, m] of channel.members) {
    await m.voice.disconnect().catch(() => null);
  }
  await channel.delete("BilgeBaykuş: yuva kapatıldı").catch(() => null);
  await clearTempVoiceRedis(channelId, channel.guild.id);
  await removeVoiceRoom(channelId);
}

export async function handleTempVoiceButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("tv:b:") || !interaction.guild) return false;
  const cdOk = await tryConsumeCooldown(
    "tvbtn",
    `${interaction.user.id}:${interaction.customId}`,
    COOLDOWN_TEMP_VOICE_BUTTON_SEC,
  );
  if (!cdOk) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "ses",
          title: "⏳ Yavaşla",
          description: "Butonlara çok hızlı basıyorsun. Kısa bir süre bekle.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }
  const parts = interaction.customId.split(":");
  if (parts.length < 4) return false;
  const action = parts[2];
  const channelId = parts.slice(3).join(":");
  if (!channelId) return false;

  const ok = await isTempVoiceOwner(channelId, interaction.user.id);
  if (!ok) {
    await interaction.reply({
      embeds: [
        errorEmbed({
          subsystem: "ses",
          title: "⚠️ Panel Sahibi",
          description: "Bu panel yalnızca yuva sahibine aittir.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  const channel = (await interaction.guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
  if (!channel?.isVoiceBased()) {
    await interaction.reply({
      embeds: [
        errorEmbed({
          subsystem: "ses",
          title: "❌ Yuva Bulunamadı",
          description: "Bu yuva artık yok veya erişilemiyor.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (action === "close") {
    await interaction.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "🌙 Yuva Kapatılıyor",
          description: "Görüşmek üzere! Yuvayı kapatıyorum...",
        }),
      ],
      ephemeral: true,
    });
    await closeTempVoiceChannel(channel, channelId);
    return true;
  }

  if (action === "lock") {
    await interaction.deferUpdate();
    const text = await runLockToggle(channel, channelId);
    await refreshPanelDisplay(interaction.guild, channelId);
    await interaction.followUp({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "🌐 Giriş modu",
          description: text,
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (action === "hide") {
    await interaction.deferUpdate();
    const text = await runHideToggle(channel, interaction.guild, channelId);
    await refreshPanelDisplay(interaction.guild, channelId);
    await interaction.followUp({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "👁️ Görünürlük Durumu",
          description: text,
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (action === "kbps") {
    const modal = new ModalBuilder()
      .setCustomId(`tv:m:kbps:${channelId}`)
      .setTitle("📶 Bitrate (Kbps) 🦉")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("kbps")
            .setLabel("Kbps (örn. 64, 96, 128)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  if (action === "limit") {
    const modal = new ModalBuilder()
      .setCustomId(`tv:m:limit:${channelId}`)
      .setTitle("👥 Kullanıcı limiti 🦉")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("limit")
            .setLabel("Limit (0 = limitsiz, max 99)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(2),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  if (action === "name") {
    const modal = new ModalBuilder()
      .setCustomId(`tv:m:name:${channelId}`)
      .setTitle("✏️ Yuva adı 🦉")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Yeni kanal adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(80),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

export async function handleTempVoiceModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("tv:m:") || !interaction.guild) return false;
  const parts = interaction.customId.split(":");
  if (parts.length < 4) return false;
  const kind = parts[2];
  const channelId = parts.slice(3).join(":");
  if (!channelId || !["kbps", "limit", "name"].includes(kind)) return false;

  const modalCd = await tryConsumeCooldown(
    "tvmodal",
    `${interaction.user.id}:${interaction.customId}`,
    COOLDOWN_TEMP_VOICE_BUTTON_SEC,
  );
  if (!modalCd) {
    await interaction.reply({
      embeds: [
        warningEmbed({
          subsystem: "ses",
          title: "⏳ Yavaşla",
          description: "Çok sık gönderim. Kısa süre bekle.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  const ok = await isTempVoiceOwner(channelId, interaction.user.id);
  if (!ok) {
    await interaction.reply({
      embeds: [
        errorEmbed({
          subsystem: "ses",
          title: "⚠️ İşlem Sahibi",
          description: "Bu işlem yalnızca yuva sahibine açık.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  const channel = (await interaction.guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
  if (!channel?.isVoiceBased()) {
    await interaction.reply({
      embeds: [
        errorEmbed({
          subsystem: "ses",
          title: "❌ Kanal Bulunamadı",
          description: "Ses kanalı bulunamadı veya artık mevcut değil.",
        }),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (kind === "kbps") {
    const raw = interaction.fields.getTextInputValue("kbps").trim().replace(/\s/g, "");
    const kbps = Number.parseInt(raw, 10);
    if (!Number.isFinite(kbps) || kbps < 8) {
      await interaction.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ Geçersiz Kbps",
            description: "Geçerli bir Kbps sayısı gir (örn. 64).",
          }),
        ],
        ephemeral: true,
      });
      return true;
    }
    const maxBps = interaction.guild.maximumBitrate;
    const bps = Math.min(Math.max(kbps * 1000, 8000), maxBps);
    await channel.setBitrate(bps, "BilgeBaykuş panel");
    const owner = await getRedis().get(ownerKey(channelId));
    if (owner) await persistBitrate(interaction.guild.id, owner, bps);
    await interaction.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "📶 Bitrate Ayarlandı",
          description: `Bitrate: **${Math.round(bps / 1000)} kbps**`,
        }),
      ],
      ephemeral: true,
    });
    await refreshPanelDisplay(interaction.guild, channelId);
    return true;
  }

  if (kind === "limit") {
    const raw = interaction.fields.getTextInputValue("limit").trim();
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      await interaction.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ Geçersiz Limit",
            description: "Limit 0–99 arası olmalı (0 = limitsiz).",
          }),
        ],
        ephemeral: true,
      });
      return true;
    }
    await channel.setUserLimit(n, "BilgeBaykuş panel");
    const owner = await getRedis().get(ownerKey(channelId));
    if (owner) await persistUserLimit(interaction.guild.id, owner, n);
    await interaction.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "👥 Limit Güncellendi",
          description:
            n === 0
              ? "Kullanıcı limiti kaldırıldı (limitsiz)."
              : `Kullanıcı limiti: **${n}**`,
        }),
      ],
      ephemeral: true,
    });
    await refreshPanelDisplay(interaction.guild, channelId);
    return true;
  }

  if (kind === "name") {
    const name = interaction.fields.getTextInputValue("name").trim().slice(0, 100);
    if (!name) {
      await interaction.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ Geçersiz İsim",
            description: "Geçerli bir isim gir.",
          }),
        ],
        ephemeral: true,
      });
      return true;
    }
    await channel.setName(name, "BilgeBaykuş panel");
    const owner = await getRedis().get(ownerKey(channelId));
    if (owner) await persistChannelName(interaction.guild.id, owner, name);
    await interaction.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✏️ Yuva Adı Güncellendi",
          description: `Yeni ad: **${name}**`,
        }),
      ],
      ephemeral: true,
    });
    await refreshPanelDisplay(interaction.guild, channelId);
    return true;
  }

  return false;
}

function targetUserFromMessage(message: Message): string | null {
  return message.mentions.users.first()?.id ?? null;
}

export async function handleOwlTempVoiceCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.channel.type !== ChannelType.GuildVoice) return false;
  const channel = message.channel as VoiceChannel;
  const channelId = channel.id;
  const owner = await getRedis().get(ownerKey(channelId));
  if (!owner) return false;
  if (message.author.id !== owner) return false;

  const raw = message.content.trim();
  if (!/^owl\s+/i.test(raw)) return false;
  const { allowed } = await slidingWindowHit(
    `owlcmd:${message.guild.id}:${message.author.id}`,
    14,
    8,
  );
  if (!allowed) {
    await message
      .reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⏳ Yavaşla",
            description: "Çok sık `owl` komutu gönderiyorsun. Birkaç saniye bekle.",
          }),
        ],
      })
      .catch(() => null);
    return true;
  }
  const rest = raw.replace(/^owl\s+/i, "").trim();
  if (!rest) {
    await message.reply({
      embeds: [
        warningEmbed({
          subsystem: "ses",
          title: "🦉 Komut Kullanımı",
          description: "Örn. `owl stats`",
        }),
      ],
    }).catch(() => null);
    return true;
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  const firstWord = tokens[0]?.toLowerCase() ?? "";
  const args = tokens.slice(1);
  const tailArgs = args.join(" ");

  if (!message.guild) return true;

  if (firstWord === "kapat") {
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "🌙 Yuva Kapatılıyor",
          description: "Görüşmek üzere! Yuvayı kapatıyorum...",
        }),
      ],
    }).catch(() => null);
    await closeTempVoiceChannel(channel, channelId);
    return true;
  }

  if (firstWord === "kilit") {
    const text = await runLockToggle(channel, channelId);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "🌐 Giriş modu",
          description: text,
        }),
      ],
    }).catch(() => null);
    await refreshPanelDisplay(message.guild, channelId);
    return true;
  }

  if (firstWord === "gizle") {
    const text = await runHideToggle(channel, message.guild, channelId);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "👁️ Görünürlük Durumu",
          description: text,
        }),
      ],
    }).catch(() => null);
    await refreshPanelDisplay(message.guild, channelId);
    return true;
  }

  if (firstWord === "isim") {
    const name = tailArgs.trim().slice(0, 100);
    if (!name) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "✏️ Yuva İsim Kullanımı",
            description: "`owl isim Yeni Ad`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.setName(name, "owl isim");
    await persistChannelName(message.guild.id, owner, name);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✏️ Yuva Adı Güncellendi",
          description: `Yeni ad: **${name}**`,
        }),
      ],
    }).catch(() => null);
    await refreshPanelDisplay(message.guild, channelId);
    return true;
  }

  if (firstWord === "limit") {
    const n = Number.parseInt(args[0] ?? "", 10);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "👥 Limit Kullanımı",
            description: "`owl limit 5` veya `owl limit 0`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.setUserLimit(n, "owl limit");
    await persistUserLimit(message.guild.id, owner, n);
    await message
      .reply({
        embeds: [
          infoEmbed({
            subsystem: "ses",
            title: "👥 Limit Güncellendi",
            description: n === 0 ? "Limit kaldırıldı (limitsiz)." : `Limit: **${n}**`,
          }),
        ],
      })
      .catch(() => null);
    await refreshPanelDisplay(message.guild, channelId);
    return true;
  }

  if (firstWord === "kbps") {
    const kbps = Number.parseInt(args[0] ?? "", 10);
    if (!Number.isFinite(kbps) || kbps < 8) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "📶 Kbps Kullanımı",
            description: "`owl kbps 64`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    const maxBps = message.guild.maximumBitrate;
    const bps = Math.min(Math.max(kbps * 1000, 8000), maxBps);
    await channel.setBitrate(bps, "owl kbps");
    await persistBitrate(message.guild.id, owner, bps);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "📶 Bitrate Güncellendi",
          description: `**${Math.round(bps / 1000)} kbps**`,
        }),
      ],
    }).catch(() => null);
    await refreshPanelDisplay(message.guild, channelId);
    return true;
  }

  const target = targetUserFromMessage(message);
  if (firstWord === "ekle") {
    if (!target) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "🦉 Etiket Gerekli",
            description: "`owl ekle @üye`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    if (target === owner) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ Aynı Kullanıcı",
            description: "Zaten yuva sahibisin.",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.permissionOverwrites.edit(target, {
      ViewChannel: true,
      Connect: true,
    });
    await persistAllowedAdd(message.guild.id, owner, target);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✅ Kullanıcı Eklendi",
          description: `<@${target}> bu yuvaya bağlanabilir.`,
        }),
      ],
    }).catch(() => null);
    return true;
  }

  if (firstWord === "cikar") {
    if (!target) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "🦉 Etiket Gerekli",
            description: "`owl cikar @üye`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    if (target === owner) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ İşlem Yasak",
            description: "Kendini odadan çıkaramazsın. Yuvayı kapatmak için `owl kapat`.",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.permissionOverwrites.delete(target).catch(() => null);
    const mem = await message.guild.members.fetch(target).catch(() => null);
    if (mem?.voice.channelId === channelId) await mem.voice.disconnect().catch(() => null);
    await persistAllowedRemove(message.guild.id, owner, target);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✅ Kullanıcı Çıkarıldı",
          description: `<@${target}> çıkarıldı.`,
        }),
      ],
    }).catch(() => null);
    return true;
  }

  if (firstWord === "ban") {
    if (!target) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "🦉 Etiket Gerekli",
            description: "`owl ban @üye`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    if (target === owner) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ İşlem Yasak",
            description: "Kendini yasaklayamazsın.",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.permissionOverwrites.edit(target, { Connect: false, ViewChannel: false });
    const mem = await message.guild.members.fetch(target).catch(() => null);
    if (mem?.voice.channelId === channelId) await mem.voice.disconnect().catch(() => null);
    await persistBanAdd(message.guild.id, owner, target);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "🚫 Kullanıcı Yasaklandı",
          description: `<@${target}> bu yuvadan yasaklandı.`,
        }),
      ],
    }).catch(() => null);
    return true;
  }

  if (firstWord === "unban") {
    if (!target) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "🦉 Etiket Gerekli",
            description: "`owl unban @üye`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    await channel.permissionOverwrites.delete(target).catch(() => null);
    await persistBanRemove(message.guild.id, owner, target);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✅ Yasak Kaldırıldı",
          description: `<@${target}> için yasak kaldırıldı. Gerekirse \`owl ekle\` ile tekrar izin ver.`,
        }),
      ],
    }).catch(() => null);
    return true;
  }

  if (firstWord === "kick") {
    if (!target) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "🦉 Etiket Gerekli",
            description: "`owl kick @üye`",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    if (target === owner) {
      await message.reply({
        embeds: [
          warningEmbed({
            subsystem: "ses",
            title: "⚠️ İşlem Yasak",
            description: "Kendini kickleyemezsin.",
          }),
        ],
      }).catch(() => null);
      return true;
    }
    const mem = await message.guild.members.fetch(target).catch(() => null);
    if (mem?.voice.channelId === channelId) await mem.voice.disconnect().catch(() => null);
    await message.reply({
      embeds: [
        infoEmbed({
          subsystem: "ses",
          title: "✅ Kick Uygulandı",
          description: `<@${target}> sesten çıkarıldı.`,
        }),
      ],
    }).catch(() => null);
    return true;
  }

  if (firstWord === "stats") {
    const everyonePublic = await getEveryonePublic(channelId);
    const hidden = await getHidden(channelId);
    const embed = infoEmbed({
      subsystem: "ses",
      title: "🦉 Yuva istatistikleri",
      description: "Wise Owl bu yuvanın anlık durumunu özetliyor.",
    }).addFields(
      { name: "Kanal", value: channel.name, inline: true },
      { name: "Bitrate", value: `${Math.round(channel.bitrate / 1000)} kbps`, inline: true },
      {
        name: "Limit",
        value: channel.userLimit === 0 ? "Limitsiz" : `${channel.userLimit}`,
        inline: true,
      },
      { name: "Sesteki üye", value: `${channel.members.size}`, inline: true },
      {
        name: "Giriş",
        value: everyonePublic ? "Herkese açık" : "Sadece davetliler",
        inline: true,
      },
      { name: "Gizli", value: hidden ? "Evet" : "Hayır", inline: true },
    );
    await message.reply({ embeds: [embed] }).catch(() => null);
    return true;
  }

  await message.reply({
    embeds: [
      warningEmbed({
        subsystem: "ses",
        title: "❓ Bilinmeyen Komut",
        description: "`owl stats` ile komutları hatırla.",
      }),
    ],
  }).catch(() => null);
  return true;
}
