import { Events } from "discord.js";

import { loadEmojis } from "../music/emojis.js";
import { startRepaint } from "../music/repaint.js";
import { lavalink } from "../music/lavalink.js";
import { bindLavalink } from "../music/events.js";
import { useLibrary } from "../music/library.js";

export default {
  name: Events.ClientReady,
  once: true,

  async run(client, { db }) {
    useLibrary(db);
    await loadEmojis(client);

    startRepaint(client);
    bindLavalink(client);

    await lavalink().init({ id: client.user.id, username: client.user.username });

    console.log(`Logged in as ${client.user.tag}. Ready.`);
  },
};
