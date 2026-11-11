const { SlashCommandBuilder } = require("discord.js");
const quilombo = require("../quilombo");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quilombo")
    .setDescription("💥 Días sin quilombos en el servidor"),

  async execute(interaction) {
    const key = interaction.guildId ?? interaction.user.id;
    await interaction.reply({ ...quilombo.buildView(key) });
  }
};
