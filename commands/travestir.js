const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const travestir = require("../travestir");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("travestir")
    .setDescription(
      "🏳️‍⚧️ Da el rol traviatense a todo el servidor (excepto bots)"
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "Este comando solo sirve dentro de un servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!travestir.canUse(interaction)) {
      await interaction.reply({
        content:
          "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const r = await travestir.assignAll(interaction.guild);
      await interaction.editReply(
        `✅ Listo: rol traviatense dado a **${r.added}** miembros (${r.already} ya lo tenían, ${r.skipped} omitidos, ${r.failed} fallaron).`
      );
    } catch (err) {
      console.error(`🏳️‍⚧️ [travestir] ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude repartir el rol (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
    }
  }
};
