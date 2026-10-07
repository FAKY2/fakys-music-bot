import { Driver } from "../Driver.js";

export class MemoryDriver extends Driver {
  constructor(options = {}) {
    super(options);
    this.cache = new Map();
  }

  async init() {}

  async get(key, fallback = null) {
    return this.cache.has(key) ? this.cache.get(key) : fallback;
  }

  async all() {
    return [...this.cache].map(([key, value]) => ({ key, value }));
  }

  async set(key, value) {
    this.cache.set(key, value);
  }

  async delete(key) {
    this.cache.delete(key);
  }
}
