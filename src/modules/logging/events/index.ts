import type { Client } from "discord.js";
import { registerMemberLogs } from "./memberLogs.js";
import { registerMessageLogs } from "./messageLogs.js";
import { registerModerationLogs } from "./moderationLogs.js";
import { registerVoiceLogs } from "./voiceLogs.js";
import { registerRoleLogs } from "./roleLogs.js";
import { registerChannelLogs } from "./channelLogs.js";
import { registerServerLogs } from "./serverLogs.js";
import { registerInviteLogs } from "./inviteLogs.js";
import { registerEmojiStickerLogs } from "./emojiStickerLogs.js";
import { registerAdvancedLogs } from "./advancedLogs.js";

export function registerLoggingEvents(client: Client): void {
  registerMemberLogs(client);
  registerMessageLogs(client);
  registerModerationLogs(client);
  registerVoiceLogs(client);
  registerRoleLogs(client);
  registerChannelLogs(client);
  registerServerLogs(client);
  registerInviteLogs(client);
  registerEmojiStickerLogs(client);
  registerAdvancedLogs(client);
}
