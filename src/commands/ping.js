import { CommandType, Permission } from "../core/command.js";
import { ui } from "../core/ui.js";

export default {

  type: CommandType.Both,
  name: "ping",
  description: "Check that the bot is alive.",
  permission: Permission.Everyone,
  cooldown: 3,

  run(ctx) {
    const ms = Math.round(ctx.client.ws.ping);

    const mood = ms < 0 ? "still measuring" : ms < 150 ? "nice and snappy" : "a little sluggish today";

    return ctx.reply(ui.notice("# Pong!", `> I'm here. Gateway ping is **${ms}ms**, ${mood}.`));
  },
};
