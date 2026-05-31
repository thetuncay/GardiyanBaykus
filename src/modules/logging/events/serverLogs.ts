import { Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

export function registerServerLogs(client: Client): void {
  client.on(Events.GuildUpdate, async (before, after) => {
    const changed =
      before.name !== after.name ||
      before.icon !== after.icon ||
      before.vanityURLCode !== after.vanityURLCode ||
      before.verificationLevel !== after.verificationLevel;
    if (!changed) return;
    const embed = LogService.createBaseEmbed("🏰 Server Updated", 0x9b59b6).addFields({
      name: "Guild",
      value: `${after.name} (\`${after.id}\`)`,
    });
    if (before.name !== after.name) addBeforeAfter(embed, before.name, after.name);
    if (before.vanityURLCode !== after.vanityURLCode) {
      addBeforeAfter(embed, before.vanityURLCode ?? "None", after.vanityURLCode ?? "None");
    }
    if (before.verificationLevel !== after.verificationLevel) {
      addBeforeAfter(embed, String(before.verificationLevel), String(after.verificationLevel));
    }
    if (before.icon !== after.icon) {
      embed.addFields({
        name: "Icon",
        value: `Before: ${before.iconURL() ?? "None"}\nAfter: ${after.iconURL() ?? "None"}`,
      });
    }
    await LogService.sendLog(after, "serverLogs", embed, { eventType: "server_update" });
  });
}
