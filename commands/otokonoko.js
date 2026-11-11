const { SlashCommandBuilder } = require("discord.js");
const otokonoko = require("../otokonoko");
const { notifyRow } = require("../ui/stockNotify");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("otokonoko")
    .setDescription("Stock de estradiol en Otokonoko Pharmacy"),

  async execute(interaction) {
    await interaction.deferReply();
    await otokonoko.ensureData(interaction.client);
    await interaction.editReply({
      embeds: [otokonoko.buildEmbed()],
      components: [notifyRow("otokonoko")]
    });
  }
};
