import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { view } from "../../music/track.js";
import { enqueue, panelOrNotice } from "../../music/session.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "playnext",
  aliases: ["pn", "playtop"],
  description: "Add a track to the front of the queue.",
  permission: Permission.Everyone,

  options: [
    {
      name: "query",
      description: "A link, or what to search for.",
      type: ApplicationCommandOptionType.String,
      required: true,
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

    const added = await enqueue(ctx, query, { next: true });
    if (added.error) return ctx.reply(ui.notice(added.error));

    if (added.wasIdle) return panelOrNotice(ctx, added);

    repaint(ctx.guild.id);

    const track = view(added.tracks[0]);
    return ctx.reply(
      ui.notice(
        added.tracks.length === 1
          ? `${emoji("queue")} Playing next: **${escape(track.title)}** - *${escape(track.artist)}*`
          : `${emoji("queue")} Added **${added.tracks.length} tracks** to the front of the queue`,
        "-# It starts as soon as this one ends."
      )
    );
  },
};
