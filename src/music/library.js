const MAX_TRACKS = 200;
const MAX_PLAYLISTS = 25;
const MAX_FAVORITES = 200;

let store = null;

export function useLibrary(db) {
  store = db;
}

function entry(track) {
  const info = track.info ?? {};
  return {
    encoded: track.encoded,
    title: info.title,
    author: info.author,
    duration: info.duration,
    uri: info.uri,
    artworkUrl: info.artworkUrl,
    sourceName: info.sourceName,
    isStream: Boolean(info.isStream),
  };
}

export function restore(saved, requester) {
  return {
    encoded: saved.encoded,
    info: {
      identifier: saved.uri ?? saved.title,
      title: saved.title,
      author: saved.author,
      duration: saved.duration ?? 0,
      artworkUrl: saved.artworkUrl ?? null,
      uri: saved.uri,
      sourceName: saved.sourceName,
      isSeekable: !saved.isStream,
      isStream: Boolean(saved.isStream),
      isrc: null,
    },
    pluginInfo: {},
    requester,
  };
}

function slug(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const playlistKey = (userId, name) => `playlist:${userId}:${slug(name)}`;
const favoritesKey = (userId) => `favorites:${userId}`;

export async function listPlaylists(userId) {
  const rows = await store.find(`playlist:${userId}:`);
  return rows
    .map((row) => row.value)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function getPlaylist(userId, name) {
  return (await store.get(playlistKey(userId, name))) ?? null;
}

export async function savePlaylist(userId, name, tracks) {
  const id = slug(name);
  if (!id) return { error: "That name has no letters or numbers in it." };

  const existing = await getPlaylist(userId, id);
  if (!existing && (await listPlaylists(userId)).length >= MAX_PLAYLISTS) {
    return { error: `You already have ${MAX_PLAYLISTS} playlists. Delete one first.` };
  }

  const playlist = {
    id,
    name: String(name).slice(0, 60),
    owner: userId,
    tracks: tracks.slice(0, MAX_TRACKS).map(entry),
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  await store.set(playlistKey(userId, id), playlist);
  return { playlist };
}

export async function addToPlaylist(userId, name, tracks) {
  const playlist = await getPlaylist(userId, name);
  if (!playlist) return { error: `You have no playlist called **${name}**.` };

  const room = MAX_TRACKS - playlist.tracks.length;
  if (room <= 0) return { error: `**${playlist.name}** is full (${MAX_TRACKS} tracks).` };

  const added = tracks.slice(0, room).map(entry);
  playlist.tracks.push(...added);
  playlist.updatedAt = Date.now();

  await store.set(playlistKey(userId, playlist.id), playlist);
  return { playlist, added: added.length };
}

export async function removeFromPlaylist(userId, name, index) {
  const playlist = await getPlaylist(userId, name);
  if (!playlist) return { error: `You have no playlist called **${name}**.` };

  if (index < 0 || index >= playlist.tracks.length) {
    return { error: `**${playlist.name}** has no track at position ${index + 1}.` };
  }

  const [removed] = playlist.tracks.splice(index, 1);
  playlist.updatedAt = Date.now();

  await store.set(playlistKey(userId, playlist.id), playlist);
  return { playlist, removed };
}

export async function renamePlaylist(userId, name, next) {
  const playlist = await getPlaylist(userId, name);
  if (!playlist) return { error: `You have no playlist called **${name}**.` };

  const id = slug(next);
  if (!id) return { error: "That name has no letters or numbers in it." };
  if (await getPlaylist(userId, id)) return { error: `**${next}** is already taken.` };

  await store.delete(playlistKey(userId, playlist.id));

  playlist.id = id;
  playlist.name = String(next).slice(0, 60);
  playlist.updatedAt = Date.now();

  await store.set(playlistKey(userId, id), playlist);
  return { playlist };
}

export async function deletePlaylist(userId, name) {
  const playlist = await getPlaylist(userId, name);
  if (!playlist) return { error: `You have no playlist called **${name}**.` };

  await store.delete(playlistKey(userId, playlist.id));
  return { playlist };
}

export async function listFavorites(userId) {
  return (await store.get(favoritesKey(userId))) ?? [];
}

export async function addFavorite(userId, track) {
  const favorites = await listFavorites(userId);
  const saved = entry(track);

  if (favorites.some((item) => item.uri === saved.uri)) {
    return { error: `**${saved.title}** is already in your favorites.` };
  }
  if (favorites.length >= MAX_FAVORITES) {
    return { error: `Your favorites are full (${MAX_FAVORITES} tracks).` };
  }

  favorites.unshift(saved);
  await store.set(favoritesKey(userId), favorites);
  return { track: saved, count: favorites.length };
}

export async function removeFavorite(userId, index) {
  const favorites = await listFavorites(userId);
  if (index < 0 || index >= favorites.length) {
    return { error: `You have no favorite at position ${index + 1}.` };
  }

  const [removed] = favorites.splice(index, 1);
  await store.set(favoritesKey(userId), favorites);
  return { track: removed, count: favorites.length };
}

export function totalDuration(tracks) {
  return Math.round(tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / 1000);
}
