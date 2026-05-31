import { Events, type Client, type VoiceState } from "discord.js";
import { handleVoiceState } from "../modules/temp_voice/service.js";
import { createLogger } from "../services/logger.js";

const log = createLogger("voice");

export function registerVoiceStateUpdate(client: Client): void {
  client.on(Events.VoiceStateUpdate, async (oldS: VoiceState, newS: VoiceState) => {
    try {
      await handleVoiceState(oldS, newS);
    } catch (e) {
      log.error("VoiceStateUpdate hata", { err: String(e) });
    }
  });
}
