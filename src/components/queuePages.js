import { ui, payload } from "../core/ui.js";
import { ackUpdate, answer } from "../core/utils/respond.js";
import { withLock } from "../core/utils/flow.js";
import { getPlayer } from "../music/lavalink.js";
import { renderQueuePage } from "../music/queueView.js";
import { escape } from "../music/panel.js";
import { view } from "../music/track.js";
import { emoji } from "../music/emojis.js";
import { repaint } from "../music/repaint.js";

export default {
  id: "q",

  async run(interaction, { parts }) {
    const action = parts[1];
    const page = parseInt(parts[2], 10) || 0;

    if (action === "page") return onPage(interaction, page);
    if (action === "jump") return onJump(interaction, page);

    return ackUpdate(interaction);
  },
};

async function onPage(interaction, page) {
  try {
    await interaction.update(payload(renderQueuePage(getPlayer(interaction.guild.id), page)));
  } catch (error) {
    console.error("Paging the queue failed:", error.message);
  }
}

async function onJump(interaction, page) {
  if (!(await ackUpdate(interaction))) return;

  const guildId = interaction.guild.id;
  const index = parseInt(interaction.values?.[0], 10);

  await withLock(`music:${guildId}`, async () => {
    const player = getPlayer(guildId);
    if (!player || Number.isNaN(index)) return;

    const listening = interaction.member?.voice?.channelId;
    if (player.voiceChannelId && listening !== player.voiceChannelId) {
      return answer(
        interaction,
        payload(ui.notice(`Join <#${player.voiceChannelId}> to use the controls.`), {
          ephemeral: true,
        })
      );
    }

    const target = player.queue.tracks[index];
    if (!target) {
      return answer(interaction, payload(renderQueuePage(player, page)));
    }

    const picked = view(target);
    await player.skip(index + 1);
    repaint(guildId);

    await answer(
      interaction,
      payload([
        renderQueuePage(getPlayer(guildId), 0),
        ui.text(
          `-# ${emoji("play")} Jumped to **${escape(picked.title)}** - *${escape(picked.artist)}*`
        ),
      ])
    );
  });
}
