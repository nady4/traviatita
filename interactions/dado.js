const { MessageFlags } = require("discord.js");
const dado = require("../dado");

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
          await interaction
            .reply({
              content:
                "Ese número no vale — poné caras enteras entre 2 y 1.000.000.",
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
          return;
        }
        r = dado.resultStandard(sides);
      } else if (kind === "range") {
        const range = dado.parseRange(
          interaction.fields.getTextInputValue("dado:min"),
          interaction.fields.getTextInputValue("dado:max")
        );
        if (!range) {
          await interaction
            .reply({
              content:
                "Ese rango no vale — poné dos enteros (hasta ±1 billón) con mínimo ≤ máximo.",
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
          return;
        }
        r = dado.resultRange(range.min, range.max);
      } else {
        return;
      }

      const view = dado.buildView(interaction.user.id, r);
      try {
        if (interaction.isFromMessage()) {
          await interaction.update(view);
        } else {
          await interaction.reply({ flags: MessageFlags.Ephemeral, ...view });
        }
      } finally {
        console.log(
          `🎲 [${new Date().toISOString()}] ${interaction.user.tag}: tirada ${r.name} → ${r.value}`
        );
      }
    } catch (err) {
      console.error("🎲 [dado] ⚠️ modal submit:", err.message);
      await interaction
        .reply({
          content: "No pude registrar la tirada.",
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
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
        await interaction
          .reply({
            content: "No pude registrar la tirada.",
            flags: MessageFlags.Ephemeral
          })
          .catch(() => {});
      }
    }
  }
};
