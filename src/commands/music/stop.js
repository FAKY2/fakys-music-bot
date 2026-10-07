import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint, unwatch } from "../../music/repaint.js";
import { requireVote, clearVotes } from "../../music/vote.js";

export default {
  type: CommandType.Both,
  name: "stop",
  aliases: ["leave", "disconnect", "dc"],
  description: "Stop the music, empty the queue and leave the channel.",
  permission: Permission.Everyone,

  run: guarded([requireSameChannel], async (ctx, player) => {
    if (!player) {
      return ctx.reply(ui.notice("I'm not playing anything."), { ephemeral: true });
    }

    const pending = requireVote(ctx, ctx.client, player, "stop");
    if (pending) return ctx.reply(ui.notice(`${emoji("stop")} ${pending}`));

    await player.destroy("The session was stopped.");
    clearVotes(ctx.guild.id);
    unwatch(ctx.guild.id);
    repaint(ctx.guild.id);

    return ctx.reply(ui.notice(`${emoji("stop")} Stopped, and out of the channel.`));
  }),
};
