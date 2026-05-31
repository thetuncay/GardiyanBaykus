import type { Client } from "discord.js";
import { registerReady } from "./ready.js";
import { registerInteractionCreate } from "./interactionCreate.js";
import { registerMessageCreate } from "./messageCreate.js";
import { registerVoiceStateUpdate } from "./voiceStateUpdate.js";
import { registerLoggingEvents } from "../modules/logging/events/index.js";

/**
 * Tüm Discord olayları tek giriş noktasından kayıt edilir.
 * (Önerilen klasör ayrımı: logging modülü içinde events/, çekirdek olaylar burada.)
 */
export function registerAllEvents(client: Client): void {
  registerReady(client);
  registerInteractionCreate(client);
  registerMessageCreate(client);
  registerVoiceStateUpdate(client);
  registerLoggingEvents(client);
}
