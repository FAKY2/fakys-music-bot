import { ui, payload } from "../core/ui.js";
import { ackUpdate, answer } from "../core/utils/respond.js";
import { withLock } from "../core/utils/flow.js";
import { getPlayer, createPlayer, nodeReady } from "../music/lavalink.js";
import { getState } from "../music/state.js";
import { recall, forget } from "../music/searches.js";
import { escape } from "../music/panel.js";
import { view } from "../music/track.js";
import { emoji } from "../music/emojis.js";
import { movePanel, repaint } from "../music/repaint.js";

export default {
  id: "sr",

  async run(interaction, { parts }) {
    if (parts[1] !== "pick") return ackUpdate(interaction);
    if (!(await ackUpdate(interaction))) return;

    return withLock(`music:${interaction.guild.id}`, () => onPick(interaction, parts[2]));
  },
};

async function onPick(interaction, ticket) {
  const guildId = interaction.guild.id;

  const found = recall(ticket, guildId, interaction.user.id);
  if (!found) {
    return answer(
      interaction,
      payload(ui.notice("That search has expired, or it isn't yours. Run `/search` again."), {
        ephemeral: true,
      })
    );
  }

  const chosen = (interaction.values || [])
    .map((value) => found[parseInt(value, 10)])
    .filter(Boolean);

  if (!chosen.length) return;

  const voiceChannelId = interaction.member?.voice?.channelId;
  if (!voiceChannelId) {
    return answer(
      interaction,
      payload(ui.notice("Join a voice channel first, then pick."), { ephemeral: true })
    );
  }

  if (!nodeReady()) {
    return answer(
      interaction,
      payload(ui.notice("The audio server is offline right now."), { ephemeral: true })
    );
  }

  const state = getState(guildId);
  state.channelId ??= interaction.channelId;

  let player = getPlayer(guildId);
  let wasIdle = true;

  try {
    player = await createPlayer({
      guildId,
      voiceChannelId,
      textChannelId: state.channelId,
    });

    wasIdle = !player.queue.current;

    await player.queue.add(chosen);
    if (wasIdle) await player.play();
  } catch (error) {
    console.error("Starting the picked track failed:", error.message);
    return answer(
      interaction,
      payload(ui.notice("I couldn't start that one. Try another result."), { ephemeral: true })
    );
  }

  forget(ticket);

  const first = view(chosen[0]);
  await answer(
    interaction,
    payload(
      ui.notice(
        chosen.length === 1
          ? `${emoji("queue")} Queued **${escape(first.title)}** - *${escape(first.artist)}*`
          : `${emoji("queue")} Queued **${chosen.length} tracks**`,
        `-# ${player.queue.tracks.length} waiting.`
      )
    )
  );

  if (wasIdle || !state.messageId) {
    const channel = await interaction.client.channels.fetch(state.channelId).catch(() => null);
    if (channel) {
      await movePanel(player, state, (view) => channel.send(view)).catch(() => null);
    }
    return;
  }

  repaint(guildId);
}
