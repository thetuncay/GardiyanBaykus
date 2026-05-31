import type { SlashCommand } from "../../../commands/types.js";
import { logCommand } from "./log.js";
import { setupLoggingCommand } from "./setup.js";

export const loggingCommands: SlashCommand[] = [setupLoggingCommand, logCommand];
