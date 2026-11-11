const fs = require("fs");
const path = require("path");

function loadEvents(client) {
  const dir = path.join(__dirname, "..", "events");

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const event = require(path.join(dir, file));
    if (!event.name || !event.execute) {
      throw new Error(`Evento inválido: ${file}`);
    }
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

module.exports = { loadEvents };
