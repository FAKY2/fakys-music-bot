import { ApplicationCommandOptionType } from "discord.js";

import { CommandType, Permission } from "../../core/command.js";
import { ui, Accent } from "../../core/ui.js";
import { emoji } from "../../music/emojis.js";
import { escape } from "../../music/panel.js";
import { formatTime, formatLong } from "../../music/card.js";
import { getPlayer } from "../../music/lavalink.js";
import { ensurePlayer, panelOrNotice } from "../../music/session.js";
import {
  listPlaylists,
  getPlaylist,
  savePlaylist,
  addToPlaylist,
  removeFromPlaylist,
  renamePlaylist,
  deletePlaylist,
  restore,
  totalDuration,
} from "../../music/library.js";

const NAME = {
  name: "name",
  description: "The playlist's name.",
  type: ApplicationCommandOptionType.String,
  required: true,
};

export default {
  type: CommandType.Both,
  name: "playlist",
  aliases: ["pl"],
  description: "Save, load and manage your own playlists.",
  permission: Permission.Everyone,

  options: [
    {
      name: "save",
      description: "Save what's in the queue as a playlist.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [NAME],
    },
    {
      name: "load",
      description: "Queue a saved playlist.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [NAME],
    },
    {
      name: "list",
      description: "Show your playlists, or what's inside one.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [{ ...NAME, required: false, description: "Leave empty to list them all." }],
    },
    {
      name: "add",
      description: "Add the current track to a playlist.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [NAME],
    },
    {
      name: "remove",
      description: "Drop one track from a playlist.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        NAME,
        {
          name: "position",
          description: "Its number in the playlist.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          min_value: 1,
        },
      ],
    },
    {
      name: "rename",
      description: "Give a playlist another name.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [NAME, { ...NAME, name: "to", description: "The new name." }],
    },
    {
      name: "delete",
      description: "Delete a playlist for good.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [NAME],
    },
  ],

  async run(ctx) {
    const action = ctx.options?.getSubcommand(false) ?? ctx.args[0]?.toLowerCase() ?? "list";
    const name = ctx.options?.getString("name") ?? ctx.args.slice(1).join(" ");

    if (action === "list") return onList(ctx, name);
    if (action === "save") return onSave(ctx, name);
    if (action === "load") return onLoad(ctx, name);
    if (action === "add") return onAdd(ctx, name);
    if (action === "remove") return onRemove(ctx, name);
    if (action === "rename") return onRename(ctx, name);
    if (action === "delete") return onDelete(ctx, name);

    return ctx.reply(
      ui.notice(
        `**${escape(action)}** isn't something I can do to a playlist.`,
        "-# Try `save`, `load`, `list`, `add`, `remove`, `rename` or `delete`."
      ),
      { ephemeral: true }
    );
  },
};

async function onList(ctx, name) {
  if (name) return onShowOne(ctx, name);

  const playlists = await listPlaylists(ctx.user.id);
  if (!playlists.length) {
    return ctx.reply(
      ui.notice(
        `${emoji("playlist")} You have no playlists yet.`,
        "-# Queue some music, then run `/playlist save <name>`."
      ),
      { ephemeral: true }
    );
  }

  const lines = playlists.map(
    (playlist) =>
      `${emoji("disc")} **${escape(playlist.name)}**\n-# ${playlist.tracks.length} tracks - ${formatLong(totalDuration(playlist.tracks))}`
  );

  return ctx.reply(
    ui.container(
      Accent.primary,
      ui.text(`### ${emoji("playlist")} Your playlists`),
      ui.divider(),
      ui.text(...lines),
      ui.divider(),
      ui.text("-# Load one with `/playlist load <name>`.")
    ),
    { ephemeral: true }
  );
}

