import { peekState } from "./state.js";

const SEED_LIMIT = 30;

export async function autoplay(player, lastTrack) {
  const state = peekState(player.guildId);
  if (!state?.autoplay || !lastTrack) return;

  remember(state, lastTrack);

  const found = await related(player, lastTrack).catch(() => []);
  const fresh = found.filter((track) => !state.seeded.has(key(track)));
  if (!fresh.length) return;

  const picked = fresh[Math.floor(Math.random() * Math.min(fresh.length, 5))];
  remember(state, picked);

  await player.queue.add(picked);
  if (!player.playing) await player.play();
}

async function related(player, track) {
  const info = track.info ?? {};
  const requester = track.requester;

  if (info.sourceName === "youtube" && info.identifier) {
    const mix = await player.search(
      { query: `https://www.youtube.com/watch?v=${info.identifier}&list=RD${info.identifier}` },
      requester
    );
    if (mix?.tracks?.length > 1) return mix.tracks.slice(1);
  }

  const byArtist = await player.search(
    { query: `${info.author} ${info.title}`, source: "ytmsearch" },
    requester
  );

  return (byArtist?.tracks ?? []).filter((found) => found.info?.identifier !== info.identifier);
}

function remember(state, track) {
  state.seeded.add(key(track));
  if (state.seeded.size > SEED_LIMIT) {
    state.seeded.delete(state.seeded.values().next().value);
  }
}

function key(track) {
  return track.info?.identifier || track.info?.uri || track.info?.title || "";
}
