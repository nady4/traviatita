const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const hormonas = require("../hormonas");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hormonas")
    .setDescription("🔔 Recordatorio para tomarte tus hormonas"),

  async execute(interaction) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      ...hormonas.view(interaction.user.id)
    });
  }
};
