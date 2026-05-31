import { Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

export function registerEmojiStickerLogs(client: Client): void {
  client.on(Events.GuildEmojiCreate, async (emoji) => {
    const embed = LogService.createBaseEmbed("😀 Emoji Created", 0x2ecc71).addFields(
      { name: "Emoji", value: `${emoji.toString()} (\`${emoji.id}\`)` },
      { name: "Name", value: `\`${emoji.name ?? "unknown"}\`` },
      { name: "Animated", value: `\`${emoji.animated}\`` },
    );
    await LogService.sendLog(emoji.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });

  client.on(Events.GuildEmojiDelete, async (emoji) => {
    const embed = LogService.createBaseEmbed("🗑️ Emoji Deleted", 0xe74c3c).addFields({
      name: "Emoji",
      value: `\`${emoji.name ?? "unknown"}\` (\`${emoji.id}\`)`,
    });
    await LogService.sendLog(emoji.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });

  client.on(Events.GuildEmojiUpdate, async (before, after) => {
    if (before.name === after.name) return;
    const embed = LogService.createBaseEmbed("✏️ Emoji Updated", 0xf1c40f).addFields({
      name: "Emoji ID",
      value: `\`${after.id}\``,
    });
    addBeforeAfter(embed, before.name, after.name);
    await LogService.sendLog(after.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });

  client.on(Events.GuildStickerCreate, async (sticker) => {
    if (!sticker.guild) return;
    const embed = LogService.createBaseEmbed("🆕 Sticker Created", 0x2ecc71).addFields(
      { name: "Name", value: `\`${sticker.name}\`` },
      { name: "ID", value: `\`${sticker.id}\`` },
      { name: "Description", value: LogService.slice(sticker.description ?? "None", 1024) },
    );
    await LogService.sendLog(sticker.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });

  client.on(Events.GuildStickerDelete, async (sticker) => {
    if (!sticker.guild) return;
    const embed = LogService.createBaseEmbed("🗑️ Sticker Deleted", 0xe74c3c).addFields(
      { name: "Name", value: `\`${sticker.name}\`` },
      { name: "ID", value: `\`${sticker.id}\`` },
    );
    await LogService.sendLog(sticker.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });

  client.on(Events.GuildStickerUpdate, async (before, after) => {
    if (!after.guild) return;
    if (before.name === after.name && before.description === after.description) return;
    const embed = LogService.createBaseEmbed("✏️ Sticker Updated", 0xf1c40f).addFields({
      name: "Sticker",
      value: `\`${after.name}\` (\`${after.id}\`)`,
    });
    if (before.name !== after.name) addBeforeAfter(embed, before.name, after.name);
    if (before.description !== after.description) {
      addBeforeAfter(embed, before.description ?? "None", after.description ?? "None");
    }
    await LogService.sendLog(after.guild, "emojiStickerLogs", embed, { eventType: "emoji" });
  });
}
