import { ui, Accent } from "../core/ui.js";
import { emoji } from "./emojis.js";
import { escape } from "./panel.js";
import { formatTime, formatLong } from "./card.js";
import { view, elapsed, remaining } from "./track.js";

export const PER_PAGE = 10;

export function renderQueuePage(player, page = 0) {
  const tracks = player?.queue.tracks ?? [];
  const pages = Math.max(1, Math.ceil(tracks.length / PER_PAGE));
  const current = Math.max(0, Math.min(page, pages - 1));

  if (!player?.queue.current && !tracks.length) {
    return ui.container(
      Accent.muted,
      ui.text(`### ${emoji("queue")} The queue is empty`),
      ui.text("-# Add something with `/play`.")
    );
  }

  const start = current * PER_PAGE;
  const slice = tracks.slice(start, start + PER_PAGE);

  const lines = slice.map((track, index) => {
    const item = view(track);
    const spot = String(start + index + 1).padStart(2, " ");
    const length = item.isLive ? "live" : formatTime(item.duration);
    return `\`${spot}.\` **${escape(item.title)}**\n-# ${escape(item.artist)} \`${length}\` - <@${item.requestedBy}>`;
  });

  const now = player.queue.current ? view(player.queue.current) : null;

  return ui.container(
    Accent.primary,

    ui.text(`### ${emoji("queue")} Queue`),

    now &&
      ui.text(
        `${emoji(player.paused ? "pause" : "play")} **${escape(now.title)}**`,
        `-# ${escape(now.artist)} - ${formatTime(elapsed(player))} / ${now.isLive ? "live" : formatTime(now.duration)}`
      ),

    tracks.length > 0 && ui.divider(),
    tracks.length > 0 ? ui.text(...lines) : ui.text("-# Nothing waiting after this one."),

    ui.divider(),

    ui.text(
      `-# ${tracks.length} waiting - ${formatLong(remaining(player))} left - volume ${player.volume}% - page ${current + 1}/${pages}`
    ),

    pages > 1 &&
      ui.row(
        ui.button(`q:page:${current - 1}`, "Previous", "secondary", emoji("previous")).setDisabled(
          current === 0
        ),
        ui.button(`q:page:${current + 1}`, "Next", "secondary", emoji("skip")).setDisabled(
          current >= pages - 1
        )
      ),

    slice.length > 0 &&
      ui.row(
        ui.select(
          `q:jump:${current}`,
          "Jump to a track...",
          slice.map((track, index) => {
            const item = view(track);
            return {
              label: plain(item.title, 100),
              value: String(start + index),
              description: plain(
                `${item.artist} - ${item.isLive ? "live" : formatTime(item.duration)}`,
                100
              ),
            };
          })
        )
      )
  );
}

export function plain(text, max) {
  const value = String(text ?? "").replace(/[*_`~|\<>]/g, "");
  return value.length > max ? `${value.slice(0, max - 3)}...` : value || "Unknown";
}
