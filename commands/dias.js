const { SlashCommandBuilder } = require("discord.js");
const dias = require("../dias");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dias")
    .setDescription("Cuánto llevás en HRT"),

  async execute(interaction) {
    await interaction.reply({ ...dias.buildView(interaction.user.id) });
  }
};
