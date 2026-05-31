import { Events, type Client, type VoiceState } from "discord.js";
import { dispatchLog } from "../core/logService.js";

const joinedAtMap = new Map<string, number>();
const voiceDebounce = new Map<string, number>();
const voiceBatch = new Map<
  string,
  {
    before: VoiceState;
    after: VoiceState;
    timer: ReturnType<typeof setTimeout>;
  }
>();
const DEBOUNCE_MS = 600;
const BATCH_MS = 900;

function shouldDebounce(key: string): boolean {
  const now = Date.now();
  const prev = voiceDebounce.get(key) ?? 0;
  voiceDebounce.set(key, now);
  return now - prev < DEBOUNCE_MS;
}

export function registerVoiceEvents(client: Client): void {
  client.on(Events.GuildDelete, (guild) => {
    for (const key of joinedAtMap.keys()) {
      if (key.startsWith(`${guild.id}:`)) joinedAtMap.delete(key);
    }
    for (const [key, row] of voiceBatch) {
      if (key.startsWith(`${guild.id}:`)) {
        clearTimeout(row.timer);
        voiceBatch.delete(key);
      }
    }
  });

  async function flushVoiceBatch(before: VoiceState, after: VoiceState): Promise<void> {
    const user = after.member?.user ?? before.member?.user;
    const guild = after.guild ?? before.guild;
    if (!guild || !user) return;

    const key = `${guild.id}:${user.id}`;
    const stateFingerprint = `${before.channelId}:${after.channelId}:${before.selfMute}:${after.selfMute}:${before.selfDeaf}:${after.selfDeaf}:${before.streaming}:${after.streaming}:${before.selfVideo}:${after.selfVideo}:${before.serverMute}:${after.serverMute}:${before.serverDeaf}:${after.serverDeaf}`;
    if (shouldDebounce(`${key}:${stateFingerprint}`)) return;

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    let title = "🔊 Ses Durumu Güncellendi";
    let eventType = "voice_update";

    if (before.channelId !== after.channelId) {
      if (!before.channelId && after.channelId) {
        title = "🔊 Ses Kanalına Katıldı";
        eventType = "voice_join";
        joinedAtMap.set(key, Date.now());
        fields.push({ name: "Kanal", value: `<#${after.channelId}>`, inline: false });
      } else if (before.channelId && !after.channelId) {
        title = "🔇 Ses Kanalından Ayrıldı";
        eventType = "voice_leave";
        fields.push({ name: "Kanal", value: `<#${before.channelId}>`, inline: false });
        const joinedAt = joinedAtMap.get(key);
        joinedAtMap.delete(key);
        if (joinedAt) {
          fields.push({
            name: "Süre",
            value: `${Math.floor((Date.now() - joinedAt) / 1000)} sn`,
            inline: true,
          });
        }
      } else {
        title = "🔁 Ses Kanalı Değişti";
        eventType = "voice_move";
        fields.push(
          { name: "Önce", value: `<#${before.channelId}>`, inline: true },
          { name: "Sonra", value: `<#${after.channelId}>`, inline: true },
        );
      }
    }

    if (before.serverMute !== after.serverMute || before.serverDeaf !== after.serverDeaf) {
      fields.push({
        name: "Sunucu Mute/Deaf",
        value: `Mute: \`${before.serverMute}\` → \`${after.serverMute}\`\nDeaf: \`${before.serverDeaf}\` → \`${after.serverDeaf}\``,
        inline: false,
      });
    }

    if (before.selfMute !== after.selfMute || before.selfDeaf !== after.selfDeaf) {
      fields.push({
        name: "Kendi Mute/Deaf",
        value: `Mute: \`${before.selfMute}\` → \`${after.selfMute}\`\nDeaf: \`${before.selfDeaf}\` → \`${after.selfDeaf}\``,
        inline: false,
      });
    }

    if (before.streaming !== after.streaming || before.selfVideo !== after.selfVideo) {
      fields.push({
        name: "Yayın/Kamera",
        value: `Yayın: \`${before.streaming}\` → \`${after.streaming}\`\nKamera: \`${before.selfVideo}\` → \`${after.selfVideo}\``,
        inline: false,
      });
    }

    if (!fields.length) return;

    await dispatchLog(guild, {
      guildId: guild.id,
      eventType,
      action: "UPDATE",
      category: "voice",
      title,
      channelId: after.channelId ?? before.channelId,
      actor: {
        id: user.id,
        tag: user.tag,
        mention: `${user}`,
        avatarUrl: user.displayAvatarURL(),
        isBot: user.bot,
      },
      target: { id: user.id, label: "Üye", mention: `${user}` },
      fields,
    });
  }

  client.on(Events.VoiceStateUpdate, async (before: VoiceState, after: VoiceState) => {
    const guild = after.guild ?? before.guild;
    const user = after.member?.user ?? before.member?.user;
    if (!guild || !user) return;
    const key = `${guild.id}:${user.id}`;

    const pending = voiceBatch.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      pending.after = after;
      pending.timer = setTimeout(() => {
        void flushVoiceBatch(pending.before, pending.after);
        voiceBatch.delete(key);
      }, BATCH_MS);
      return;
    }

    const timer = setTimeout(() => {
      const row = voiceBatch.get(key);
      if (!row) return;
      void flushVoiceBatch(row.before, row.after);
      voiceBatch.delete(key);
    }, BATCH_MS);
    voiceBatch.set(key, { before, after, timer });
  });
}
