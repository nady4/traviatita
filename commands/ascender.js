const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { roles } = require("../config");
const { hasAnyRole } = require("../utils/permissions");
const { defineCommand } = require("../utils/command");

const ROLE_500KG = roles.admin500kg;
const ROLE_200KG = roles.admin200kg;
const ROLE_150KG = roles.admin150kg;
const ROLE_100KG = roles.verificado100kg;

const ALLOWED_ROLES = [ROLE_500KG, ROLE_200KG];
const ROLE_MESSAGE = "🚫 Solo 200kg o 500kg pueden usar este comando.";

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("ascender")
    .setDescription("⬆️ Asciende a un miembro al siguiente rol de kg")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés ascender")
        .setRequired(true)
    ),

  guildOnly: true,

  async run(interaction) {
    if (
      interaction.guild.ownerId !== interaction.user.id &&
      !hasAnyRole(interaction, ALLOWED_ROLES)
    ) {
      await interaction.reply({
        content: ROLE_MESSAGE,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = interaction.options.getMember("usuario");
    if (!member) {
      await interaction.reply({
        content: "❌ Esa persona no está en el servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (member.user.bot) {
      await interaction.reply({
        content: "❌ No puedo ascender bots.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (
      member.roles.cache.has(ROLE_500KG) ||
      member.roles.cache.has(ROLE_200KG)
    ) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> ya tiene un rol superior (200kg/500kg).`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (member.roles.cache.has(ROLE_150KG)) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> ya está en el nivel máximo (150kg).`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const has100 = member.roles.cache.has(ROLE_100KG);
    const nextRole = has100 ? ROLE_150KG : ROLE_100KG;
    const previousRole = has100 ? ROLE_100KG : null;
    const nextLabel = has100 ? "150kg" : "100kg";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await member.roles.add(
        nextRole,
        `Ascendido a ${nextLabel} por ${interaction.user.tag}`
      );
    } catch (err) {
      console.error(`⬆️ [ascender] ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude ascender a esa persona (revisá mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
      return;
    }

    if (previousRole) {
      try {
        await member.roles.remove(
          previousRole,
          `Ascendido a ${nextLabel} por ${interaction.user.tag}`
        );
      } catch (err) {
        console.error(
          `⬆️ [ascender] ⚠️ no pude quitar el rol anterior de ${member.user.tag}: ${err.message}`
        );
        await interaction.editReply(
          `⬆️ Ascendiste a <@${member.id}> a ${nextLabel}, pero no pude quitarle el rol anterior.`
        );
        return;
      }
    }

    console.log(
      `⬆️ [ascender] ${interaction.user.tag} ascendió a ${member.user.tag} a ${nextLabel}`
    );
    await interaction.editReply(
      `⬆️ Ascendiste a <@${member.id}> a ${nextLabel}.`
    );
  }
});
