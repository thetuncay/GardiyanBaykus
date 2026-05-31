import { ChannelType, Events, type Client, type Message } from "discord.js";
import { runAutomod } from "../modules/moderation/automod.js";
import { handleOwlTempVoiceCommand } from "../modules/temp_voice/panel.js";
import { createLogger } from "../services/logger.js";

const log = createLogger("message");

export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (!message.guild || message.author.bot) return;
      if (message.channel.type === ChannelType.GuildVoice) {
        if (await handleOwlTempVoiceCommand(message)) return;
      }
      if (await runAutomod(message)) return;
    } catch (e) {
      log.error("MessageCreate hata", { err: String(e) });
    }
  });
}
