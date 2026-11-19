const { Events } = require("discord.js");
const otokonoko = require("../services/otokonoko");
const astrovials = require("../services/astrovials");
const resumenes = require("../services/resumenes");
const hormonas = require("../services/hormonas");
const miembros = require("../services/miembros");
const travestir = require("../services/travestir");
const verificar = require("../services/verificar");
const verificaciones = require("../services/verificaciones");
const tweets = require("../services/tweets");
const autoroles = require("../services/autoroles");
const logs = require("../services/logs");

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
    autoroles.start(client);
    logs.start(client);
  }
};
