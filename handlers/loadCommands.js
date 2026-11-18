const path = require("path");
const { Collection } = require("discord.js");
const { loadModules } = require("./loadModules");

function loadCommands() {
  const commands = new Collection();
  const dir = path.join(__dirname, "..", "commands");
  const loaded = loadModules(
    dir,
    (command) => command.data && command.execute,
    "Comando"
  );

  for (const command of loaded) {
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
