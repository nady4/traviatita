const { Events } = require("discord.js");
const otokonoko = require("../otokonoko");
const astrovials = require("../astrovials");
const resumenes = require("../resumenes");
const hormonas = require("../hormonas");
const travestir = require("../travestir");

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`${client.user.tag} conectada 🫪`);
    otokonoko.start(client);
    astrovials.start(client);
    resumenes.start(client);
    hormonas.start(client);
    travestir.start(client);
  }
};
