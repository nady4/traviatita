const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const NOTIFY_STORES = {
  otokonoko: { name: "Otokonoko Pharmacy" },
  astrovials: { name: "Astrovials" }
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
