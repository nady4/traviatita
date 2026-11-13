const dado = require("../dado");
const { replyEphemeral, updateOrReply } = require("../utils/interactions");

module.exports = {
  async modal(interaction) {
    if (!interaction.customId.startsWith("dado:modal:")) return;

    const kind = interaction.customId.split(":")[2];
    try {
      let r = null;
      if (kind === "sides") {
        const sides = dado.parseSides(
          interaction.fields.getTextInputValue("dado:lados")
        );
        if (!sides) {
          await replyEphemeral(
            interaction,
            "Ese número no vale — poné caras enteras entre 2 y 1.000.000."
          );
          return;
        }
        r = dado.resultStandard(sides);
      } else if (kind === "range") {
        const range = dado.parseRange(
          interaction.fields.getTextInputValue("dado:min"),
          interaction.fields.getTextInputValue("dado:max")
        );
        if (!range) {
          await replyEphemeral(
            interaction,
            "Ese rango no vale — poné dos enteros (hasta ±1 billón) con mínimo ≤ máximo."
          );
          return;
        }
        r = dado.resultRange(range.min, range.max);
      } else {
        return;
      }

      const view = dado.buildView(interaction.user.id, r);
      try {
        await updateOrReply(interaction, view);
      } finally {
        console.log(
          `🎲 [${new Date().toISOString()}] ${interaction.user.tag}: tirada ${r.name} → ${r.value}`
        );
      }
    } catch (err) {
      console.error("🎲 [dado] ⚠️ modal submit:", err.message);
      await replyEphemeral(interaction, "No pude registrar la tirada.");
    }
  },

  async button(interaction) {
    if (interaction.customId.startsWith("dado:custom")) {
      await interaction.showModal(dado.buildSidesModal()).catch((err) => {
        console.error("🎲 [dado] ⚠️ modal:", err.message);
      });
      return;
    }

    if (interaction.customId.startsWith("dado:range")) {
      await interaction.showModal(dado.buildRangeModal()).catch((err) => {
        console.error("🎲 [dado] ⚠️ modal:", err.message);
      });
      return;
    }

    if (interaction.customId.startsWith("dado:roll")) {
      const sides = Number(interaction.customId.split(":")[2]);
      try {
        const r = dado.resultStandard(sides);
        await interaction.update(dado.buildView(interaction.user.id, r));
        console.log(
          `🎲 [${new Date().toISOString()}] ${interaction.user.tag}: tirada ${r.name} → ${r.value}`
        );
      } catch (err) {
        console.error("🎲 [dado] ⚠️ botón:", err.message);
        await replyEphemeral(interaction, "No pude registrar la tirada.");
      }
    }
  }
};
