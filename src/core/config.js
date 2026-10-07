import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in your .env file. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function bool(name, fallback) {
  const value = optional(name, null);
  if (value === null) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function number(name, fallback) {
  const value = Number(optional(name, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  token: required("TOKEN"),
  prefix: optional("PREFIX", "!"),

  lavalink: {
    id: optional("LAVALINK_ID", "main"),
    host: optional("LAVALINK_HOST", "localhost"),
    port: number("LAVALINK_PORT", 2333),
    authorization: optional("LAVALINK_PASSWORD", "youshallnotpass"),
    secure: bool("LAVALINK_SECURE", false),
  },

  music: {
    source: optional("DEFAULT_SOURCE", "ytmsearch"),
    volume: Math.max(0, Math.min(200, number("DEFAULT_VOLUME", 100))),
  },
};
