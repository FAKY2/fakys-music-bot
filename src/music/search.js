import { config } from "../core/config.js";

const IS_URL = /^https?:\/\//i;

export const SOURCES = {
  ytmsearch: "YouTube Music",
  ytsearch: "YouTube",
  spsearch: "Spotify",
  dzsearch: "Deezer",
  scsearch: "SoundCloud",
  amsearch: "Apple Music",
};

export async function find(player, query, requester, { source = config.music.source } = {}) {
  const result = await player.search(
    IS_URL.test(query) ? { query } : { query, source },
    requester
  );

  return {
    tracks: result?.tracks ?? [],
    playlist: result?.playlist ?? null,
    loadType: result?.loadType ?? "empty",
  };
}

export async function suggestions(player, query, requester, limit = 10) {
  const { tracks } = await find(player, query, requester);
  return tracks.slice(0, limit);
}

export function isUrl(query) {
  return IS_URL.test(query);
}
