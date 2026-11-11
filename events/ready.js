const { Events } = require("discord.js");
const otokonoko = require("../otokonoko");
const astrovials = require("../astrovials");
const hormonas = require("../hormonas");
const travestir = require("../travestir");

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`☑️ Conectado como ${client.user.tag}`);
    otokonoko.start(client);
    astrovials.start(client);
    hormonas.start(client);
    travestir.start(client);
  }
};
