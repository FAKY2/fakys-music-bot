import { ui, payload } from "../core/ui.js";
import { lavalink } from "./lavalink.js";
import { peekState, dropState } from "./state.js";
import { repaint, watch, unwatch } from "./repaint.js";
import { autoplay } from "./autoplay.js";
import { view } from "./track.js";
import { renderIdle, escape } from "./panel.js";
import { emoji } from "./emojis.js";
import { clearVotes } from "./vote.js";

export function bindLavalink(client) {
  const manager = lavalink();

  manager.nodeManager
    .on("connect", (node) => console.log(`Lavalink node "${node.id}" is up.`))
    .on("disconnect", (node, reason) =>
      console.warn(`Lavalink node "${node.id}" went away: ${reason?.reason ?? "no reason given"}.`)
    )
    .on("reconnecting", (node) => console.warn(`Lavalink node "${node.id}" is reconnecting.`))
    .on("error", (node, error) => console.error(`Lavalink node "${node.id}":`, error.message));

  manager
    .on("trackStart", (player) => {
      clearVotes(player.guildId);
      watch(player.guildId);
      repaint(player.guildId);
    })

    .on("trackEnd", (player) => repaint(player.guildId))

    .on("trackStuck", (player, track) => {
      console.warn(`Track stuck in ${player.guildId}: ${track?.info?.title}`);
      report(client, player, `${emoji("skip")} **${title(track)}** got stuck, moving on.`);
    })

    .on("trackError", (player, track) => {
      console.warn(`Track failed in ${player.guildId}: ${track?.info?.title}`);
      report(client, player, `${emoji("skip")} **${title(track)}** wouldn't play, moving on.`);
    })

    .on("queueEnd", async (player, track) => {
      await autoplay(player, track).catch((error) =>
        console.error("Autoplay failed:", error.message)
      );

      if (!player.queue.current) repaint(player.guildId);
    })

    .on("playerMove", (player, _from, to) => {
      player.voiceChannelId = to;
      repaint(player.guildId);
    })

    .on("playerDisconnect", (player) => {
      unwatch(player.guildId);
      repaint(player.guildId);
    })

    .on("playerDestroy", (player) => {
      clearVotes(player.guildId);
      unwatch(player.guildId);
      const state = peekState(player.guildId);
      if (state) idle(client, player, state);
    })

    .on("playerSocketClosed", (player, payload) => {
      if (payload?.code >= 4000) {
        console.warn(`Voice socket closed in ${player.guildId}: ${payload.code}.`);
      }
    });
}

async function idle(client, player, state) {
  if (!state.messageId || !state.channelId) return dropState(player.guildId);

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  const message = await channel?.messages.fetch(state.messageId).catch(() => null);

  if (message) {
    await message.edit({ ...renderIdle(null), attachments: [] }).catch(() => {});
  }

  dropState(player.guildId);
}

async function report(client, player, line) {
  const state = peekState(player.guildId);
  const channelId = state?.channelId ?? player.textChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  await channel?.send(payload(ui.notice(line))).catch(() => {});
}

function title(track) {
  return escape(view(track).title);
}
