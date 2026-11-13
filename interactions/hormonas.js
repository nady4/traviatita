const hormonas = require("../hormonas");
const { replyEphemeral } = require("../utils/interactions");

module.exports = {
  async button(interaction) {
    if (!interaction.customId.startsWith("hormonas:")) return;

    const [, action, key] = interaction.customId.split(":");
    try {
      if (action === "set" && hormonas.INTERVALS[key]) {
        const r = hormonas.set(interaction.user.id, key);
        const label = hormonas.INTERVALS[key].label;
        console.log(
          `⏰ [${new Date().toISOString()}] ${interaction.user.tag}: recordatorio ${label} · próxima ${r.next}`
        );
      } else if (action === "cancel") {
        hormonas.cancel(interaction.user.id);
      } else {
        return;
      }
      await interaction.update(hormonas.view(interaction.user.id));
    } catch (err) {
      console.error("⏰ [hormonas] ⚠️ botón:", err.message);
      await replyEphemeral(interaction, "Error gestionando el recordatorio.");
    }
  }
};
