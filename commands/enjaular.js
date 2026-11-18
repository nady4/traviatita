const { SlashCommandBuilder } = require("discord.js");
const { roles, channels } = require("../config");
const { runPunishment } = require("../utils/punishments");
const { defineCommand } = require("../utils/command");

const ROLE_200KG = roles.admin200kg;
const ROLE_TRAVIATENSE = roles.traviatense;
const ROLE_VERIFICADE = roles.verificade;
const ROLE_PRESO = roles.preso;
const CHANNEL_GENERAL = channels.general;
const CHANNEL_JAULA = channels.jaula;

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("enjaular")
    .setDescription(
      "🔒 Enjaula a un miembro y le quita el acceso a los canales NSFW"
    )
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés enjaular")
        .setRequired(true)
    ),

  guildOnly: true,
  roles: [ROLE_200KG],
  roleMessage: "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",

  run(interaction) {
    return runPunishment({
      interaction,
      tag: "🔒 [enjaular]",
      reasonPrefix: "Enjaulado",
      roleId: ROLE_PRESO,
      rolesToRemove: [ROLE_TRAVIATENSE, ROLE_VERIFICADE],
      announcements: (member) => [
        {
          channelId: CHANNEL_GENERAL,
          content:
            `🔒 <@${member.id}> ha sido enjaulade y perdió acceso a todo el servidor. ` +
            `Sólo puede ver y escribir en <#${CHANNEL_JAULA}>.`
        },
        {
          channelId: CHANNEL_JAULA,
          content:
            `🔒 ¡Bienvenide a la cárcel, <@${member.id}>! ` +
            "A partir de ahora sólo tenés acceso a este canal. " +
            "Cuidá la colita y que no se te caiga el jabón."
        }
      ],
      messages: {
        notFound: () => "❌ Esa persona no está en el servidor.",
        bot: () => "❌ No puedo enjaular bots.",
        hierarchy: () =>
          "🚫 No podés apuntar a alguien con tu mismo rol o superior.",
        already: (member) => `ℹ️ <@${member.id}> ya está enjaulade.`,
        roleError: () =>
          '❌ No pude enjaular a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).',
        success: (member) =>
          `🔒 Enjaulaste a <@${member.id}>. El anuncio se publicó en <#${CHANNEL_GENERAL}> y la bienvenida en <#${CHANNEL_JAULA}>.`,
        partial: (member) =>
          `🔒 Enjaulaste a <@${member.id}>, pero no pude publicar todos los anuncios. Revisá los canales configurados.`
      }
    });
  }
});
