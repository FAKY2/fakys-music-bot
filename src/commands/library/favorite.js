import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui, Accent } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { formatTime, formatLong } from "../../music/card.js";
import { getPlayer } from "../../music/lavalink.js";
import { ensurePlayer, panelOrNotice } from "../../music/session.js";
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  restore,
  totalDuration,
} from "../../music/library.js";

export default {
  type: CommandType.Both,
  name: "favorite",
  aliases: ["fav", "f"],
  description: "Keep the tracks you love, and play them back any time.",
  permission: Permission.Everyone,

  options: [
    {
      name: "add",
      description: "Save the current track to your favorites.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "list",
      description: "Show your favorites.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "play",
      description: "Queue your favorites.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "position",
          description: "One track by its number. Leave empty for all of them.",
          type: ApplicationCommandOptionType.Integer,
          required: false,
          min_value: 1,
        },
      ],
    },
    {
      name: "remove",
      description: "Drop one track from your favorites.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "position",
          description: "Its number in your favorites.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          min_value: 1,
        },
      ],
    },
  ],

  async run(ctx) {
    const action = ctx.options?.getSubcommand(false) ?? ctx.args[0]?.toLowerCase() ?? "list";

    if (action === "add") return onAdd(ctx);
    if (action === "list") return onList(ctx);
    if (action === "play") return onPlay(ctx);
    if (action === "remove") return onRemove(ctx);

    return ctx.reply(
      ui.notice(
        `**${escape(action)}** isn't something I can do here.`,
        "-# Try `add`, `list`, `play` or `remove`."
      ),
      { ephemeral: true }
    );
  },
};

async function onAdd(ctx) {
  const player = getPlayer(ctx.guild.id);
  if (!player?.queue.current) {
    return ctx.reply(ui.notice("Nothing is playing right now."), { ephemeral: true });
  }

  const { track, count, error } = await addFavorite(ctx.user.id, player.queue.current);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(
    ui.notice(
      `${emoji("heart")} Saved **${escape(track.title)}** - *${escape(track.author)}*.`,
      `-# ${count} favorite${count > 1 ? "s" : ""} now. Play them with \`/favorite play\`.`
    ),
    { ephemeral: true }
  );
}

async function onList(ctx) {
  const favorites = await listFavorites(ctx.user.id);
  if (!favorites.length) {
    return ctx.reply(
      ui.notice(
        `${emoji("heart")} You have no favorites yet.`,
        "-# Hit **Favorite** on the panel, or run `/favorite add` while something plays."
      ),
      { ephemeral: true }
    );
  }

  const lines = favorites.slice(0, 25).map((track, index) => {
    const length = track.isStream ? "live" : formatTime(Math.round((track.duration || 0) / 1000));
    return `\`${String(index + 1).padStart(2, " ")}.\` ${escape(track.title)} - *${escape(track.author)}* \`${length}\``;
  });

  return ctx.reply(
    ui.container(
      Accent.primary,
      ui.text(`### ${emoji("heart")} Your favorites`),
      ui.text(`-# ${favorites.length} tracks - ${formatLong(totalDuration(favorites))}`),
      ui.divider(),
      ui.text(...lines),
      favorites.length > 25 && ui.text(`-# and ${favorites.length - 25} more`),
      ui.divider(),
      ui.text("-# Queue them all with `/favorite play`.")
    ),
    { ephemeral: true }
  );
}

async function onPlay(ctx) {
  const favorites = await listFavorites(ctx.user.id);
  if (!favorites.length) {
    return ctx.reply(ui.notice("You have no favorites to play yet."), { ephemeral: true });
  }

  const asked = ctx.options?.getInteger("position") ?? parseInt(ctx.args[1], 10);
  const picked = Number.isFinite(asked) ? [favorites[asked - 1]].filter(Boolean) : favorites;

  if (!picked.length) {
    return ctx.reply(ui.notice(`You have no favorite at position **${asked}**.`), {
      ephemeral: true,
    });
  }

  await ctx.defer();

  const ready = await ensurePlayer(ctx);
  if (ready.error) return ctx.reply(ui.notice(ready.error));

  const { player, state } = ready;
  const wasIdle = !player.queue.current;
  const tracks = picked.map((track) => restore(track, ctx.user));

  await player.queue.add(tracks);
  if (wasIdle) await player.play();

  return panelOrNotice(ctx, {
    player,
    state,
    tracks,
    wasIdle,
    playlist:
      tracks.length > 1
        ? { name: "Your favorites", duration: totalDuration(picked) * 1000 }
        : null,
  });
}

async function onRemove(ctx) {
  const asked = ctx.options?.getInteger("position") ?? parseInt(ctx.args[1], 10);
  const index = Number.isFinite(asked) ? asked - 1 : -1;

  const { track, count, error } = await removeFavorite(ctx.user.id, index);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(
    ui.notice(
      `${emoji("heart")} Removed **${escape(track.title)}**.`,
      `-# ${count} favorite${count === 1 ? "" : "s"} left.`
    ),
    { ephemeral: true }
  );
}
