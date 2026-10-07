import { CommandType, Permission } from "../core/command.js";
import { ui, Accent } from "../core/ui.js";
import { emoji } from "../music/emojis.js";

const GROUPS = [
  {
    title: "Playing",
    icon: "play",
    names: ["play", "playnext", "search", "player", "skip", "seek", "stop"],
  },
  {
    title: "The queue",
    icon: "queue",
    names: ["queue", "shuffle", "loop", "remove", "move", "clear", "autoplay"],
  },
  {
    title: "Sound",
    icon: "filter",
    names: ["volume", "filter", "lyrics"],
  },
  {
    title: "Yours to keep",
    icon: "heart",
    names: ["playlist", "favorite"],
  },
];

export default {
  type: CommandType.Both,
  name: "help",
  description: "List every command and how to trigger it.",
  permission: Permission.Everyone,

  run(ctx) {
    const commands = ctx.client.commands;
    const grouped = new Set(GROUPS.flatMap((group) => group.names));

    const rest = [...commands.values()].filter((command) => !grouped.has(command.name));

    const sections = GROUPS.map((group) => {
      const lines = group.names
        .map((name) => commands.get(name))
        .filter(Boolean)
        .map((command) => describe(command, ctx.config.prefix));

      return lines.length
        ? [ui.text(`### ${emoji(group.icon)} ${group.title}`), ui.text(...lines)]
        : [];
    }).flat();

    return ctx.reply(
      ui.container(
        Accent.primary,
        ui.text(`# ${emoji("music")} Commands`),
        ui.text("-# The panel does most of this with a button - these are for the rest."),
        ui.divider(),
        ...sections,
        rest.length > 0 && ui.divider(),
        rest.length > 0 && ui.text(`### ${emoji("disc")} Everything else`),
        rest.length > 0 && ui.text(...rest.map((command) => describe(command, ctx.config.prefix)))
      ),
      { ephemeral: true }
    );
  },
};

function describe(command, prefix) {
  const slash = command.type !== CommandType.Prefix ? `\`/${command.name}\`` : null;
  const text = command.type !== CommandType.Slash ? `\`${prefix}${command.name}\`` : null;

  const triggers = [slash, text].filter(Boolean).join(" or ");
  return `> ${triggers}\n-# ↳   *${command.description || "No description."}*`;
}
