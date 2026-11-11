const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("talk")
    .setDescription("El bot repite lo que le digas")
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("Lo que quieres que el bot diga")
        .setRequired(true)
    ),

  async execute(interaction) {
    const mensaje = interaction.options.getString("mensaje");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.channel.send(mensaje);
      await interaction.deleteReply();
      console.log(
        `💌 [${new Date().toISOString()}] Confesión de ${interaction.user.tag} en #${interaction.channel.name}`
      );
    } catch (error) {
      console.error("💌 [talk] ⚠️ no pude enviar la confesión:", error.message);
      await interaction.editReply(
        "No pude enviar tu confesión (revisa mis permisos en el canal)."
      );
    }
  }
};
