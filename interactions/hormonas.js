const { MessageFlags } = require("discord.js");
const hormonas = require("../hormonas");

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
      await interaction
        .reply({
          content: "Error gestionando el recordatorio.",
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
    }
  }
};
