const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

function loadCommands() {
  const commands = new Collection();
  const dir = path.join(__dirname, "..", "commands");

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const command = require(path.join(dir, file));
    if (!command.data || !command.execute) {
      throw new Error(`Comando inválido: ${file}`);
    }
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
