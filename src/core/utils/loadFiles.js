import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadFiles(folder) {
  const modules = [];

  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = join(folder, entry.name);

    if (entry.isDirectory()) {
      modules.push(...(await loadFiles(full)));
      continue;
    }

    if (!entry.name.endsWith(".js")) continue;

    const imported = await import(pathToFileURL(full).href);
    if (imported.default) {
      modules.push(imported.default);
    }
  }

  return modules;
}
