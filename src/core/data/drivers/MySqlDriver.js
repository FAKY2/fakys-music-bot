import { Driver } from "../Driver.js";

export class MySqlDriver extends Driver {
  constructor(options = {}) {
    super(options);

    this.pool = null;
    this.cache = new Map();
  }

  async init() {
    let mysql;
    try {
      mysql = await import("mysql2/promise");
    } catch {
      throw new Error(
        'The mysql driver needs the mysql2 package. Run "npm install mysql2" and start again.'
      );
    }

    this.pool = mysql.createPool({
      connectionLimit: 5,
      ...this.options,
    });

    await this.pool.query("CREATE TABLE IF NOT EXISTS store (k VARCHAR(255) PRIMARY KEY, v TEXT)");
  }

  async close() {
    await this.pool.end();
  }

  async get(key, fallback = null) {
    if (this.cache.has(key)) return this.cache.get(key);

    const [rows] = await this.pool.query("SELECT v FROM store WHERE k = ?", [key]);
    if (rows.length === 0) return fallback;

    const value = JSON.parse(rows[0].v);
    this.cache.set(key, value);
    return value;
  }

  async all() {
    const [rows] = await this.pool.query("SELECT k, v FROM store");
    return rows.map((row) => ({ key: row.k, value: JSON.parse(row.v) }));
  }

  async find(prefix) {
    const safe = prefix.replace(/([%_\\])/g, "\\$1");
    const [rows] = await this.pool.query("SELECT k, v FROM store WHERE k LIKE ?", [`${safe}%`]);
    return rows.map((row) => ({ key: row.k, value: JSON.parse(row.v) }));
  }

  async set(key, value) {
    this.cache.set(key, value);
    await this.pool.query(
      "INSERT INTO store (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
      [key, JSON.stringify(value)]
    );
  }

  async delete(key) {
    this.cache.delete(key);
    await this.pool.query("DELETE FROM store WHERE k = ?", [key]);
  }
}
