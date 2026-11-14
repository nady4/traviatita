const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./handlers/loadCommands");
const { loadEvents } = require("./handlers/loadEvents");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("error", (err) => {
  console.error("⚠️ [gateway] error:", err.message);
});

client.on("shardError", (err) => {
  console.error("⚠️ [gateway] error de shard:", err.message);
});

client.on("warn", (info) => {
  console.warn(`⚠️ [gateway] ${info}`);
});

process.on("unhandledRejection", (reason) => {
  console.error(
    "⚠️ [proceso] rechazo de promesa no manejado:",
    reason instanceof Error ? reason.message : reason
  );
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ [proceso] excepción no capturada:", err.stack ?? err.message);
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
