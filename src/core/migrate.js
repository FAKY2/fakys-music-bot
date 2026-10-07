import { Database } from "./data/Database.js";

const [from, to] = process.argv.slice(2);

if (!from || !to) {
  console.error("Usage: npm run migrate -- <from> <to>");
  console.error('Example: npm run migrate -- sqlite spectral');
  process.exit(1);
}

const source = new Database({ driver: from });
const target = new Database({ driver: to });

await source.init();
await target.init();

const rows = await source.all();
for (const { key, value } of rows) {
  await target.set(key, value);
}

await target.close();
await source.close();

console.log(`Moved ${rows.length} entr${rows.length === 1 ? "y" : "ies"} from ${from} to ${to}.`);
console.log(`Now set driver: "${to}" in data/database.js and restart the bot.`);
