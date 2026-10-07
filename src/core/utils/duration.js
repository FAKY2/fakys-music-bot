
const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export function parseDuration(text) {
  if (!text) return null;

  const matches = text.toLowerCase().matchAll(/(\d+)([smhdw])/g);

  let total = 0;
  let found = false;
  for (const [, amount, unit] of matches) {
    total += Number(amount) * UNITS[unit];
    found = true;
  }

  return found ? total : null;
}
