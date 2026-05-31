import { PermissionsBitField, type GuildMember, type User } from "discord.js";

export function formatUser(user: User): string {
  return `${user} (\`${user.tag}\`) • \`${user.id}\``;
}

export function formatActor(actor: { id: string; tag?: string; mention?: string }): string {
  const mention = actor.mention ?? `<@${actor.id}>`;
  const tag = actor.tag ? ` (\`${actor.tag}\`)` : "";
  return `${mention}${tag} • \`${actor.id}\``;
}

export function slice(value: string | null | undefined, max = 1000): string {
  if (!value) return "Yok";
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

export function listOrFallback(values: string[], fallback = "Yok"): string {
  if (!values.length) return fallback;
  return slice(values.join(", "), 1024);
}

export function chunkText(value: string | null | undefined, size = 1000): string[] {
  if (!value) return ["Yok"];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks.length ? chunks : ["Yok"];
}

export function extractLinks(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s)]+/g) ?? [];
  return [...new Set(matches)];
}

export function unixTime(ms: number | Date): string {
  const millis = typeof ms === "number" ? ms : ms.getTime();
  const sec = Math.floor(millis / 1000);
  return `<t:${sec}:F> (<t:${sec}:R>)`;
}

export function formatRoleSnapshot(member: GuildMember | null): string {
  if (!member) return "Bilinmiyor";
  const roles = member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => `${role} (\`${role.id}\`)`);
  return roles.length ? slice(roles.join("\n"), 1024) : "Rol yok";
}

export function permissionDiff(before: bigint, after: bigint): { added: string[]; removed: string[] } {
  const beforePerms = new Set(new PermissionsBitField(before).toArray());
  const afterPerms = new Set(new PermissionsBitField(after).toArray());
  const added = [...afterPerms].filter((perm) => !beforePerms.has(perm));
  const removed = [...beforePerms].filter((perm) => !afterPerms.has(perm));
  return { added, removed };
}

export function toInlineBool(value: boolean | null | undefined): string {
  if (value == null) return "Bilinmiyor";
  return value ? "Evet" : "Hayır";
}
