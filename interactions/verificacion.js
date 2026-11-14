const verificaciones = require("../verificaciones");

module.exports = {
  async button(interaction) {
    const [, action, channelId] = interaction.customId.split(":");

    if (action === "open") {
      await verificaciones.openTicket(interaction);
      return;
    }

    if (action === "cancel") {
      await verificaciones.cancelTicket(interaction, channelId);
      return;
    }

    if (action === "accept") {
      await verificaciones.acceptTicket(interaction, channelId);
      return;
    }

    if (action === "reject") {
      await verificaciones.rejectTicket(interaction, channelId);
    }
  }
};
