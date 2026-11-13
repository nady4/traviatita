const { MessageFlags } = require('discord.js');

async function replyEphemeral(interaction, content) {
  return interaction
    .reply({ content, flags: MessageFlags.Ephemeral })
    .catch(() => {});
}

async function updateOrReply(interaction, view) {
  if (interaction.isFromMessage()) {
    return interaction.update(view);
  }
  return interaction.reply({ flags: MessageFlags.Ephemeral, ...view });
}

module.exports = { replyEphemeral, updateOrReply };
