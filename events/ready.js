const { Events } = require("discord.js");
const otokonoko = require("../otokonoko");
const astrovials = require("../astrovials");
const resumenes = require("../resumenes");
const hormonas = require("../hormonas");
const miembros = require("../miembros");
const travestir = require("../travestir");
const verificar = require("../verificar");
const verificaciones = require("../verificaciones");
const tweets = require("../tweets");

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`${client.user.tag} conectada 🫪`);
    otokonoko.start(client);
    astrovials.start(client);
    resumenes.start(client);
    hormonas.start(client);
    miembros.start(client);
    travestir.start(client);
    verificar.start(client);
    verificaciones.start(client);
    tweets.start(client);
  }
};
