import { createEmojiModule } from "@beret.27/discord-app-emojis";

const WANTED = {
  play: "▶️",
  pause: "⏸️",
  skip: "⏭️",
  previous: "⏮️",
  stop: "⏹️",
  shuffle: "🔀",
  loop: "🔁",
  queue: "📜",
  volume: "🔊",
  mute: "🔇",
  music: "🎵",
  artist: "🎤",
  disc: "💿",
  live: "🔴",
  heart: "❤️",
  filter: "🎛️",
  autoplay: "♾️",
  playlist: "📚",
  search: "🔍",
};

let resolved = { ...WANTED };

export async function loadEmojis(client) {
  try {
    const emojis = await createEmojiModule({ client, emojiDir: "./emojis" }).init();

    const found = await Promise.all(
      Object.entries(WANTED).map(async ([name, fallback]) => [
        name,
        await emojis.getemoji(name, { update: true, default: fallback }),
      ])
    );

    resolved = Object.fromEntries(found);

    const custom = found.filter(([name, value]) => value !== WANTED[name]).length;
    console.log(`Emojis ready: ${custom}/${found.length} from the application, the rest Unicode.`);
  } catch (error) {
    console.warn("Application emojis unavailable, using the Unicode set:", error.message);
  }
}

export function emoji(name) {
  return resolved[name] || WANTED[name] || "▫️";
}
