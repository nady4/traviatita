const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../config");

const TWEET_LIMIT = 280;

function tweetIntent(text) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("traviatweet")
    .setDescription("🐦 Traviatita repite el mensaje y te manda un link para twittearlo")
    .addStringOption((option) =>
      option
        .setName("mensaje")
        .setDescription("Lo que quieras que Traviatita diga y twittee")
        .setRequired(true)
        .setMaxLength(TWEET_LIMIT)
    ),

  async execute(interaction) {
    const mensaje = interaction.options.getString("mensaje");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.channel.send(mensaje);
    } catch (error) {
      console.error("🐦 [traviatweet] ⚠️ no pude enviar el mensaje:", error.message);
      await interaction.editReply(
        "No pude enviar tu mensaje (revisa mis permisos en el canal)."
      );
      return;
    }

    try {
      const user = await interaction.client.users.fetch(config.tweetUserId);
      await user.send(
        `🗣️ ${mensaje}\n\n🐦 Twittealo acá: ${tweetIntent(mensaje)}`
      );
      await interaction.deleteReply();
      console.log(
        `🐦 [${new Date().toISOString()}] Mensaje de ${interaction.user.tag} en #${interaction.channel.name} enviado por DM a ${config.tweetUserId}`
      );
    } catch (error) {
      console.error("🐦 [traviatweet] ⚠️ no pude enviar el DM:", error.message);
      await interaction.editReply(
        "El mensaje se publicó en el canal, pero no pude enviar el link por DM (¿los DMs están abiertos?)."
      );
    }
  }
};
