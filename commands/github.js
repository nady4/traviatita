const { SlashCommandBuilder } = require("discord.js");

const REPO_URL = "https://github.com/nady4/traviatita";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("🐱 Muestra el repositorio de GitHub del proyecto"),

  async execute(interaction) {
    await interaction.reply(`🐱 Repositorio del proyecto: ${REPO_URL}`);
  }
};
