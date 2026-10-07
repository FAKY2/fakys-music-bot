import { coalesce } from "../core/utils/flow.js";
import { peekState } from "./state.js";
import { getPlayer } from "./lavalink.js";
import { renderPanel, panelWith, drawCard } from "./panel.js";

const TICK = 5_000;
const WINDOW = 2_500;

let client = null;
let ticker = null;

const live = new Set();

export function startRepaint(discordClient) {
  client = discordClient;
  ticker ??= setInterval(tick, TICK);
}

export function stopRepaint() {
  clearInterval(ticker);
  ticker = null;
}

export function watch(guildId) {
  live.add(guildId);
}

export function unwatch(guildId) {
  live.delete(guildId);
}

function tick() {
  for (const guildId of live) {
    const player = getPlayer(guildId);
    const state = peekState(guildId);

    if (!player?.queue.current || player.paused || !state?.messageId) continue;
    repaint(guildId);
  }
}

export async function sendPanel(player, send, { busy = false } = {}) {
  if (!player?.queue.current) return send(panelWith(player, null, { busy }));

  const message = await send(panelWith(player, null, { busy }));

  if (typeof message?.edit !== "function") {
    const card = await drawCard(player).catch(() => null);
    if (card) await send({ ...panelWith(player, card, { busy }), attachments: [] });
    return message;
  }

  setImmediate(() => {
    drawCard(player)
      .then((card) => message.edit({ ...panelWith(player, card, { busy }), attachments: [] }))
      .catch((error) => console.error("Attaching the card failed:", error.message));
  });

  return message;
}

export function repaint(guildId) {
  coalesce(`panel:${guildId}`, WINDOW, () => paint(guildId));
}

async function paint(guildId) {
  const state = peekState(guildId);
  if (!client || !state?.messageId || !state.channelId) return;

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  const message = await channel?.messages.fetch(state.messageId).catch(() => null);

  if (!message) {
    state.messageId = null;
    unwatch(guildId);
    return;
  }

  const view = await renderPanel(getPlayer(guildId));

  await message.edit({ ...view, attachments: [] }).catch((error) => {
    console.error(`Repainting the panel for ${guildId} failed:`, error.message);
  });
}

export async function movePanel(player, state, send) {
  unwatch(player.guildId);

  const message = await sendPanel(player, send);
  state.messageId = message?.id ?? null;
  state.channelId = message?.channelId ?? state.channelId;

  if (state.messageId) watch(player.guildId);
  return message;
}
