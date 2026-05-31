import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { loadEnv } from "./config/env.js";
import { configureLoggerFromEnv, createLogger } from "./services/logger.js";
import { connectMongo, disconnectMongo } from "./database/connection.js";
import { connectRedis, disconnectRedis } from "./services/redis.js";
import { loadCommandsIntoClient } from "./commands/registry.js";
import { registerAllEvents } from "./events/index.js";
import { startUptimeServer } from "./services/uptime.js";
import "./types/client.js";

const log = createLogger("boot");
const env = loadEnv();
configureLoggerFromEnv(env);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.commands = new Collection();
loadCommandsIntoClient(client.commands);
registerAllEvents(client);
startUptimeServer();

async function boot(): Promise<void> {
  await connectMongo(env.MONGODB_URI);
  await connectRedis(env.REDIS_URL);
  await client.login(env.DISCORD_TOKEN);
}

boot().catch((e) => {
  log.error("Başlatılamadı", { err: String(e) });
  process.exit(1);
});

async function shutdown(): Promise<void> {
  client.destroy();
  await disconnectRedis();
  await disconnectMongo();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log.info(`Sinyal ${sig} — kapanıyor`);
    void shutdown().then(() => process.exit(0));
  });
}
