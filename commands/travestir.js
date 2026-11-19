const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const travestir = require("../services/travestir");
const { defineCommand } = require("../utils/command");

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("travestir")
    .setDescription(
      "🏳️‍⚧️ Da el rol traviatense a todo el servidor (excepto bots)"
    ),

  guildOnly: true,
  roles: [travestir.ROLE_200KG],
  roleMessage: "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",

  async run(interaction) {
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
});
