import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { SOURCES } from "../../music/search.js";
import { enqueue, panelOrNotice } from "../../music/session.js";

export default {
  type: CommandType.Both,
  name: "play",
  aliases: ["p"],
  description: "Play a track, or add it to the queue. Takes a link or a few words.",
  permission: Permission.Everyone,

  options: [
    {
      name: "query",
      description: "A link, or what to search for.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "source",
      description: "Where to search. Ignored when you paste a link.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: Object.entries(SOURCES).map(([value, name]) => ({ name, value })),
    },
  ],

  async run(ctx) {
    const query = ctx.options?.getString("query") ?? ctx.args.join(" ");
    if (!query) {
      return ctx.reply(ui.notice("Give me something to play, a link or a few words."), {
        ephemeral: true,
      });
    }

    await ctx.defer();

    const added = await enqueue(ctx, query, { source: ctx.options?.getString("source") });
    if (added.error) return ctx.reply(ui.notice(added.error));

    return panelOrNotice(ctx, added);
  },
};
