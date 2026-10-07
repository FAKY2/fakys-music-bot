import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { guarded, requireSameChannel } from "../../music/guard.js";
import { repaint } from "../../music/repaint.js";

const MODES = ["off", "track", "queue"];

const SAID = {
  off: "Repeat is **off**.",
  track: "Repeating **this track**.",
  queue: "Repeating **the whole queue**.",
};

export default {
  type: CommandType.Both,
  name: "loop",
  aliases: ["repeat", "l"],
  description: "Repeat nothing, the track, or the whole queue.",
  permission: Permission.Everyone,

  options: [
    {
      name: "mode",
      description: "What to repeat. Cycles to the next one when left empty.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "Off", value: "off" },
        { name: "This track", value: "track" },
        { name: "The queue", value: "queue" },
      ],
    },
  ],

  run: guarded([requireSameChannel], async (ctx, player) => {
    if (!player) {
      return ctx.reply(ui.notice("Nothing is playing right now."), { ephemeral: true });
    }

    const asked = (ctx.options?.getString("mode") ?? ctx.args[0])?.toLowerCase();
    const mode = MODES.includes(asked)
      ? asked
      : MODES[(MODES.indexOf(player.repeatMode) + 1) % MODES.length];

    await player.setRepeatMode(mode);
    repaint(ctx.guild.id);

    return ctx.reply(ui.notice(`${emoji("loop")} ${SAID[mode]}`));
  }),
};
