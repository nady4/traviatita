const { SlashCommandBuilder } = require("discord.js");
const quilombo = require("../quilombo");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quilombo")
    .setDescription("💥 Días sin quilombos en el servidor"),

  async execute(interaction) {
    const key = interaction.guildId ?? interaction.user.id;
    const fresh = !quilombo.get(key);
    if (fresh) quilombo.set(key);
    await interaction.reply(quilombo.buildView(key, { fresh }));
  }
};
