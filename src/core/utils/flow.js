

const windows = new Map();

export function coalesce(key, delay, job) {
  const slot = windows.get(key);
  if (slot) {
    slot.next = job;
    return;
  }

  windows.set(key, { next: null, timer: null });
  fire(key, job);
  arm(key, delay);
}

function arm(key, delay) {
  const slot = windows.get(key);
  slot.timer = setTimeout(() => {
    const { next } = slot;
    if (!next) {
      windows.delete(key);
      return;
    }
    slot.next = null;
    fire(key, next);
    arm(key, delay);
  }, delay);
}

function fire(key, job) {
  Promise.resolve()
    .then(job)
    .catch((error) => console.error(`coalesce(${key}) job failed:`, error));
}

const chains = new Map();

export function withLock(key, job) {
  const chain = (chains.get(key) || Promise.resolve()).catch(() => {}).then(job);
  chains.set(key, chain);

  const cleanup = () => {
    if (chains.get(key) === chain) chains.delete(key);
  };
  chain.then(cleanup, cleanup);
  return chain;
}
