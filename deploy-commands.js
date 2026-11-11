const { REST, Routes } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");

async function main() {
  const commands = loadCommands().map((command) => command.data.toJSON());
  const rest = new REST().setToken(config.token);
  const app = await rest.get(Routes.currentApplication());

  await rest.put(Routes.applicationCommands(app.id), { body: commands });
  console.log(`⚡ ${commands.length} comandos registrados`);
}

main().catch((err) => {
  console.error(`⚠️ [deploy] ${err.message}`);
  process.exit(1);
});
