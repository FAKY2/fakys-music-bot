import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;

export class TextDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.txt";
    this.cache = new Map();
    this.timer = null;

    this.saving = null;
  }

  async init() {
    const folder = dirname(this.path);
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    if (existsSync(this.path)) {
      await this.load();
    }
  }

  async close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      await this.flush();
    }
  }

  async get(key, fallback = null) {
    return this.cache.has(key) ? this.cache.get(key) : fallback;
  }

  async all() {
    return [...this.cache].map(([key, value]) => ({ key, value }));
  }

  async set(key, value) {
    this.cache.set(key, value);
    this.scheduleSave();
  }

  async delete(key) {
    this.cache.delete(key);
    this.scheduleSave();
  }

  async load() {
    const raw = await readFile(this.path, "utf8");
    this.cache.clear();

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const tab = line.indexOf("\t");
      this.cache.set(line.slice(0, tab), JSON.parse(line.slice(tab + 1)));
    }
  }

  scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((error) => console.error(`Failed to save ${this.path}:`, error));
    }, SAVE_DELAY_MS);
  }

  flush() {
    this.saving = (this.saving || Promise.resolve()).then(async () => {
      const lines = [...this.cache]
        .map(([key, value]) => `${key}\t${JSON.stringify(value)}`)
        .join("\n");

      const temp = `${this.path}.tmp`;
      await writeFile(temp, lines, "utf8");
      await rename(temp, this.path);
    });
    return this.saving;
  }
}
