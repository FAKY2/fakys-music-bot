import { ActivityType, Client, GatewayIntentBits, Partials } from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { config } from "./config.js";
import { Database } from "./data/Database.js";
import { loadFiles } from "./utils/loadFiles.js";
import { registerSlash } from "./handlers/registerSlash.js";
import { Router } from "./handlers/router.js";
import { createManager } from "../music/lavalink.js";

const here = dirname(fileURLToPath(import.meta.url));

export class EngineBot {
  constructor({ intents = [], partials = [], prefix = config.prefix } = {}) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        ...intents,
      ],
      partials: [Partials.Channel, ...partials],
      presence: {
        status: "dnd",
        activities: [{ name: "/help", type: ActivityType.Watching }],
      },
    });

    this.config = { ...config, prefix };

    this.db = new Database();
    this.router = new Router({ client: this.client, db: this.db, config: this.config });

    this.lavalink = createManager(this.client);
  }

  async start() {
    const settings = await import(
      pathToFileURL(join(here, "..", "..", "data", "database.js")).href
    )
      .then((loaded) => loaded.database)
      .catch(() => ({ driver: "auto" }));

    await this.db.init(settings);

    const [commands, components, events] = await Promise.all([
      loadFiles(join(here, "..", "commands")),
      loadFiles(join(here, "..", "components")),
      loadFiles(join(here, "..", "events")),
    ]);

    this.router.register(commands.filter((c) => c.name && c.run));
    this.router.registerComponents(components.filter((c) => c.id && c.run));
    this.bindEvents(events.filter((e) => e.name && e.run));

    this.client.commands = this.router.commands;

    await registerSlash(commands, this.config);

    this.router.listen();
    this.bindShutdown();
    await this.client.login(this.config.token);
  }

  bindEvents(events) {
    for (const event of events) {
      const handler = (...args) =>
        Promise.resolve(
          event.run(...args, { client: this.client, db: this.db, config: this.config })
        ).catch((error) => console.error(`Event "${event.name}" failed:`, error));

      if (event.once) this.client.once(event.name, handler);
      else this.client.on(event.name, handler);
    }
  }

  bindShutdown() {
    const stop = async () => {
      await Promise.all(
        [...this.lavalink.players.values()].map((player) =>
          player.destroy("The bot is shutting down.").catch(() => {})
        )
      );

      await this.db.close().catch(() => {});
      this.client.destroy();
      process.exit(0);
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }
}
