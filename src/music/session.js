import { ui } from "../core/ui.js";
import { emoji } from "./emojis.js";
import { escape } from "./panel.js";
import { formatTime, formatLong } from "./card.js";
import { view } from "./track.js";
import { getState } from "./state.js";
import { getPlayer, createPlayer, nodeReady } from "./lavalink.js";
import { find } from "./search.js";
import { movePanel, repaint } from "./repaint.js";

export async function ensurePlayer(ctx) {
  const voiceChannelId = ctx.member?.voice?.channelId;
  if (!voiceChannelId) return { error: "Join a voice channel first, then ask again." };
  if (!nodeReady()) return { error: "The audio server is offline right now. Try again in a moment." };

  const existing = getPlayer(ctx.guild.id);
  if (existing && existing.voiceChannelId && existing.voiceChannelId !== voiceChannelId) {
    return { error: `I'm playing in <#${existing.voiceChannelId}> - join that one first.` };
  }

  const player = await createPlayer({
    guildId: ctx.guild.id,
    voiceChannelId,
    textChannelId: ctx.channel.id,
  });

  const state = getState(ctx.guild.id);
  state.channelId = ctx.channel.id;

  return { player, state };
}

export async function enqueue(ctx, query, { next = false, source } = {}) {
  const ready = await ensurePlayer(ctx);
  if (ready.error) return ready;

  const { player, state } = ready;
  const wasIdle = !player.queue.current;

  let result;
  try {
    result = await find(player, query, ctx.user, { source });
  } catch (error) {
    console.error("Searching failed:", error.message);
    return { error: `I couldn't search for **${escape(query)}** right now.` };
  }

  if (!result.tracks.length) return { error: `Nothing came back for **${escape(query)}**.` };

  const tracks = result.playlist ? result.tracks : [result.tracks[0]];
  await player.queue.add(tracks, next ? 0 : undefined);

  if (wasIdle) await player.play();

  return { player, state, tracks, playlist: result.playlist, wasIdle };
}

export async function panelOrNotice(ctx, added) {
  const { player, state, tracks, playlist, wasIdle } = added;

  if (wasIdle || !state.messageId) {
    await movePanel(player, state, (view) => ctx.reply(view));
    return;
  }

  await ctx.reply(queuedNotice(tracks, playlist, player));
  return repost(ctx, player, state);
}

async function repost(ctx, player, state) {
  const channel = ctx.channel;
  const previous = state.messageId;

  const message = await movePanel(player, state, (view) => channel.send(view)).catch(() => null);
  if (!message) return repaint(ctx.guild.id);

  if (previous && previous !== message.id) {
    await channel.messages
      .fetch(previous)
      .then((old) => old.delete())
      .catch(() => {});
  }
}

export function queuedNotice(tracks, playlist, player) {
  const waiting = player.queue.tracks.length;

  if (playlist) {
    return ui.notice(
      `${emoji("playlist")} Queued **${escape(playlist.name)}** - ${tracks.length} tracks`,
      `-# ${waiting} waiting - ${formatLong(Math.round(playlist.duration / 1000))} of music`
    );
  }

  const track = view(tracks[0]);
  return ui.notice(
    `${emoji("queue")} Queued **${escape(track.title)}** - *${escape(track.artist)}*`,
    `-# Position ${waiting} - \`${track.isLive ? "live" : formatTime(track.duration)}\``
  );
}
