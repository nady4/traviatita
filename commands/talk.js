const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("talk")
    .setDescription("💬 Traviatita repite lo que le digas")
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("Lo que quieras que Traviatita diga")
        .setRequired(true)
    ),

  async execute(interaction) {
    const mensaje = interaction.options.getString("mensaje");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.channel.send(mensaje);
      await interaction.deleteReply();
      console.log(
        `💌 [${new Date().toISOString()}] Mensaje de ${interaction.user.tag} en #${interaction.channel.name}`
      );
    } catch (error) {
      console.error("💬 [talk] ⚠️ no pude enviar el mensaje:", error.message);
      await interaction.editReply(
        "No pude enviar tu mensaje (revisa mis permisos en el canal)."
      );
    }
  }
};
