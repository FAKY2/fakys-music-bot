import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { FILTERS, applyFilter, activeFilters } from "../../music/filters.js";
import { guarded, requirePlaying, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "filter",
  aliases: ["fx", "effect"],
  description: "Colour the sound: bass boost, nightcore, 8D and more.",
  permission: Permission.Everyone,

  options: [
    {
      name: "name",
      description: "Which filter to apply. Leave empty to see what's on.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: Object.entries(FILTERS)
        .slice(0, 25)
        .map(([value, filter]) => ({ name: filter.label, value })),
    },
  ],

  run: guarded([requirePlaying, requireSameChannel], async (ctx, player) => {
    const asked = (ctx.options?.getString("name") ?? ctx.args[0])?.toLowerCase();

    if (!asked) {
      const active = activeFilters(player);
      return ctx.reply(
        ui.notice(
          active.length
            ? `${emoji("filter")} Running: **${active.join(", ")}**`
            : `${emoji("filter")} No filter is on.`,
          `-# Pick one of: ${Object.keys(FILTERS).join(", ")}`
        ),
        { ephemeral: true }
      );
    }

    if (!FILTERS[asked]) {
      return ctx.reply(
        ui.notice(
          `**${asked}** isn't a filter I know.`,
          `-# Pick one of: ${Object.keys(FILTERS).join(", ")}`
        ),
        { ephemeral: true }
      );
    }

    await ctx.defer();

    const applied = await applyFilter(player, asked);
    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(
        asked === "clear"
          ? `${emoji("filter")} Filters cleared.`
          : `${emoji("filter")} **${applied.label}** - ${applied.description}`,
        "-# It takes a second or two to settle in."
      )
    );
  }),
};
