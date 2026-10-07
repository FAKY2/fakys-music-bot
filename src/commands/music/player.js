import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { getPlayer } from "../../music/lavalink.js";
import { getState } from "../../music/state.js";
import { movePanel } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "player",
  aliases: ["panel", "controls", "np", "nowplaying"],
  description: "Show the player panel here.",
  permission: Permission.Everyone,

  async run(ctx) {
    const player = getPlayer(ctx.guild.id);

    if (!player?.queue.current && !player?.queue.tracks.length) {
      return ctx.reply(ui.notice("Nothing is playing. Start something with `/play`."), {
        ephemeral: true,
      });
    }

    await ctx.defer();

    const state = getState(ctx.guild.id);
    state.channelId = ctx.channel.id;

    await movePanel(player, state, (payload) => ctx.reply(payload));
  },
};
