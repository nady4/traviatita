const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");
const { loadEvents } = require("./handlers/loadEvents");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = loadCommands();
loadEvents(client);

client.login(config.token).catch((err) => {
  console.error("⚠️ no pude conectar:", err.message);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n${signal} recibido, cerrando...`);
    client.destroy().finally(() => process.exit(0));
  });
}
