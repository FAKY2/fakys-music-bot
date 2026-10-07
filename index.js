import { EngineBot } from "./src/core/engineBot.js";

new EngineBot().start().catch((error) => {
  console.error("The bot failed to start:");
  console.error(error);
  process.exit(1);
});
