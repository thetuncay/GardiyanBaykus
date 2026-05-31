import { Collection } from "discord.js";
import type { SlashCommand } from "./types.js";
import { coreCommands } from "../modules/core/commands/index.js";
import { moderationCommands } from "../modules/moderation/commands.js";
import { adminCommands } from "../modules/admin/commands.js";
import { giveawayCommands } from "../modules/giveaways/commands.js";
import { tempVoiceCommands } from "../modules/temp_voice/commands.js";
import { customCommands } from "../modules/custom_commands/commands.js";
import { loggingCommands } from "../modules/logging/commands/index.js";
import { ownerCommands } from "../modules/owner/commands.js";

export const allCommands: SlashCommand[] = [
  ...coreCommands,
  ...moderationCommands,
  ...adminCommands,
  ...giveawayCommands,
  ...tempVoiceCommands,
  ...customCommands,
  ...loggingCommands,
  ...ownerCommands,
];

export function loadCommandsIntoClient(
  set: Collection<string, SlashCommand>,
): void {
  set.clear();
  for (const cmd of allCommands) {
    set.set(cmd.data.name, cmd);
  }
}
