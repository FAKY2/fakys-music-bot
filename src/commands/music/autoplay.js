import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { getState } from "../../music/state.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "autoplay",
  aliases: ["ap"],
  description: "Keep playing similar tracks when the queue runs out.",
  permission: Permission.Everyone,

  run: guarded([requireSameChannel], async (ctx) => {
    const state = getState(ctx.guild.id);
    state.autoplay = !state.autoplay;

    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(
        state.autoplay
          ? `${emoji("autoplay")} Autoplay is **on** - I'll keep the music going on my own.`
          : `${emoji("autoplay")} Autoplay is **off** - I'll stop when the queue runs out.`
      )
    );
  }),
};
