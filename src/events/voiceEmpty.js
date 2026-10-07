import { Events } from "discord.js";

import { getPlayer } from "../music/lavalink.js";
import { unwatch } from "../music/repaint.js";

const GRACE = 60_000;

const timers = new Map();

export default {
  name: Events.VoiceStateUpdate,

  run(before, after, { client }) {
    const guildId = (after.guild || before.guild)?.id;
    if (!guildId) return;

    const player = getPlayer(guildId);
    if (!player?.voiceChannelId) return;

    if (before.id === client.user.id) {
      if (!after.channelId) {
        clearTimeout(timers.get(guildId));
        timers.delete(guildId);
      }
      return;
    }

    const channel = client.channels.cache.get(player.voiceChannelId);
    if (!channel) return;

    if (listeners(channel) > 0) {
      clearTimeout(timers.get(guildId));
      timers.delete(guildId);
      return;
    }

    if (timers.has(guildId)) return;

    timers.set(
      guildId,
      setTimeout(async () => {
        timers.delete(guildId);

        const still = getPlayer(guildId);
        if (!still?.voiceChannelId) return;

        const where = client.channels.cache.get(still.voiceChannelId);
        if (where && listeners(where) > 0) return;

        await still.destroy("Everyone left the voice channel.").catch(() => {});
        unwatch(guildId);

        console.log(`Left the voice channel in ${guildId}: nobody listening.`);
      }, GRACE)
    );
  },
};

function listeners(channel) {
  return channel.members?.filter((member) => !member.user.bot).size ?? 0;
}
