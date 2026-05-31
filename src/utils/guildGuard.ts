/**
 * Sunucu izin kontrolü — interaction handler'larında kullanılır.
 * İzinsiz sunucuda komutu çalıştırmaya çalışan kullanıcıya ephemeral hata döner.
 */
import type { Interaction } from "discord.js";
import { isGuildAllowed } from "../services/allowedGuildCache.js";
import { warningEmbed } from "./embeds.js";

export async function checkGuildAllowed(interaction: Interaction): Promise<boolean> {
  if (!interaction.guildId) return true; // DM — guild guard geçerli değil
  const allowed = await isGuildAllowed(interaction.guildId);
  if (allowed) return true;

  if (interaction.isRepliable()) {
    await interaction
      .reply({
        embeds: [
          warningEmbed({
            subsystem: "bilgelik",
            title: "🚫 Yetkisiz Sunucu",
            description:
              "Bu sunucu BilgeBaykuş kullanımı için henüz onaylanmamış.\nBot sahibiyle iletişime geç.",
          }),
        ],
        ephemeral: true,
      })
      .catch(() => null);
  }
  return false;
}
