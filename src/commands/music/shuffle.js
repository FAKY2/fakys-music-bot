import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "shuffle",
  aliases: ["mix"],
  description: "Shuffle everything waiting to play.",
  permission: Permission.Everyone,

  run: guarded([requireSameChannel], async (ctx, player) => {
    if (!player || player.queue.tracks.length < 2) {
      return ctx.reply(ui.notice("There's nothing much to shuffle yet."), { ephemeral: true });
    }

    await player.queue.shuffle();
    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(`${emoji("shuffle")} Shuffled **${player.queue.tracks.length} tracks**.`)
    );
  }),
};
