const SOURCES = {
  youtube: "YouTube",
  youtubemusic: "YouTube Music",
  spotify: "Spotify",
  deezer: "Deezer",
  soundcloud: "SoundCloud",
  applemusic: "Apple Music",
  bandcamp: "Bandcamp",
  twitch: "Twitch",
  vimeo: "Vimeo",
  jiosaavn: "JioSaavn",
  tidal: "Tidal",
  http: "Direct link",
};

export function view(track) {
  const info = track?.info ?? {};

  return {
    title: info.title || "Unknown title",
    artist: info.author || "Unknown artist",
    duration: Math.round((info.duration || 0) / 1000),
    url: info.uri || null,
    thumbnail: artwork(track),
    isLive: Boolean(info.isStream),
    isSeekable: Boolean(info.isSeekable),
    source: SOURCES[info.sourceName] || info.sourceName || "unknown",
    requestedBy: track?.requester?.id ?? null,
  };
}

export function artwork(track) {
  const info = track?.info ?? {};
  if (info.artworkUrl) return info.artworkUrl;

  const plugin = track?.pluginInfo ?? {};
  if (plugin.artworkUrl) return plugin.artworkUrl;
  if (plugin.albumArtUrl) return plugin.albumArtUrl;

  if (info.sourceName === "youtube" && info.identifier) {
    return `https://i.ytimg.com/vi/${info.identifier}/hqdefault.jpg`;
  }
  return null;
}

export function elapsed(player) {
  return Math.floor((player?.position ?? 0) / 1000);
}

export function remaining(player) {
  if (!player) return 0;

  const queued = player.queue.tracks.reduce(
    (sum, track) => sum + Math.round((track.info?.duration || 0) / 1000),
    0
  );

  const current = player.queue.current;
  if (!current || current.info?.isStream) return queued;

  const left = Math.round((current.info.duration || 0) / 1000) - elapsed(player);
  return queued + Math.max(0, left);
}

export function position(player) {
  return (player?.queue.previous.length ?? 0) + 1;
}

export function total(player) {
  return position(player) + (player?.queue.tracks.length ?? 0);
}
