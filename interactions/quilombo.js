const { MessageFlags } = require("discord.js");
const quilombo = require("../quilombo");

module.exports = {
  async button(interaction) {
    if (!interaction.customId.startsWith("quilombo:reset")) return;

    if (!quilombo.canReset(interaction)) {
      await interaction
        .reply({
          content:
            "🚫 No podés reiniciar la cuenta — solo quien tenga uno de los roles autorizados puede reportar el quilombo.",
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
      return;
    }

    try {
      const key = interaction.guildId ?? interaction.user.id;
      const { view, streak } = quilombo.reset(key);
      console.log(
        `💥 [${new Date().toISOString()}] ${interaction.user.tag}: quilombo — contador a cero`
      );
      await interaction.update(view);
      quilombo.announce(interaction.client, {
        user: interaction.user,
        guild: interaction.guild,
        streak
      });
    } catch (err) {
      console.error("💥 [quilombo] ⚠️ botón:", err.message);
      await interaction
        .reply({
          content: "No pude reiniciar la cuenta.",
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
    }
  }
};
