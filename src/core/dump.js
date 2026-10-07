import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Database } from "./data/Database.js";

const settings = process.argv[2]
  ? { driver: process.argv[2] }
  : await import(pathToFileURL(resolve("./data/database.js")).href)
      .then((loaded) => loaded.database)
      .catch(() => ({ driver: "auto" }));

const db = new Database(settings);
await db.init();

const rows = await db.all();
for (const { key } of rows) {
  console.log(`${key}\t${await db.getRaw(key)}`);
}

await db.close();
console.error(`${rows.length} entr${rows.length === 1 ? "y" : "ies"}.`);
