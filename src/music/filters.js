export const FILTERS = {
  clear: {
    label: "Clear",
    description: "Remove every filter and go back to the original sound.",
    apply: async (filters) => {
      await filters.resetFilters();
      await filters.clearEQ();
    },
  },
  bassboost: {
    label: "Bass boost",
    description: "Heavier low end.",
    apply: (filters) => filters.setEQPreset("BassboostHigh"),
  },
  nightcore: {
    label: "Nightcore",
    description: "Faster and higher pitched.",
    apply: (filters) => filters.toggleNightcore(),
  },
  vaporwave: {
    label: "Vaporwave",
    description: "Slower and lower pitched.",
    apply: (filters) => filters.toggleVaporwave(),
  },
  eightd: {
    label: "8D",
    description: "The sound rotates around your head.",
    apply: (filters) => filters.toggleRotation(0.2),
  },
  karaoke: {
    label: "Karaoke",
    description: "Pulls the lead vocal down.",
    apply: (filters) => filters.toggleKaraoke(),
  },
  tremolo: {
    label: "Tremolo",
    description: "The volume wavers.",
    apply: (filters) => filters.toggleTremolo(),
  },
  vibrato: {
    label: "Vibrato",
    description: "The pitch wavers.",
    apply: (filters) => filters.toggleVibrato(),
  },
  lowpass: {
    label: "Low pass",
    description: "Cuts the highs, like music through a wall.",
    apply: (filters) => filters.toggleLowPass(),
  },
  pop: {
    label: "Pop",
    description: "An equalizer tuned for pop.",
    apply: (filters) => filters.setEQPreset("Pop"),
  },
  rock: {
    label: "Rock",
    description: "An equalizer tuned for rock.",
    apply: (filters) => filters.setEQPreset("Rock"),
  },
  electronic: {
    label: "Electronic",
    description: "An equalizer tuned for electronic music.",
    apply: (filters) => filters.setEQPreset("Electronic"),
  },
};

export async function applyFilter(player, name) {
  const filter = FILTERS[name];
  if (!filter) return null;

  if (name !== "clear" && isEqPreset(name)) await player.filterManager.clearEQ();
  await filter.apply(player.filterManager);

  return filter;
}

export function activeFilters(player) {
  const state = player?.filterManager?.filters ?? {};
  const names = [];

  if (state.nightcore) names.push("Nightcore");
  if (state.vaporwave) names.push("Vaporwave");
  if (state.rotation) names.push("8D");
  if (state.karaoke) names.push("Karaoke");
  if (state.tremolo) names.push("Tremolo");
  if (state.vibrato) names.push("Vibrato");
  if (state.lowPass) names.push("Low pass");
  const bands = player?.filterManager?.equalizerBands ?? [];
  if (bands.some((band) => band.gain !== 0)) names.push("EQ");

  return names;
}

function isEqPreset(name) {
  return ["bassboost", "pop", "rock", "electronic"].includes(name);
}
