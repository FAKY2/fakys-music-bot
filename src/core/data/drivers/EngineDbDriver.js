import { readFile, writeFile, appendFile, rename, mkdir } from "node:fs/promises";
import { existsSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;
const US = "\x1F";

export class EngineDbDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.edb";
    this.cache = new Map();

    this.pending = [];
    this.logLines = 0;
    this.timer = null;

    this.saving = null;
  }

  async init() {
    const folder = dirname(this.path);
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    if (existsSync(this.path)) {
      this.load(await readFile(this.path, "utf8"));
    }

    this.onExit = () => {
      if (this.pending.length > 0) appendFileSync(this.path, this.pending.join(""), "utf8");
    };
    process.once("exit", this.onExit);
  }

  async close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    process.removeListener("exit", this.onExit);
    await this.flush();
  }

  async get(key, fallback = null) {
    return this.cache.has(key) ? this.cache.get(key) : fallback;
  }

  async all() {
    return [...this.cache].map(([key, value]) => ({ key, value }));
  }

  set(key, value) {
    this.cache.set(key, value);
    this.record(`S${US}${JSON.stringify(key)}${US}${JSON.stringify(value)}\n`);
  }

  delete(key) {
    this.cache.delete(key);
    this.record(`D${US}${JSON.stringify(key)}\n`);
  }

  load(raw) {
    this.logLines = 0;

    for (const line of raw.split("\n")) {
      if (!line) continue;
      this.logLines++;

      try {
        const [op, key, value] = line.split(US);
        if (op === "S") this.cache.set(JSON.parse(key), JSON.parse(value));
        else if (op === "D") this.cache.delete(JSON.parse(key));
      } catch {}
    }
  }

  record(line) {
    this.pending.push(line);

    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((error) => console.error(`Failed to save ${this.path}:`, error));
    }, SAVE_DELAY_MS);
  }

  flush() {
    this.saving = (this.saving || Promise.resolve()).then(() => this.writeBatch());
    return this.saving;
  }

  async writeBatch() {
    if (this.pending.length === 0) return;

    const lines = this.pending;
    this.pending = [];
    this.logLines += lines.length;

    if (this.logLines > this.cache.size * 2 + 100) {
      return this.compact();
    }

    await appendFile(this.path, lines.join(""), "utf8");
  }

  async compact() {
    const snapshot = [...this.cache]
      .map(([key, value]) => `S${US}${JSON.stringify(key)}${US}${JSON.stringify(value)}\n`)
      .join("");

    const temp = `${this.path}.tmp`;
    await writeFile(temp, snapshot, "utf8");
    await rename(temp, this.path);
    this.logLines = this.cache.size;
  }
}
