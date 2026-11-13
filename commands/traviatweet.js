const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../config");
const tweets = require("../tweets");

const TWEET_LIMIT = 260;

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

    let message;
    try {
      message = await interaction.channel.send(mensaje);
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
    } catch (error) {
      console.error("🐦 [traviatweet] ⚠️ no pude enviar el DM:", error.message);
      await interaction.editReply(
        "El mensaje se publicó en el canal, pero no pude enviar el link por DM (¿los DMs están abiertos?)."
      );
      return;
    }

    try {
      tweets.track({
        messageId: message.id,
        channelId: message.channelId,
        authorId: interaction.user.id,
        text: mensaje
      });
      await interaction.deleteReply();
      console.log(
        `🐦 [${new Date().toISOString()}] Mensaje de ${interaction.user.tag} en #${interaction.channel.name} enviado por DM a ${config.tweetUserId}`
      );
    } catch (error) {
      console.error(
        "🐦 [traviatweet] ⚠️ no pude registrar el tweet pendiente:",
        error.message
      );
      await interaction.editReply(
        "El mensaje y el DM se enviaron, pero no pude registrar el tweet para avisarte cuando se publique."
      );
    }
  }
};
