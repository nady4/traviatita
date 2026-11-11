const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");

const NOTIFY_STORES = {
  otokonoko: { name: "Otokonoko Pharmacy", roleId: config.roles.otokonoko },
  astrovials: { name: "Astrovials", roleId: config.roles.astrovials }
};

function notifyRow(storeKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`notify:${storeKey}:on`)
      .setLabel("Notificarme cambios de stock")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`notify:${storeKey}:off`)
      .setLabel("Dejar de avisar")
      .setEmoji("🔕")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = { NOTIFY_STORES, notifyRow };
