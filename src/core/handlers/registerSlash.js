import { REST, Routes } from "discord.js";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { CommandType } from "../command.js";

const CACHE_PATH = "./data/.slash-cache";

function applicationIdFromToken(token) {
  const id = Buffer.from(token.split(".")[0], "base64").toString("utf8");
  if (!/^\d{15,25}$/.test(id)) {
    throw new Error("That TOKEN does not look like a bot token. Copy it from the Developer Portal, under Bot.");
  }
  return id;
}

export async function registerSlash(commands, config) {
  const slash = commands.filter(
    (command) => command.type === CommandType.Slash || command.type === CommandType.Both
  );

  const body = slash.map((command) => ({
    name: command.name,
    description: command.description || "No description.",
    options: command.options || [],
  }));

  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");

  const previous = await readFile(CACHE_PATH, "utf8").catch(() => null);
  if (previous === hash) {
    console.log(`Slash commands unchanged (${body.length}), skipping sync.`);
    return;
  }

  const rest = new REST().setToken(config.token);
  await rest.put(Routes.applicationCommands(applicationIdFromToken(config.token)), { body });
  console.log(`Registered ${body.length} slash command(s).`);

  await writeFile(CACHE_PATH, hash, "utf8").catch(() => {
  });
}
