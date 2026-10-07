import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Driver } from "../Driver.js";

const SAVE_DELAY_MS = 200;

export class SqliteDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.path = options.path || "./data/store.sqlite";
    this.db = null;
    this.cache = new Map();

    this.pending = new Map();
    this.timer = null;
  }

  async init() {
    let sqlite;
    try {
      sqlite = await import("node:sqlite");
    } catch {
      throw new Error(
        'The sqlite driver needs Node 22.5 or newer. Update Node, or pick "enginedb" or "json" in data/database.js.'
      );
    }

    const folder = dirname(this.path);
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    this.db = new sqlite.DatabaseSync(this.path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v TEXT)");

    this.stmts = {
      get: this.db.prepare("SELECT v FROM store WHERE k = ?"),
      set: this.db.prepare("INSERT INTO store (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v"),
      delete: this.db.prepare("DELETE FROM store WHERE k = ?"),
      all: this.db.prepare("SELECT k, v FROM store"),
      find: this.db.prepare("SELECT k, v FROM store WHERE k LIKE ? ESCAPE '\\'"),
    };

    this.onExit = () => this.flushNow();
    process.once("exit", this.onExit);
  }

  async close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    process.removeListener("exit", this.onExit);
    this.flushNow();
    this.db.close();
  }

  async get(key, fallback = null) {
    if (this.pending.has(key)) {
      const value = this.pending.get(key);
      return value === null ? fallback : value;
    }
    if (this.cache.has(key)) return this.cache.get(key);

    const row = this.stmts.get.get(key);
    if (!row) return fallback;

    const value = JSON.parse(row.v);
    this.cache.set(key, value);
    return value;
  }

  async all() {
    this.flushNow();
    return this.stmts.all.all().map((row) => ({ key: row.k, value: JSON.parse(row.v) }));
  }

  async find(prefix) {
    this.flushNow();
    const safe = prefix.replace(/([%_\\])/g, "\\$1");
    return this.stmts.find.all(`${safe}%`).map((row) => ({ key: row.k, value: JSON.parse(row.v) }));
  }

  async set(key, value) {
    this.cache.set(key, value);
    this.pending.set(key, value);
    this.scheduleSave();
  }

  async delete(key) {
    this.cache.delete(key);
    this.pending.set(key, null);
    this.scheduleSave();
  }

  scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.flushNow();
      } catch (error) {
        console.error(`Failed to save ${this.path}:`, error);
      }
    }, SAVE_DELAY_MS);
  }

  flushNow() {
    if (this.pending.size === 0) return;

    const batch = this.pending;
    this.pending = new Map();

    this.db.exec("BEGIN");
    try {
      for (const [key, value] of batch) {
        if (value === null) this.stmts.delete.run(key);
        else this.stmts.set.run(key, JSON.stringify(value));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
