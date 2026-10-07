import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { view } from "../../music/track.js";
import { guarded, requirePlaying, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";
import { requireVote, clearVotes } from "../../music/vote.js";

export default {
  type: CommandType.Both,
  name: "skip",
  aliases: ["s", "next"],
  description: "Skip the current track, or several at once.",
  permission: Permission.Everyone,

  options: [
    {
      name: "count",
      description: "How many tracks to skip. One by default.",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: 1,
    },
  ],

  run: guarded([requirePlaying, requireSameChannel], async (ctx, player) => {
    const asked = ctx.options?.getInteger("count") ?? parseInt(ctx.args[0], 10);
    const count = Number.isFinite(asked) ? Math.max(1, asked) : 1;

    if (count > player.queue.tracks.length) {
      return ctx.reply(
        ui.notice(
          player.queue.tracks.length
            ? `Only ${player.queue.tracks.length} track(s) are waiting.`
            : "Nothing is waiting after this one. Use `/stop` to end the session."
        ),
        { ephemeral: true }
      );
    }

    const pending = requireVote(ctx, ctx.client, player, "skip");
    if (pending) {
      return ctx.reply(ui.notice(`${emoji("skip")} ${pending}`));
    }

    const skipped = view(player.queue.current);
    await player.skip(count);
    clearVotes(ctx.guild.id);

    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(
        count > 1
          ? `${emoji("skip")} Skipped **${count} tracks**.`
          : `${emoji("skip")} Skipped **${escape(skipped.title)}**.`
      )
    );
  }),
};
