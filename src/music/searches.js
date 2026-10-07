
const TTL = 10 * 60 * 1000;

const results = new Map();

let counter = 0;

export function remember(guildId, userId, tracks) {
  sweep();

  const ticket = `${Date.now().toString(36)}${(counter++).toString(36)}`;
  results.set(ticket, { guildId, userId, tracks, at: Date.now() });
  return ticket;
}

export function recall(ticket, guildId, userId) {
  const entry = results.get(ticket);
  if (!entry) return null;

  if (Date.now() - entry.at > TTL) {
    results.delete(ticket);
    return null;
  }

  if (entry.guildId !== guildId || entry.userId !== userId) return null;
  return entry.tracks;
}

export function forget(ticket) {
  results.delete(ticket);
}

function sweep() {
  const cutoff = Date.now() - TTL;
  for (const [ticket, entry] of results) {
    if (entry.at < cutoff) results.delete(ticket);
  }
}