async function onShowOne(ctx, name) {
  const playlist = await getPlaylist(ctx.user.id, name);
  if (!playlist) return missing(ctx, name);

  const lines = playlist.tracks.slice(0, 25).map((track, index) => {
    const length = track.isStream ? "live" : formatTime(Math.round((track.duration || 0) / 1000));
    return `\`${String(index + 1).padStart(2, " ")}.\` ${escape(track.title)} - *${escape(track.author)}* \`${length}\``;
  });

  return ctx.reply(
    ui.container(
      Accent.primary,
      ui.text(`### ${emoji("playlist")} ${escape(playlist.name)}`),
      ui.text(`-# ${playlist.tracks.length} tracks - ${formatLong(totalDuration(playlist.tracks))}`),
      ui.divider(),
      ui.text(...(lines.length ? lines : ["-# It is empty."])),
      playlist.tracks.length > 25 && ui.text(`-# and ${playlist.tracks.length - 25} more`)
    ),
    { ephemeral: true }
  );
}

async function onSave(ctx, name) {
  if (!name) return ctx.reply(ui.notice("Give the playlist a name."), { ephemeral: true });

  const player = getPlayer(ctx.guild.id);
  const tracks = [player?.queue.current, ...(player?.queue.tracks ?? [])].filter(Boolean);

  if (!tracks.length) {
    return ctx.reply(ui.notice("There's nothing in the queue to save."), { ephemeral: true });
  }

  const { playlist, error } = await savePlaylist(ctx.user.id, name, tracks);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(
    ui.notice(
      `${emoji("playlist")} Saved **${escape(playlist.name)}** - ${playlist.tracks.length} tracks.`,
      "-# Bring it back with `/playlist load`."
    ),
    { ephemeral: true }
  );
}

async function onLoad(ctx, name) {
  if (!name) return ctx.reply(ui.notice("Which playlist?"), { ephemeral: true });

  const playlist = await getPlaylist(ctx.user.id, name);
  if (!playlist) return missing(ctx, name);

  if (!playlist.tracks.length) {
    return ctx.reply(ui.notice(`**${escape(playlist.name)}** is empty.`), { ephemeral: true });
  }

  await ctx.defer();

  const ready = await ensurePlayer(ctx);
  if (ready.error) return ctx.reply(ui.notice(ready.error));

  const { player, state } = ready;
  const wasIdle = !player.queue.current;
  const tracks = playlist.tracks.map((track) => restore(track, ctx.user));

  await player.queue.add(tracks);
  if (wasIdle) await player.play();

  return panelOrNotice(ctx, {
    player,
    state,
    tracks,
    wasIdle,
    playlist: { name: playlist.name, duration: totalDuration(playlist.tracks) * 1000 },
  });
}

async function onAdd(ctx, name) {
  const player = getPlayer(ctx.guild.id);
  if (!player?.queue.current) {
    return ctx.reply(ui.notice("Nothing is playing right now."), { ephemeral: true });
  }

  const { playlist, added, error } = await addToPlaylist(ctx.user.id, name, [player.queue.current]);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(
    ui.notice(
      `${emoji("playlist")} Added **${added}** track to **${escape(playlist.name)}** - ${playlist.tracks.length} in total.`
    ),
    { ephemeral: true }
  );
}

async function onRemove(ctx, name) {
  const asked = ctx.options?.getInteger("position") ?? parseInt(ctx.args[2], 10);
  const index = Number.isFinite(asked) ? asked - 1 : -1;

  const { playlist, removed, error } = await removeFromPlaylist(ctx.user.id, name, index);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(
    ui.notice(
      `${emoji("playlist")} Removed **${escape(removed.title)}** from **${escape(playlist.name)}**.`
    ),
    { ephemeral: true }
  );
}

async function onRename(ctx, name) {
  const next = ctx.options?.getString("to") ?? ctx.args[2];
  if (!next) return ctx.reply(ui.notice("What should it be called?"), { ephemeral: true });

  const { playlist, error } = await renamePlaylist(ctx.user.id, name, next);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(ui.notice(`${emoji("playlist")} It's **${escape(playlist.name)}** now.`), {
    ephemeral: true,
  });
}

async function onDelete(ctx, name) {
  const { playlist, error } = await deletePlaylist(ctx.user.id, name);
  if (error) return ctx.reply(ui.notice(error), { ephemeral: true });

  return ctx.reply(ui.notice(`${emoji("playlist")} Deleted **${escape(playlist.name)}**.`), {
    ephemeral: true,
  });
}

function missing(ctx, name) {
  return ctx.reply(ui.notice(`You have no playlist called **${escape(name)}**.`), {
    ephemeral: true,
  });
}
