import { MessageFlags } from "discord.js";
import { send } from "./ui.js";

export class Context {
  constructor({ client, db, config, guild, channel, user, member, args, options, source }) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.guild = guild;
    this.channel = channel;
    this.user = user;
    this.member = member;
    this.args = args || [];
    this.options = options || null;

    this.source = source;
  }

  static fromInteraction(interaction, { client, db, config }) {
    return new Context({
      client,
      db,
      config,
      guild: interaction.guild,
      channel: interaction.channel,
      user: interaction.user,
      member: interaction.member,
      options: interaction.options,
      source: interaction,
    });
  }

  static fromMessage(message, args, { client, db, config }) {
    return new Context({
      client,
      db,
      config,
      guild: message.guild,
      channel: message.channel,
      user: message.author,
      member: message.member,
      args,
      source: message,
    });
  }

  reply(view, opts) {
    return send(this.source, view, opts);
  }

  defer({ ephemeral = false } = {}) {
    if (typeof this.source.deferReply === "function") {
      return this.source.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    }
    return this.channel.sendTyping();
  }
}
