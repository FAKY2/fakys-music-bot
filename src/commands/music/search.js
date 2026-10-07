import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui, Accent } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { plain } from "../../music/queueView.js";
import { formatTime } from "../../music/card.js";
import { view } from "../../music/track.js";
import { SOURCES, suggestions } from "../../music/search.js";
import { ensurePlayer } from "../../music/session.js";
import { remember } from "../../music/searches.js";

export default {
  type: CommandType.Both,
  name: "search",
  aliases: ["find", "sc"],
  description: "Search and pick from the results before anything is queued.",
  permission: Permission.Everyone,

  options: [
    {
      name: "query",
      description: "What to search for.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "source",
      description: "Where to search.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: Object.entries(SOURCES).map(([value, name]) => ({ name, value })),
    },
  ],

  async run(ctx) {
    const query = ctx.options?.getString("query") ?? ctx.args.join(" ");
    if (!query) {
      return ctx.reply(ui.notice("Give me something to search for."), { ephemeral: true });
    }

    await ctx.defer();

    const ready = await ensurePlayer(ctx);
    if (ready.error) return ctx.reply(ui.notice(ready.error));

    const tracks = await suggestions(ready.player, query, ctx.user).catch(() => []);
    if (!tracks.length) return ctx.reply(ui.notice(`Nothing came back for **${escape(query)}**.`));

    const ticket = remember(ctx.guild.id, ctx.user.id, tracks);

    const lines = tracks.map((track, index) => {
      const item = view(track);
      const length = item.isLive ? "live" : formatTime(item.duration);
      return `\`${String(index + 1).padStart(2, " ")}.\` **${escape(item.title)}**\n-# ${escape(item.artist)} \`${length}\` - ${item.source}`;
    });

    return ctx.reply(
      ui.container(
        Accent.primary,
        ui.text(`### ${emoji("search")} Results for ${escape(query)}`),
        ui.divider(),
        ui.text(...lines),
        ui.divider(),
        ui.row(
          ui.select(
            `sr:pick:${ticket}`,
            "Pick a track to queue...",
            tracks.map((track, index) => {
              const item = view(track);
              return {
                label: plain(item.title, 100),
                value: String(index),
                description: plain(
                  `${item.artist} - ${item.isLive ? "live" : formatTime(item.duration)}`,
                  100
                ),
              };
            }),
            { max: Math.min(tracks.length, 5) }
          )
        )
      )
    );
  },
};
