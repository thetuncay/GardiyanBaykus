import type { Client } from "discord.js";
import { registerMessageEvents } from "./messageEvents.js";
import { registerMemberEvents } from "./memberEvents.js";
import { registerVoiceEvents } from "./voiceEvents.js";
import { registerMiscEvents } from "./miscEvents.js";

export function registerLoggingEvents(client: Client): void {
  registerMessageEvents(client);
  registerMemberEvents(client);
  registerVoiceEvents(client);
  registerMiscEvents(client);
}
