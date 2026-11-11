const { SlashCommandBuilder } = require("discord.js");
const dado = require("../dado");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dado")
    .setDescription(
      "🎲 ¡Tirá un dado! d3 a d100, personalizado dX o rango al azar"
    ),

  async execute(interaction) {
    await interaction.reply(dado.buildView());
  }
};
