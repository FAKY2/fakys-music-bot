import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";
import { requireVote, clearVotes } from "../../music/vote.js";

export default {
  type: CommandType.Both,
  name: "clear",
  aliases: ["empty", "cls"],
  description: "Empty the queue without stopping what's playing.",
  permission: Permission.Everyone,

  run: guarded([requireSameChannel], async (ctx, player) => {
    const waiting = player?.queue.tracks.length ?? 0;
    if (!waiting) {
      return ctx.reply(ui.notice("The queue is already empty."), { ephemeral: true });
    }

    const pending = requireVote(ctx, ctx.client, player, "clear");
    if (pending) return ctx.reply(ui.notice(`${emoji("queue")} ${pending}`));

    await player.queue.splice(0, waiting);
    clearVotes(ctx.guild.id);
    repaint(ctx.guild.id);

    return ctx.reply(ui.notice(`${emoji("queue")} Cleared **${waiting} tracks** from the queue.`));
  }),
};
