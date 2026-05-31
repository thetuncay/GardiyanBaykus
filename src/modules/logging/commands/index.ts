import type { SlashCommand } from "../../../commands/types.js";
import { setupLoggingCommand } from "./setup.js";

export const loggingCommands: SlashCommand[] = [setupLoggingCommand];
