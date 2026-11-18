const { MessageFlags } = require("discord.js");
const { hasRole } = require("./permissions");

const GUILD_ONLY_MESSAGE = "Este comando solo sirve dentro de un servidor.";
const ROLE_MESSAGE = "🚫 No tenés permiso para usar este comando.";

function defineCommand({
  data,
  guildOnly = false,
  roles = [],
  guildMessage,
  roleMessage,
  run
}) {
  return {
    data,

    async execute(interaction) {
      if (guildOnly && !interaction.inGuild()) {
        await interaction.reply({
          content: guildMessage ?? GUILD_ONLY_MESSAGE,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (
        roles.length > 0 &&
        !roles.some((roleId) => hasRole(interaction, roleId))
      ) {
        await interaction.reply({
          content: roleMessage ?? ROLE_MESSAGE,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await run(interaction);
    }
  };
}

module.exports = { defineCommand };
