const { REST, Routes } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");

async function main() {
  const commands = loadCommands().map((command) => command.data.toJSON());
  const rest = new REST().setToken(config.token);
  const app = await rest.get(Routes.currentApplication());

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(app.id, config.guildId), {
      body: commands
    });
    console.log(
      `⚡ ${commands.length} comandos registrados en el servidor ${config.guildId}`
    );

    const globalCommands = await rest.get(Routes.applicationCommands(app.id));
    if (globalCommands.length > 0) {
      await rest.put(Routes.applicationCommands(app.id), { body: [] });
      console.log(
        "🧹 comandos globales eliminados (pueden tardar hasta 1 h en desaparecer del cliente)"
      );
    }
    return;
  }

  await rest.put(Routes.applicationCommands(app.id), { body: commands });
  console.log(`⚡ ${commands.length} comandos registrados globalmente`);
}

main().catch((err) => {
  console.error(`⚠️ [deploy] ${err.message}`);
  process.exit(1);
});
