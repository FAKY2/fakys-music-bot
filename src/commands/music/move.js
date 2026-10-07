import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { view } from "../../music/track.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "move",
  aliases: ["mv"],
  description: "Move a waiting track to another spot in the queue.",
  permission: Permission.Everyone,

  options: [
    {
      name: "from",
      description: "The track's current position.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
    },
    {
      name: "to",
      description: "Where it should go.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
    },
  ],

  run: guarded([requireSameChannel], async (ctx, player) => {
    const from = (ctx.options?.getInteger("from") ?? parseInt(ctx.args[0], 10)) - 1;
    const to = (ctx.options?.getInteger("to") ?? parseInt(ctx.args[1], 10)) - 1;
    const waiting = player?.queue.tracks.length ?? 0;

    if (!waiting || !Number.isFinite(from) || from < 0 || from >= waiting) {
      return ctx.reply(ui.notice(`There's no track at position **${from + 1}**.`), {
        ephemeral: true,
      });
    }

    const target = Math.max(0, Math.min(Number.isFinite(to) ? to : 0, waiting - 1));
    const track = player.queue.tracks[from];

    await player.queue.splice(from, 1);
    await player.queue.splice(target, 0, track);
    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(
        `${emoji("queue")} Moved **${escape(view(track).title)}** to position **${target + 1}**.`
      )
    );
  }),
};
