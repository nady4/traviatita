const { SlashCommandBuilder } = require("discord.js");
const { roles, channels } = require("../config");
const { runPunishment } = require("../utils/punishments");
const { defineCommand } = require("../utils/command");

const ROLE_200KG = roles.admin200kg;
const ROLE_TRAVIATENSE = roles.traviatense;
const ROLE_VERIFICADE = roles.verificade;
const ROLE_CUCK = roles.cuck;
const CHANNEL_GENERAL = channels.general;

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("cuckear")
    .setDescription(
      "🐂 Cuckea a un miembro y le quita el acceso a los canales NSFW"
    )
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés cuckear")
        .setRequired(true)
    ),

  guildOnly: true,
  roles: [ROLE_200KG],
  roleMessage: "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",

  run(interaction) {
    return runPunishment({
      interaction,
      tag: "🐂 [cuckear]",
      reasonPrefix: "Cuckeado",
      roleId: ROLE_CUCK,
      rolesToRemove: [ROLE_TRAVIATENSE, ROLE_VERIFICADE],
      announcements: (member) => [
        {
          channelId: CHANNEL_GENERAL,
          content:
            `🐂 <@${member.id}> ha sido cuckeade. ` +
            "Ahora sólo puede ver el servidor, pero no escribir."
        }
      ],
      messages: {
        notFound: () => "❌ Esa persona no está en el servidor.",
        bot: () => "❌ No puedo cuckear bots.",
        hierarchy: () =>
          "🚫 No podés apuntar a alguien con tu mismo rol o superior.",
        already: (member) => `ℹ️ <@${member.id}> ya está cuckeade.`,
        roleError: () =>
          '❌ No pude cuckear a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).',
        success: (member) =>
          `🐂 Cuckeaste a <@${member.id}>. El anuncio se publicó en <#${CHANNEL_GENERAL}>.`,
        partial: (member) =>
          `🐂 Cuckeaste a <@${member.id}>, pero no pude publicar el anuncio en <#${CHANNEL_GENERAL}>.`
      }
    });
  }
});
