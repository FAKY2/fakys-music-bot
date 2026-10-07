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
  name: "remove",
  aliases: ["rm", "delete"],
  description: "Drop a waiting track by its position in the queue.",
  permission: Permission.Everyone,

  options: [
    {
      name: "position",
      description: "Its number in the queue.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
    },
  ],

  run: guarded([requireSameChannel], async (ctx, player) => {
    const asked = ctx.options?.getInteger("position") ?? parseInt(ctx.args[0], 10);
    const index = Number.isFinite(asked) ? asked - 1 : -1;

    if (!player || index < 0 || index >= player.queue.tracks.length) {
      return ctx.reply(ui.notice(`There's no track at position **${asked}**.`), {
        ephemeral: true,
      });
    }

    const track = view(player.queue.tracks[index]);
    await player.queue.splice(index, 1);
    repaint(ctx.guild.id);

    return ctx.reply(ui.notice(`${emoji("queue")} Removed **${escape(track.title)}**.`));
  }),
};
