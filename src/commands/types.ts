import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/** discord.js alt komut kurucuları farklı sınıflar döndürür; hepsinde name + toJSON vardır. */
export type SlashCommandJsonable = {
  readonly name: string;
  toJSON(): ReturnType<SlashCommandBuilder["toJSON"]>;
};

export type SlashCommand = {
  data: SlashCommandJsonable;
  guildOnly?: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};
