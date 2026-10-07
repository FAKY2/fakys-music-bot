import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;

export class JsonDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.json";
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
      const raw = await readFile(this.path, "utf8");
      try {
        this.cache = new Map(Object.entries(raw.trim() ? JSON.parse(raw) : {}));
      } catch {
        const backup = `${this.path}.broken-${Date.now()}`;
        await rename(this.path, backup);
        console.warn(`Could not parse ${this.path}. It was moved to ${backup}; starting empty.`);
      }
    }

    this.onExit = () => {
      if (this.timer) this.flushSync();
    };
    process.once("exit", this.onExit);
  }

  async close() {
    process.removeListener("exit", this.onExit);
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

  scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((error) => console.error(`Failed to save ${this.path}:`, error));
    }, SAVE_DELAY_MS);
  }

  serialize() {
    return JSON.stringify(Object.fromEntries(this.cache), null, 2);
  }

  flush() {
    this.saving = (this.saving || Promise.resolve()).then(async () => {
      const temp = `${this.path}.tmp`;
      await writeFile(temp, this.serialize(), "utf8");
      await rename(temp, this.path);
    });
    return this.saving;
  }

  flushSync() {
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, this.serialize(), "utf8");
    renameSync(temp, this.path);
  }
}
