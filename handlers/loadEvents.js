const path = require("path");
const { loadModules } = require("./loadModules");

function loadEvents(client) {
  const dir = path.join(__dirname, "..", "events");
  const events = loadModules(
    dir,
    (event) => event.name && event.execute,
    "Evento"
  );

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

module.exports = { loadEvents };
