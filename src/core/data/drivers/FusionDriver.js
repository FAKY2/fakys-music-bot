import { readFile, writeFile, rename, mkdir, appendFile } from "node:fs/promises";
import { existsSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;
const US = "\x1F";
const HEADER = "#fusion1\n";

class RawCell {
  constructor(raw) {
    this.raw = raw;
  }
}

function parseKey(encoded) {
  return encoded.indexOf("\\") === -1 ? encoded.slice(1, -1) : JSON.parse(encoded);
}

export class FusionDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.fusion";
    this.cache = new Map();

    this.pending = [];
    this.logLines = 0;
    this.timer = null;
    this.dirty = false;

    this.loading = null;
    this.ready = false;

    this.saving = null;
  }

  async init() {
    const folder = dirname(this.path);
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    this.ensureLoaded().catch((error) => console.error(`Failed to load ${this.path}:`, error));

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
    await this.ensureLoaded();
    await this.flush();

    if (this.dirty) {
      await this.compact();
      this.dirty = false;
    }
  }

  get(key, fallback = null) {
    if (this.ready) return this.loadedGet(key, fallback);
    return this.ensureLoaded().then(() => this.loadedGet(key, fallback));
  }

  loadedGet(key, fallback = null) {
    const value = this.cache.get(key);
    if (value === undefined) return fallback;
    if (value instanceof RawCell) return this.materialize(key, value, fallback);
    return value;
  }

  all() {
    if (this.ready) {
      const rows = [];
      for (const key of this.cache.keys()) {
        rows.push({ key, value: this.get(key) });
      }
      return rows;
    }
    return this.ensureLoaded().then(() => this.all());
  }

  find(prefix) {
    if (this.ready) {
      const rows = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) rows.push({ key, value: this.get(key) });
      }
      return rows;
    }
    return this.ensureLoaded().then(() => this.find(prefix));
  }

  async set(key, value) {
    if (!this.ready) await this.ensureLoaded();
    this.cache.set(key, value);
    this.dirty = true;
    this.record(`S${US}${JSON.stringify(key)}${US}${JSON.stringify(value)}\n`);
  }

  async delete(key) {
    if (!this.ready) await this.ensureLoaded();
    this.cache.delete(key);
    this.dirty = true;
    this.record(`D${US}${JSON.stringify(key)}\n`);
  }

  ensureLoaded() {
    if (!this.loading) {
      this.loading = this.loadNow().then(() => {
        this.ready = true;
        this.get = this.loadedGet;

      });
    }
    return this.loading;
  }

  async loadNow() {
    if (!existsSync(this.path)) {
      await writeFile(this.path, HEADER, "utf8");
      return;
    }

    const raw = await readFile(this.path, "utf8");
    const dict = new Map();

    for (const line of raw.split("\n")) {
      if (!line || line[0] === "#") continue;
      this.logLines++;

      try {
        const [op, a, b] = line.split(US);
        if (op === "S") this.cache.set(parseKey(a), new RawCell(b));
        else if (op === "D") this.cache.delete(parseKey(a));
        else if (op === "V") dict.set(a, b);
        else if (op === "K") this.cache.set(parseKey(a), new RawCell(dict.get(b)));
      } catch {}
    }
  }

  materialize(key, cell, fallback) {
    try {
      const value = JSON.parse(cell.raw);
      this.cache.set(key, value);
      return value;
    } catch {
      this.cache.delete(key);
      return fallback;
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
    const parts = [HEADER];
    const seen = new Map();
    let nextId = 0;

    for (const [key, value] of this.cache) {
      const raw = value instanceof RawCell ? value.raw : JSON.stringify(value);
      let id = seen.get(raw);

      if (id === undefined) {
        id = nextId++;
        seen.set(raw, id);
        parts.push(`V${US}${id}${US}${raw}\n`);
      }
      parts.push(`K${US}${JSON.stringify(key)}${US}${id}\n`);
    }

    const temp = `${this.path}.tmp`;
    await writeFile(temp, parts.join(""), "utf8");
    await rename(temp, this.path);
    this.logLines = parts.length - 1;
  }
}
