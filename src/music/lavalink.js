import { LavalinkManager } from "lavalink-client";

import { config } from "../core/config.js";

let manager = null;

export function createManager(client) {
  manager = new LavalinkManager({
    nodes: [
      {
        id: config.lavalink.id,
        host: config.lavalink.host,
        port: config.lavalink.port,
        authorization: config.lavalink.authorization,
        secure: config.lavalink.secure,
        // Count only recent attempts, so a long outage never gives up for good.
        retryAmount: 10,
        retryDelay: 10_000,
        retryTimespan: 60_000,
      },
    ],

    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),

    autoSkip: true,
    autoSkipOnResolveError: true,
    emitNewSongsOnly: true,

    queueOptions: {
      maxPreviousTracks: 25,
    },

    playerOptions: {
      defaultSearchPlatform: config.music.source,
      clientBasedPositionUpdateInterval: 100,
      volumeDecrementer: 1,
      requesterTransformer: (requester) => ({
        id: requester?.id ?? String(requester ?? ""),
        username: requester?.username ?? "someone",
      }),
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
      onEmptyQueue: {
        destroyAfterMs: 5 * 60_000,
      },
    },
  });

  client.lavalink = manager;
  client.on("raw", (data) => manager.sendRawData(data));

  return manager;
}

export function lavalink() {
  if (!manager) throw new Error("Lavalink is not ready yet.");
  return manager;
}

export function nodeReady() {
  return Boolean(manager?.nodeManager.nodes.filter((node) => node.connected).size);
}

export function getPlayer(guildId) {
  return manager?.getPlayer(guildId) ?? null;
}

export async function createPlayer({ guildId, voiceChannelId, textChannelId }) {
  const player = manager.createPlayer({
    guildId,
    voiceChannelId,
    textChannelId,
    selfDeaf: true,
    selfMute: false,
    volume: config.music.volume,
  });

  if (!player.connected) await player.connect();
  return player;
}
