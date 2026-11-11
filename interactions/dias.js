const { MessageFlags } = require("discord.js");
const dias = require("../dias");

module.exports = {
  async modal(interaction) {
    if (interaction.customId !== "dias:modal") return;

    const raw = interaction.fields.getTextInputValue("dias:fecha");
    const date = dias.parse(raw);

    if (!date) {
      await interaction
        .reply({
          content: `Formato inválido \`${raw}\` — usa DD/MM/AAAA (ej. 15/03/2023), sin fechas futuras.`,
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
      return;
    }

    dias.set(interaction.user.id, date);
    console.log(
      `⏳ [${new Date().toISOString()}] ${interaction.user.tag}: inicio HRT ${date.toISOString().slice(0, 10)}`
    );
    const view = dias.buildView(interaction.user.id);
    try {
      if (interaction.isFromMessage()) {
        await interaction.update(view);
      } else {
        await interaction.reply({ flags: MessageFlags.Ephemeral, ...view });
      }
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
