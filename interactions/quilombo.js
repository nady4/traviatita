const quilombo = require("../quilombo");
const { replyEphemeral } = require("../utils/interactions");

module.exports = {
  async button(interaction) {
    if (!interaction.customId.startsWith("quilombo:reset")) return;

    if (!quilombo.canReset(interaction)) {
      await replyEphemeral(
        interaction,
        "🚫 No podés reiniciar la cuenta — solo quien tenga uno de los roles autorizados puede reportar el quilombo."
      );
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
      await replyEphemeral(interaction, "No pude reiniciar la cuenta.");
    }
  }
};
