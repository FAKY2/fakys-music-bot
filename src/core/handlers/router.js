import { CommandType } from "../command.js";
import { Context } from "../context.js";
import { isAllowed } from "./permissions.js";
import { ui, send } from "../ui.js";
import { isDead } from "../utils/respond.js";

export class Router {
  constructor({ client, db, config }) {
    this.client = client;
    this.db = db;
    this.config = config;

    this.commands = new Map();
    this.aliases = new Map();

    this.components = new Map();

    this.cooldowns = new Map();
  }

  register(commands) {
    for (const command of commands) {
      this.commands.set(command.name, command);
      for (const alias of command.aliases || []) {
        this.aliases.set(alias, command);
      }
    }
  }

  registerComponents(handlers) {
    for (const handler of handlers) {
      this.components.set(handler.id, handler);
    }
  }

  listen() {
    this.client.on("interactionCreate", (interaction) => this.onInteraction(interaction));
    this.client.on("messageCreate", (message) => this.onMessage(message));
  }

  async onInteraction(interaction) {
    if (interaction.isChatInputCommand()) return this.onSlash(interaction);
    if (interaction.isAutocomplete()) return this.onAutocomplete(interaction);

    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      return this.onComponent(interaction);
    }
  }

  async onSlash(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    if (!isAllowed(command, interaction.member)) return this.refuse(interaction);

    const wait = this.onCooldown(command, interaction.user.id);
    if (wait) return this.coolOff(interaction, wait);

    const ctx = Context.fromInteraction(interaction, this);
    await this.run(command, ctx, interaction);
  }

  async onAutocomplete(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, { client: this.client, db: this.db });
    } catch (error) {
      console.error(`Autocomplete for "${command.name}" failed:`, error);
    }
  }

  async onComponent(interaction) {
    let key = interaction.customId;

    while (true) {
      const handler = this.components.get(key);
      if (handler) {
        try {
          await handler.run(interaction, {
            client: this.client,
            db: this.db,
            config: this.config,
            parts: interaction.customId.split(":"),
          });
        } catch (error) {
          console.error(`Component "${handler.id}" failed:`, error);
          this.fail(interaction);
        }
        return;
      }

      const cut = key.lastIndexOf(":");
      if (cut === -1) return;
      key = key.slice(0, cut);
    }
  }

  async onMessage(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(this.config.prefix)) return;

    const withoutPrefix = message.content.slice(this.config.prefix.length).trim();
    const [name, ...args] = withoutPrefix.split(/\s+/);

    const command = this.commands.get(name) || this.aliases.get(name);
    if (!command) return;

    if (command.type === CommandType.Slash) return;

    if (!isAllowed(command, message.member)) return this.refuse(message);

    const wait = this.onCooldown(command, message.author.id);
    if (wait) return this.coolOff(message, wait);

    const ctx = Context.fromMessage(message, args, this);
    await this.run(command, ctx, message);
  }

  onCooldown(command, userId) {
    if (!command.cooldown) return 0;

    let users = this.cooldowns.get(command.name);
    if (!users) {
      users = new Map();
      this.cooldowns.set(command.name, users);
    }

    const now = Date.now();
    const until = users.get(userId);

    if (until && until > now) return Math.ceil((until - now) / 1000);

    users.set(userId, now + command.cooldown * 1000);
    return 0;
  }

  async run(command, ctx, source) {
    try {
      await command.run(ctx);
    } catch (error) {
      if (isDead(error)) {
        return console.warn(`Command "${command.name}": interaction expired before I could answer (${error.code}).`);
      }
      console.error(`Command "${command.name}" failed:`, error);
      this.fail(source);
    }
  }

  refuse(source) {
    return this.notice(source, "Hold on", "You don't have permission to use that one.");
  }

  coolOff(source, seconds) {
    return this.notice(source, "Easy there", `Give it **${seconds}s** and try that again.`);
  }

  fail(source) {
    return this.notice(source, "Oops, that broke", "Something went wrong on my end. I've logged it.");
  }

  notice(source, title, body) {
    return Promise.resolve(
      send(source, ui.notice(`# ${title}`, `> ${body}`), { ephemeral: true })
    ).catch(() => {});
  }
}
