const dias = require("../dias");
const { replyEphemeral, updateOrReply } = require("../utils/interactions");

module.exports = {
  async modal(interaction) {
    if (interaction.customId !== "dias:modal") return;

    const raw = interaction.fields.getTextInputValue("dias:fecha");
    const date = dias.parse(raw);

    if (!date) {
      await replyEphemeral(
        interaction,
        `Formato inválido \`${raw}\` — usa DD/MM/AAAA (ej. 15/03/2023), sin fechas futuras.`
      );
      return;
    }

    dias.set(interaction.user.id, date);
    console.log(
      `⏳ [${new Date().toISOString()}] ${interaction.user.tag}: inicio HRT ${date.toISOString().slice(0, 10)}`
    );
    const view = dias.buildView(interaction.user.id);
    try {
      await updateOrReply(interaction, view);
    } catch (err) {
      console.error("⏳ [dias] ⚠️ modal submit:", err.message);
    }
  },

  async button(interaction) {
    if (!interaction.customId.startsWith("dias:edit")) return;

    const current = dias.get(interaction.user.id)?.date ?? "";
    await interaction.showModal(dias.buildModal(current)).catch((err) => {
      console.error("⏳ [dias] ⚠️ modal:", err.message);
    });
  }
};
