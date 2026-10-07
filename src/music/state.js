const states = new Map();

class State {
  constructor(guildId) {
    this.guildId = guildId;
    this.channelId = null;
    this.messageId = null;
    this.autoplay = false;
    this.seeded = new Set();
  }
}

export function getState(guildId) {
  let state = states.get(guildId);
  if (!state) {
    state = new State(guildId);
    states.set(guildId, state);
  }
  return state;
}

export function peekState(guildId) {
  return states.get(guildId) ?? null;
}

export function dropState(guildId) {
  states.delete(guildId);
}
