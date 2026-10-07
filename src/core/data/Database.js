import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { Driver } from "./Driver.js";
import { SqliteDriver } from "./drivers/SqliteDriver.js";
import { EngineDbDriver } from "./drivers/EngineDbDriver.js";
import { SpectralDriver } from "./drivers/SpectralDriver.js";
import { FusionDriver } from "./drivers/FusionDriver.js";
import { JsonDriver } from "./drivers/JsonDriver.js";
import { TextDriver } from "./drivers/TextDriver.js";
import { MySqlDriver } from "./drivers/MySqlDriver.js";
import { MemoryDriver } from "./drivers/MemoryDriver.js";

const DRIVERS = {
  sqlite: SqliteDriver,
  enginedb: EngineDbDriver,
  fusion: FusionDriver,
  spectral: SpectralDriver,
  json: JsonDriver,
  text: TextDriver,
  mysql: MySqlDriver,
  memory: MemoryDriver,
};

const MISSING = Symbol("missing");

export class Database {
  constructor(settings = {}) {
    this.settings = settings;
    this.driver = null;
  }

  async init(settings = this.settings) {
    let name = settings.driver || "auto";
    const options = settings.options || {};

    if (name === "auto") {
      name = await import("node:sqlite").then(() => "sqlite").catch(() => "enginedb");
    }

    let DriverClass = DRIVERS[name];

    if (!DriverClass && (name.includes("/") || name.includes("\\"))) {
      const imported = await import(pathToFileURL(resolve(name)).href);
      DriverClass = imported.default;

      if (!DriverClass || !(DriverClass.prototype instanceof Driver)) {
        throw new Error(
          `${name} must export a default class extending Driver (see src/core/data/Driver.js).`
        );
      }
    }

    if (!DriverClass) {
      const known = Object.keys(DRIVERS).join(", ");
      throw new Error(
        `Unknown data driver "${name}". Use one of: ${known}, or a path to your own driver file.`
      );
    }

    this.driver = new DriverClass(options);
    await this.driver.init();
  }

  close() {
    return this.driver.close();
  }

  get(key, fallback = null) {
    return this.driver.get(key, fallback);
  }

  async has(key) {
    return (await this.driver.get(key, MISSING)) !== MISSING;
  }

  all() {
    return this.driver.all();
  }

  find(prefix) {
    return this.driver.find(prefix);
  }

  async getRaw(key) {
    if (this.driver.getRaw) return this.driver.getRaw(key);

    const value = await this.driver.get(key, MISSING);
    return value === MISSING ? null : JSON.stringify(value);
  }

  set(key, value) {
    return this.driver.set(key, value);
  }

  delete(key) {
    return this.driver.delete(key);
  }

  async push(key, ...values) {
    const list = (await this.get(key)) || [];
    list.push(...values);
    await this.set(key, list);
    return list;
  }

  async pull(key, value) {
    const list = (await this.get(key)) || [];
    const kept = list.filter((item) => item !== value);
    await this.set(key, kept);
    return kept;
  }

  async add(key, amount = 1) {
    const total = ((await this.get(key)) || 0) + amount;
    await this.set(key, total);
    return total;
  }
}
