const { SlashCommandBuilder } = require("discord.js");
const astrovials = require("../astrovials");
const { notifyRow } = require("../ui/stockNotify");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("astrovials")
    .setDescription("Stock de estradiol en Astrovials"),

  async execute(interaction) {
    await interaction.deferReply();
    await astrovials.ensureData(interaction.client);
    await interaction.editReply({
      embeds: [astrovials.buildEmbed()],
      components: [notifyRow("astrovials")]
    });
  }
};
