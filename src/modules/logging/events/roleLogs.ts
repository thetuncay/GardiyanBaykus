import { AuditLogEvent, Events, type Client } from "discord.js";
import { LogService } from "../services/logService.js";
import { addBeforeAfter } from "./helpers.js";

export function registerRoleLogs(client: Client): void {
  client.on(Events.GuildRoleCreate, async (role) => {
    const audit = await LogService.fetchRelevantAuditEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
    const embed = LogService.createBaseEmbed("🆕 Role Created", 0x2ecc71).addFields(
      { name: "Role", value: `${role} (\`${role.id}\`)` },
      { name: "Color", value: `\`${role.hexColor}\``, inline: true },
      { name: "Mentionable", value: `\`${role.mentionable}\``, inline: true },
      { name: "Hoist", value: `\`${role.hoist}\``, inline: true },
      { name: "Position", value: `\`${role.position}\``, inline: true },
      {
        name: "Executor",
        value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
      },
    );
    await LogService.sendLog(role.guild, "roleLogs", embed, { eventType: "role_update" });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const audit = await LogService.fetchRelevantAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
    const embed = LogService.createBaseEmbed("🗑️ Role Deleted", 0xe74c3c).addFields({
      name: "Role",
      value: `\`${role.name}\` (\`${role.id}\`)`,
    });
    embed.addFields({
      name: "Executor",
      value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
    });
    await LogService.sendLog(role.guild, "roleLogs", embed, { eventType: "role_update" });
  });

  client.on(Events.GuildRoleUpdate, async (before, after) => {
    const changed =
      before.name !== after.name ||
      before.hexColor !== after.hexColor ||
      before.permissions.bitfield !== after.permissions.bitfield ||
      before.mentionable !== after.mentionable ||
      before.hoist !== after.hoist ||
      before.position !== after.position;
    if (!changed) return;
    const audit = await LogService.fetchRelevantAuditEntry(after.guild, AuditLogEvent.RoleUpdate, after.id);

    const embed = LogService.createBaseEmbed("✏️ Role Updated", 0xf1c40f).addFields({
      name: "Role",
      value: `${after} (\`${after.id}\`)`,
    });
    if (before.name !== after.name) addBeforeAfter(embed, before.name, after.name);
    if (before.hexColor !== after.hexColor) addBeforeAfter(embed, before.hexColor, after.hexColor);
    if (before.permissions.bitfield !== after.permissions.bitfield) {
      const diff = LogService.permissionDiff(before.permissions.bitfield, after.permissions.bitfield);
      addBeforeAfter(
        embed,
        before.permissions.toArray().join(", ") || "None",
        after.permissions.toArray().join(", ") || "None",
      );
      embed.addFields(
        {
          name: "Permissions Added",
          value: diff.added.length ? LogService.slice(diff.added.join(", "), 1024) : "None",
        },
        {
          name: "Permissions Removed",
          value: diff.removed.length ? LogService.slice(diff.removed.join(", "), 1024) : "None",
        },
      );
    }
    if (before.mentionable !== after.mentionable) {
      addBeforeAfter(embed, String(before.mentionable), String(after.mentionable));
    }
    if (before.hoist !== after.hoist) addBeforeAfter(embed, String(before.hoist), String(after.hoist));
    if (before.position !== after.position) addBeforeAfter(embed, String(before.position), String(after.position));
    embed.addFields({
      name: "Executor",
      value: audit?.executor ? LogService.formatActor(audit.executor) : "Unknown",
    });
    await LogService.sendLog(after.guild, "roleLogs", embed, { eventType: "role_update" });
  });
}
