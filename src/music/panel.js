import { MessageFlags } from "discord.js";

import { ui, Accent } from "../core/ui.js";
import { emoji } from "./emojis.js";
import { cardAttachment, cardAlt, formatTime, formatLong } from "./card.js";
import { view, elapsed, remaining, position, total } from "./track.js";
import { activeFilters } from "./filters.js";
import { peekState } from "./state.js";

const SHOWN = 5;

export async function renderPanel(player, { busy = false } = {}) {
  if (!player?.queue.current) return renderIdle(player, { busy });
  return panelWith(player, await drawCard(player), { busy });
}

export function drawCard(player) {
  const track = view(player.queue.current);

  return cardAttachment(track, {
    elapsed: elapsed(player),
    paused: player.paused,
    volume: player.volume,
    loop: player.repeatMode,
    position: position(player),
    total: total(player),
    remaining: remaining(player),
    filters: activeFilters(player),
  });
}

export function panelWith(player, card, { busy = false } = {}) {
  if (!player?.queue.current) return renderIdle(player, { busy });

  const track = view(player.queue.current);
  const at = elapsed(player);
  const state = peekState(player.guildId);

  const container = ui.container(
    player.paused ? Accent.muted : Accent.primary,

    card && ui.gallery({ url: card.url, alt: cardAlt(track, { elapsed: at, paused: player.paused }) }),

    !card &&
      ui.text(
        `### ${emoji(player.paused ? "pause" : "play")} ${escape(track.title)}`,
        `-# ${escape(track.artist)} - ${formatTime(at)} / ${track.isLive ? "live" : formatTime(track.duration)}`
      ),

    ui.text(
      `-# ${emoji("artist")} Asked for by <@${track.requestedBy}>${track.url ? ` - [source](${track.url})` : ""}`
    ),

    ui.divider(),

    ...renderQueue(player),

    ui.divider(),

    ui.row(
      ui.button("mp:previous", "", "secondary", emoji("previous")).setDisabled(
        !player.queue.previous.length
      ),
      player.paused
        ? ui.button("mp:resume", "", "success", emoji("play"))
        : ui.button("mp:pause", "", "primary", emoji("pause")),
      ui.button("mp:skip", "", "secondary", emoji("skip")),
      ui.button("mp:stop", "", "danger", emoji("stop")),
      ui.button("mp:loop", "", loopStyle(player.repeatMode), emoji("loop"))
    ),

    ui.row(
      addButton(busy),
      ui.button("mp:shuffle", "Shuffle", "secondary", emoji("shuffle")).setDisabled(
        player.queue.tracks.length < 2
      ),
      ui.button("mp:queue", "Queue", "secondary", emoji("queue")),
      ui.button(
        "mp:volume",
        `${player.volume}%`,
        "secondary",
        emoji(player.volume === 0 ? "mute" : "volume")
      )
    ),

    ui.row(
      ui.button("mp:favorite", "Favorite", "secondary", emoji("heart")),
      ui.button("mp:filter", "Filters", "secondary", emoji("filter")),
      ui.button(
        "mp:autoplay",
        "Autoplay",
        state?.autoplay ? "success" : "secondary",
        emoji("autoplay")
      )
    )
  );

  return {
    components: [container],
    files: card ? [card.file] : [],
    flags: MessageFlags.IsComponentsV2,
  };
}

function renderQueue(player) {
  const tracks = player.queue.tracks;

  if (!tracks.length) {
    return [ui.text(`-# ${emoji("queue")} Nothing else waiting - hit **Add** to queue something.`)];
  }

  const shown = tracks.slice(0, SHOWN).map((track, index) => {
    const item = view(track);
    const length = item.isLive ? "live" : formatTime(item.duration);
    return `\`${index + 1}.\` ${escape(item.title)} - *${escape(item.artist)}* \`${length}\``;
  });

  const hidden = tracks.length - shown.length;

  return [
    ui.text(
      `${emoji("queue")} **Up next** - ${tracks.length} track${tracks.length > 1 ? "s" : ""}, ${formatLong(remaining(player))} left`
    ),
    ui.text(...shown),
    hidden > 0 && ui.text(`-# and ${hidden} more`),
  ].filter(Boolean);
}

export function renderIdle(player, { busy = false } = {}) {
  const waiting = player?.queue.tracks.length ?? 0;
  const state = peekState(player?.guildId);

  const container = ui.container(
    Accent.muted,
    ui.text(`### ${emoji("disc")} Nothing playing`),
    ui.text("-# Hit **Add** with a link or a few words and it starts here."),
    ui.divider(),
    ui.row(
      ui.button("mp:previous", "", "secondary", emoji("previous")).setDisabled(
        !player?.queue.previous.length
      ),
      ui.button("mp:resume", "", "success", emoji("play")).setDisabled(!waiting),
      ui.button("mp:skip", "", "secondary", emoji("skip")).setDisabled(true),
      ui.button("mp:stop", "", "danger", emoji("stop")).setDisabled(!player),
      ui.button("mp:loop", "", loopStyle(player?.repeatMode), emoji("loop"))
    ),
    ui.row(
      addButton(busy, "Add a track"),
      ui.button(
        "mp:autoplay",
        "Autoplay",
        state?.autoplay ? "success" : "secondary",
        emoji("autoplay")
      )
    )
  );

  return { components: [container], files: [], flags: MessageFlags.IsComponentsV2 };
}

export function volumeModal(current) {
  return ui.modal(
    "mp:m:volume",
    "Volume",
    ui.input("volume", "Volume, 0 to 200", { value: String(current), max: 3 })
  );
}

export function addModal() {
  return ui.modal(
    "mp:m:add",
    "Add to the queue",
    ui.input("query", "A link, or what to search for", {
      placeholder: "daft punk - one more time",
      max: 300,
    })
  );
}

function loopStyle(mode) {
  return !mode || mode === "off" ? "secondary" : "success";
}

function addButton(busy, label = "Add") {
  return busy
    ? ui.button("mp:add", "Adding...", "secondary", emoji("queue")).setDisabled(true)
    : ui.button("mp:add", label, "success", emoji("music"));
}

export function escape(text) {
  return String(text ?? "")
    .replace(/([*_`~|\<>@#:])/g, "\$1")
    .slice(0, 150);
}
