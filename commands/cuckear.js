const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { roles, channels } = require("../config");
const { hasRole } = require("../utils/permissions");
const { sendToChannel } = require("../utils/discord");

const ROLE_200KG = roles.admin200kg;
const ROLE_TRAVIATENSE = roles.traviatense;
const ROLE_VERIFICADE = roles.verificade;
const ROLE_CUCK = roles.cuck;
const CHANNEL_GENERAL = channels.general;

module.exports = {
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

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "Este comando solo sirve dentro de un servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!hasRole(interaction, ROLE_200KG)) {
      await interaction.reply({
        content:
          "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",
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
        content: "❌ No puedo cuckear bots.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const hasCuckRoles =
      member.roles.cache.has(ROLE_TRAVIATENSE) ||
      member.roles.cache.has(ROLE_VERIFICADE);
    if (member.roles.cache.has(ROLE_CUCK) && !hasCuckRoles) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> ya está cuckeade.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = `Cuckeado por ${interaction.user.tag}`;
    try {
      if (!member.roles.cache.has(ROLE_CUCK)) {
        await member.roles.add(ROLE_CUCK, reason);
      }

      const remove = [ROLE_TRAVIATENSE, ROLE_VERIFICADE].filter((roleId) =>
        member.roles.cache.has(roleId)
      );
      if (remove.length) {
        await member.roles.remove(remove, reason);
      }
    } catch (err) {
      console.error(`🐂 [cuckear] ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude cuckear a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
      return;
    }

    try {
      await sendToChannel(interaction.client, CHANNEL_GENERAL, {
        content:
          `🐂 <@${member.id}> ha sido cuckeade y ya no tiene acceso a los canales NSFW. ` +
          "Sólo puede ver el servidor, pero no escribir.",
        allowedMentions: { users: [member.id] }
      });
    } catch (err) {
      console.error(`🐂 [cuckear] ⚠️ no pude anunciar: ${err.message}`);
      await interaction.editReply(
        `🐂 Cuckeaste a <@${member.id}>, pero no pude publicar el anuncio en <#${CHANNEL_GENERAL}>.`
      );
      return;
    }

    console.log(
      `🐂 [cuckear] ${interaction.user.tag} cuckeó a ${member.user.tag}`
    );
    await interaction.editReply(
      `🐂 Cuckeaste a <@${member.id}>. El anuncio se publicó en <#${CHANNEL_GENERAL}>.`
    );
  }
};
