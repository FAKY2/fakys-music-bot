
export class Driver {
  constructor(options = {}) {
    this.options = options;
  }

  async init() {
    throw new Error(`${this.constructor.name} must implement init()`);
  }

  async close() {}

  async get(key, fallback = null) {
    throw new Error(`${this.constructor.name} must implement get()`);
  }

  async all() {
    throw new Error(`${this.constructor.name} must implement all()`);
  }

  async find(prefix) {
    const rows = await this.all();
    return rows.filter((row) => row.key.startsWith(prefix));
  }

  async set(key, value) {
    throw new Error(`${this.constructor.name} must implement set()`);
  }

  async delete(key) {
    throw new Error(`${this.constructor.name} must implement delete()`);
  }
}
