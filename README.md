<div align="center">
  <h1>EngineBot Music</h1>
  <p><b>Discord bot engine, and the Lavalink music bot running on it - by levraiberet</b></p>
</div>

## Overview

- **EngineBot** — the engine, in `src/core/`. Loader, router, Components v2 helpers, database drivers. Knows nothing about music.
- **Music** — the bot, in `src/music/`, `src/commands/`, `src/components/`, `src/events/`. Built on the engine.

| Audio | Sources | UI | Multiserver | Database |
| :---: | :---: | :---: | :---: | :---: |
| Lavalink v4 | YouTube, Spotify, Deezer, SoundCloud, Apple Music… | Components v2 | Yes ✅ | 8 drivers ✅ |

## The bot

`/play <link or words>` starts it. Everything else is a button on the panel.

| Button | What it does |
| :--- | :--- |
| ⏮️ | Restart the track, or step back to the last one within the first 5s |
| ⏸️ / ▶️ | Pause and resume |
| ⏭️ | Skip |
| ⏹️ | Stop and leave |
| 🔁 | Off → repeat track → repeat queue |
| **Add** | Queue a link or a search, without leaving the panel |
| 🔀 | Shuffle what's waiting |
| 📜 | The full queue, privately |
| 🔊 | Volume, 0 to 200 |
| ❤️ | Save what's playing to your favorites |
| 🎛️ | Filters: bass boost, nightcore, 8D, karaoke… |
| ♾️ | Autoplay: keep going with similar tracks when the queue runs dry |

The panel shows the artist, the track on air, a **generated progress bar** that advances on
its own, the source it came from, any filter running, and the next few tracks waiting. It
repaints on every click and on a slow tick, both thinned through `coalesce()` so Discord's
rate limit is never the thing that breaks.

**Add** opens a small box for a link or a few words. What lands is announced in the channel
under whoever asked for it, and the panel is reposted below that line so it stays the last
message — a panel buried above the announcements is a panel nobody can press.

### Commands

The list is deliberately short: anything the panel already does well has no command of its
own. What's left is what a button can't do.

| | |
| :--- | :--- |
| **Playing** | `/play` `/playnext` `/search` `/player` `/skip [count]` `/seek 1:30\|+30` `/stop` |
| **The queue** | `/queue [page]` `/shuffle` `/loop [mode]` `/remove <n>` `/move <from> <to>` `/clear` `/autoplay` |
| **Sound** | `/volume [0-200]` `/filter [name]` `/lyrics [query]` |
| **Yours to keep** | `/playlist save\|load\|list\|add\|remove\|rename\|delete` `/favorite add\|list\|play\|remove` |

Every one of them answers to the prefix too (`!play`, `!p`, …), and most carry short
aliases. The bot leaves on its own a minute after the last listener does.

### Who gets to cut the music

`skip`, `stop` and `clear` end something other people are listening to, so past a certain
point they ask the room rather than the first person to press.

Three ways through, in order: **alone in the channel** and it just happens; **you asked for
the track on air** and it just happens; **you can Manage Server or Move Members** and it just
happens. Otherwise it takes half the listeners, rounded up — a room of four needs two.

Each action keeps its own tally, votes are per server, and they are dropped the moment the
track changes, so a vote never carries over to a song nobody objected to.

### Playlists and favorites

Saved through the engine's own database, so they follow whichever driver is configured and
survive a restart with no extra service.

`/playlist save <name>` keeps the whole queue, the track on air included. `/playlist load`
puts it back. Favorites are one flat list per person: the ❤️ on the panel adds what's
playing, `/favorite play` queues the lot.

Both are per-user rather than per-server, so a playlist follows you between servers.

## Lavalink

Audio is Lavalink's job: this bot never touches an audio stream. It asks a Lavalink node for
a track and drives it over the REST/WebSocket API through
[`lavalink-client`](https://github.com/Tomato6966/lavalink-client), which means no ffmpeg,
no yt-dlp, no native voice libraries, and no CPU spent on encoding here.

What that buys, beyond a lighter process: **every source Lavalink's plugins support**.
Spotify, Deezer and Apple Music links resolve through the usual plugins, and searching is a
matter of the prefix — `ytmsearch`, `spsearch`, `dzsearch`, `scsearch` — picked with
`/play source:` or set once as `DEFAULT_SOURCE`.

**You need a running node** — see [Setup](#setup) below for starting one.

Filters, seeking and the volume are all applied node-side; `/filter clear` resets the
equalizer along with everything else.

### Emojis

Buttons use the bot's **application emojis** through
[`@beret.27/discord-app-emojis`](https://www.npmjs.com/package/@beret.27/discord-app-emojis).
`src/music/emojis.js` asks for `play`, `pause`, `skip`, `previous`, `stop`, `shuffle`,
`loop`, `queue`, `volume`, `mute`, `music`, `artist`, `disc`, `live`, `heart`, `filter`,
`autoplay`, `playlist` and `search`, and each one falls back to its Unicode twin when the
application doesn't have it.

The set in `./emojis` is drawn by `node scripts/makeEmojis.js`, and the bot uploads whatever
it finds there on first boot — so the buttons upgrade themselves with no code change.

## The engine

| Driver | What it is |
| :--- | :--- |
| `auto` | SQLite on Node 22.5+, else `enginedb`. No dependency either way. |
| `sqlite` | A SQLite file, through `node:sqlite`. |
| `enginedb` | The engine's format. Append-only log, folded into a snapshot. |
| `fusion` | Speed first. All in RAM. Hungry. |
| `spectral` | Memory first. Interned values, deflated on disk. |
| `json` | One readable JSON file. |
| `text` | One `key<TAB>value` line per entry. Copy it for your own. |
| `mysql` | A MySQL server. Needs `npm install mysql2`. |
| `memory` | Saves nothing. For tests. |

Your own driver: extend [Driver](src/core/data/Driver.js), point `driver` at the file's path.

## Setup

```bash
npm install
cp .env.example .env   # then put your token and your node in it
npm run check          # tells you what is still missing
npm start
```

`npm run check` is the one to run when something is off: it validates the token, reaches the
node, lists the sources it actually has, and runs a real search through it — then names what
to fix rather than leaving you with a silent bot.

### The Lavalink node

The bot plays nothing without one. Drop `Lavalink.jar` into `lavalink/` (the folder already
holds a working `application.yml`) and start it in its own terminal:

```bash
npm run lavalink       # or: cd lavalink && java -jar Lavalink.jar
```

Keep it running, then `npm start` in a second terminal. `LAVALINK_PASSWORD` in `.env` has to
match `password` in `lavalink/application.yml` — mismatched, the node answers 401 and
`npm run check` says so.

**If your antivirus scans HTTPS** (Avast, Kaspersky, ESET…), Java rejects its certificate and
every search fails with `PKIX path building failed`, even though the node itself starts fine.
Java keeps its own trust store, separate from Windows'. Point it at one that carries the
antivirus root instead:

```bash
java -Djavax.net.ssl.trustStore=truststore.jks -Djavax.net.ssl.trustStorePassword=changeit -jar Lavalink.jar
```

```ini
TOKEN=
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

PREFIX=!
DEFAULT_SOURCE=ytmsearch
DEFAULT_VOLUME=100
```

The app id is read from the token. Turn on the **Message Content** intent for the prefix
commands; the voice states the bot already asks for come with the invite.

## License

MIT
