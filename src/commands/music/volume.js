import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

export default {
  type: CommandType.Both,
  name: "volume",
  aliases: ["vol", "v"],
  description: "Set the volume, 0 to 200.",
  permission: Permission.Everyone,

  options: [
    {
      name: "level",
      description: "0 to 200. Leave empty to read the current one.",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: 0,
      max_value: 200,
    },
  ],

  run: guarded([requireSameChannel], async (ctx, player) => {
    if (!player) {
      return ctx.reply(ui.notice("Nothing is playing right now."), { ephemeral: true });
    }

    const asked = ctx.options?.getInteger("level") ?? parseInt(ctx.args[0], 10);

    if (!Number.isFinite(asked)) {
      return ctx.reply(
        ui.notice(`${emoji("volume")} The volume is at **${player.volume}%**.`),
        { ephemeral: true }
      );
    }

    const level = Math.max(0, Math.min(200, asked));
    await player.setVolume(level);
    repaint(ctx.guild.id);

    return ctx.reply(
      ui.notice(`${emoji(level === 0 ? "mute" : "volume")} Volume set to **${level}%**.`)
    );
  }),
};
