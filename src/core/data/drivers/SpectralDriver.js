import { readFile, writeFile, rename, mkdir, appendFile } from "node:fs/promises";
import { existsSync, appendFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;
const HOT_KEYS = 128;
const US = "\x1F";
const HEADER = "#spectra3\n";

const MAGIC0 = 0x9d;
const MAGIC1 = 0x53;

function frame(text, hard = false) {
  const packed = deflateRawSync(Buffer.from(text, "utf8"), { level: hard ? 6 : 1 });
  const head = Buffer.from([MAGIC0, MAGIC1, 0, 0, 0, 0]);
  head.writeUInt32LE(packed.length, 2);
  return Buffer.concat([head, packed]);
}

function unframe(buffer) {
  const texts = [];
  let at = 0;

  while (at + 6 <= buffer.length) {
    if (buffer[at] !== MAGIC0 || buffer[at + 1] !== MAGIC1) break;
    const length = buffer.readUInt32LE(at + 2);
    if (at + 6 + length > buffer.length) break;

    try {
      texts.push(inflateRawSync(buffer.subarray(at + 6, at + 6 + length)).toString("utf8"));
    } catch {
      break;
    }
    at += 6 + length;
  }
  return texts.join("");
}

function encodeKey(key) {
  return key[0] === '"' || key.includes(US) || key.includes("\n") ? JSON.stringify(key) : key;
}

function decodeKey(text) {
  return text[0] === '"' ? JSON.parse(text) : text;
}

export class SpectralDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.spectra";

    this.dict = [];
    this.internMap = null;

    this.keys = new Map();

    this.young = new Map();
    this.old = new Map();

    this.pending = [];
    this.logLines = 0;
    this.timer = null;
    this.dirty = false;

    this.loading = null;
    this.ready = false;
    this.saving = null;
  }

  async init() {
    this.ensureLoaded().catch((error) => console.error(`Failed to load ${this.path}:`, error));

    this.onExit = () => {
      if (this.pending.length > 0) appendFileSync(this.path, frame(this.pending.join("")));
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
    const hit = this.young.get(key);
    if (hit !== undefined) return hit;

    if (this.old.has(key)) {
      const value = this.old.get(key);
      this.old.delete(key);
      this.warm(key, value);
      return value;
    }

    const id = this.keys.get(key);
    if (id === undefined) return fallback;

    const value = JSON.parse(this.dict[id]);
    this.warm(key, value);
    return value;
  }

  getRaw(key) {
    if (this.ready) {
      const id = this.keys.get(key);
      return id === undefined ? null : this.dict[id];
    }
    return this.ensureLoaded().then(() => this.getRaw(key));
  }

  all() {
    if (this.ready) {
      const rows = [];
      for (const key of this.keys.keys()) rows.push({ key, value: this.loadedGet(key) });
      return rows;
    }
    return this.ensureLoaded().then(() => this.all());
  }

  find(prefix) {
    if (this.ready) {
      const rows = [];
      for (const key of this.keys.keys()) {
        if (key.startsWith(prefix)) rows.push({ key, value: this.loadedGet(key) });
      }
      return rows;
    }
    return this.ensureLoaded().then(() => this.find(prefix));
  }

  set(key, value) {
    if (!this.ready) return this.ensureLoaded().then(() => this.set(key, value));

    const raw = JSON.stringify(value);
    this.keys.set(key, this.intern(raw));
    this.warm(key, value);
    this.dirty = true;
    this.record(`S${US}${encodeKey(key)}${US}${raw}\n`);
  }

  delete(key) {
    if (!this.ready) return this.ensureLoaded().then(() => this.delete(key));

    this.keys.delete(key);
    this.young.delete(key);
    this.old.delete(key);
    this.dirty = true;
    this.record(`D${US}${encodeKey(key)}\n`);
  }

  intern(raw) {
    if (!this.internMap) {
      this.internMap = new Map();
      for (let id = 0; id < this.dict.length; id++) {
        if (this.dict[id] !== undefined) this.internMap.set(this.dict[id], id);
      }
    }

    let id = this.internMap.get(raw);
    if (id === undefined) {
      id = this.dict.length;
      this.dict.push(raw);
      this.internMap.set(raw, id);
    }
    return id;
  }

  warm(key, value) {
    this.young.set(key, value);
    if (this.young.size > HOT_KEYS) {
      this.old = this.young;
      this.young = new Map();
    }
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
    const folder = dirname(this.path);
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }
    if (!existsSync(this.path)) {
      await writeFile(this.path, frame(HEADER, true));
      return;
    }

    const buffer = await readFile(this.path);

    const raw = buffer[0] === MAGIC0 && buffer[1] === MAGIC1 ? unframe(buffer) : buffer.toString("utf8");

    for (const line of raw.split("\n")) {
      if (!line || line[0] === "#") continue;
      this.logLines++;

      try {
        const [op, a, b] = line.split(US);
        if (op === "S") this.keys.set(decodeKey(a), this.intern(b));
        else if (op === "K") this.keys.set(decodeKey(a), parseInt(b, 36));
        else if (op === "V") this.dict[parseInt(a, 36)] = b;
        else if (op === "D") this.keys.delete(decodeKey(a));
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

    if (this.logLines > this.keys.size * 2 + 100) {
      return this.compact();
    }

    await appendFile(this.path, frame(lines.join("")));
  }

  async compact() {
    const parts = [HEADER];
    const dict = [];
    const internMap = new Map();
    const keep = new Map();

    for (const [key, oldId] of this.keys) {
      const raw = this.dict[oldId];
      let id = internMap.get(raw);

      if (id === undefined) {
        id = dict.length;
        dict.push(raw);
        internMap.set(raw, id);
        parts.push(`V${US}${id.toString(36)}${US}${raw}\n`);
      }
      keep.set(key, id);
      parts.push(`K${US}${encodeKey(key)}${US}${id.toString(36)}\n`);
    }

    const temp = `${this.path}.tmp`;
    await writeFile(temp, frame(parts.join(""), true));
    await rename(temp, this.path);

    this.dict = dict;
    this.internMap = internMap;
    this.keys = keep;
    this.logLines = parts.length - 1;
  }
}
