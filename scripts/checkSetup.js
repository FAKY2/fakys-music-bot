import "dotenv/config";

const OK = "\x1b[32mOK\x1b[0m";
const BAD = "\x1b[31mX\x1b[0m";
const WARN = "\x1b[33m!\x1b[0m";

const problems = [];

function line(mark, label, detail) {
  console.log(`  ${mark}  ${label}${detail ? ` \x1b[90m${detail}\x1b[0m` : ""}`);
}

console.log("\n\x1b[1mEngineBot Music - setup check\x1b[0m\n");

const token = process.env.TOKEN;

if (!token) {
  line(BAD, "TOKEN", "empty - paste your bot token into .env");
  problems.push("Put your bot token in .env (Developer Portal > your app > Bot > Reset Token).");
} else {
  let appId = null;
  try {
    const decoded = Buffer.from(token.split(".")[0], "base64").toString("utf8");
    if (/^\d{15,25}$/.test(decoded)) appId = decoded;
  } catch {
    appId = null;
  }

  if (appId) line(OK, "TOKEN", `application ${appId}`);
  else {
    line(BAD, "TOKEN", "does not look like a bot token");
    problems.push("That TOKEN is not a bot token. Copy it from the Bot tab, not the OAuth tab.");
  }
}

const host = process.env.LAVALINK_HOST || "localhost";
const port = Number(process.env.LAVALINK_PORT || 2333);
const password = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const secure = /^(1|true|yes|on)$/i.test(process.env.LAVALINK_PASSWORD ? process.env.LAVALINK_SECURE || "" : "");

line(OK, "Lavalink target", `${secure ? "https" : "http"}://${host}:${port}`);

const base = `${secure ? "https" : "http"}://${host}:${port}`;

let info = null;
try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`${base}/v4/info`, {
    headers: { Authorization: password },
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (response.status === 401) {
    line(BAD, "Lavalink password", "the node refused it (401)");
    problems.push(
      `LAVALINK_PASSWORD in .env must match "password" in lavalink/application.yml.`
    );
  } else if (!response.ok) {
    line(BAD, "Lavalink", `answered ${response.status}`);
    problems.push("The node answered, but not with its info. Check its logs.");
  } else {
    info = await response.json();
    line(OK, "Lavalink", `v${info.version?.semver} on Java ${info.jvm}`);
  }
} catch (error) {
  line(BAD, "Lavalink", error.name === "AbortError" ? "no answer (timed out)" : "not reachable");
  problems.push(
    `Nothing is listening on ${host}:${port}. Start it with:  cd lavalink && java -jar Lavalink.jar`
  );
}

if (info) {
  const sources = info.sourceManagers ?? [];
  const plugins = info.plugins ?? [];

  line(OK, "Sources", sources.join(", ") || "none");

  if (plugins.length) {
    line(OK, "Plugins", plugins.map((p) => `${p.name}@${p.version}`).join(", "));
  } else {
    line(WARN, "Plugins", "none loaded");
  }

  const wanted = process.env.DEFAULT_SOURCE || "ytmsearch";
  const needs = {
    ytmsearch: "youtube",
    ytsearch: "youtube",
    spsearch: "spotify",
    dzsearch: "deezer",
    scsearch: "soundcloud",
    amsearch: "applemusic",
  }[wanted];

  if (needs && !sources.includes(needs)) {
    line(BAD, "DEFAULT_SOURCE", `${wanted} needs the "${needs}" source, which the node lacks`);
    problems.push(
      `DEFAULT_SOURCE=${wanted} will not work: enable "${needs}" on the node, or set DEFAULT_SOURCE to a source it has (${sources.join(", ")}).`
    );
  } else if (needs) {
    line(OK, "DEFAULT_SOURCE", wanted);
  }

  if (sources.length) {
    const probe = sources.includes("youtube")
      ? "ytsearch:daft punk one more time"
      : sources.includes("soundcloud")
        ? "scsearch:daft punk one more time"
        : null;

    if (probe) {
      try {
        const response = await fetch(
          `${base}/v4/loadtracks?identifier=${encodeURIComponent(probe)}`,
          { headers: { Authorization: password } }
        );
        const result = await response.json();

        if (result.loadType === "search" || result.loadType === "track") {
          const first = result.data?.[0]?.info ?? result.data?.info;
          line(OK, "Test search", `"${first?.title}" by ${first?.author}`);
        } else if (result.loadType === "error") {
          line(BAD, "Test search", result.data?.message || "failed");
          problems.push(
            `The node cannot load tracks: ${result.data?.message ?? "unknown error"}. This is the node's own network or plugin setup, not the bot.`
          );
        } else {
          line(WARN, "Test search", `nothing came back (${result.loadType})`);
        }
      } catch {
        line(WARN, "Test search", "could not run");
      }
    }
  }
}

console.log("");

if (!problems.length) {
  console.log("\x1b[32mEverything is ready. Start the bot with:  npm start\x1b[0m\n");
  process.exit(0);
}

console.log("\x1b[1mFix these first:\x1b[0m\n");
for (const [index, problem] of problems.entries()) {
  console.log(`  ${index + 1}. ${problem}`);
}
console.log("");
process.exit(1);
