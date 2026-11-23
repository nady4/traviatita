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
    .setName("descender")
    .setDescription("⬇️ Desciende a un miembro al rol de kg anterior")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés descender")
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
        content: "❌ No puedo descender bots.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (
      member.roles.cache.has(ROLE_500KG) ||
      member.roles.cache.has(ROLE_200KG)
    ) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> tiene un rol superior (200kg/500kg).`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const has150 = member.roles.cache.has(ROLE_150KG);
    const has100 = member.roles.cache.has(ROLE_100KG);

    if (!has150 && !has100) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> no tiene un rol de kg para descender.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const previousRole = has150 ? ROLE_150KG : ROLE_100KG;
    const nextRole = has150 ? ROLE_100KG : null;
    const nextLabel = has150 ? "100kg" : "sin rol";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (nextRole) {
      try {
        await member.roles.add(
          nextRole,
          `Descendido a ${nextLabel} por ${interaction.user.tag}`
        );
      } catch (err) {
        console.error(`⬇️ [descender] ⚠️ ${err.message}`);
        await interaction.editReply(
          '❌ No pude descender a esa persona (revisá mis permisos de "gestionar roles" y la jerarquía del rol).'
        );
        return;
      }
    }

    try {
      await member.roles.remove(
        previousRole,
        `Descendido a ${nextLabel} por ${interaction.user.tag}`
      );
    } catch (err) {
      console.error(
        `⬇️ [descender] ⚠️ no pude quitar el rol anterior de ${member.user.tag}: ${err.message}`
      );
      await interaction.editReply(
        `⬇️ Descendiste a <@${member.id}> a ${nextLabel}, pero no pude quitarle el rol anterior.`
      );
      return;
    }

    console.log(
      `⬇️ [descender] ${interaction.user.tag} descendió a ${member.user.tag} a ${nextLabel}`
    );
    await interaction.editReply(
      `⬇️ Descendiste a <@${member.id}> a ${nextLabel}.`
    );
  }
});
