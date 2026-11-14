const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const verificar = require("../verificar");
const verificaciones = require("../verificaciones");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verificar")
    .setDescription("✅ Verifica a un miembro y le da acceso a los canales NSFW")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés darle el rol verificade")
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

    if (!verificar.canUse(interaction)) {
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
        content: "❌ No puedo verificar bots.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (member.roles.cache.has(verificar.ROLE_VERIFICADE)) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> ya está verificade.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    verificar.markCommand(member.id);
    try {
      await member.roles.add(
        verificar.ROLE_VERIFICADE,
        `Verificado por ${interaction.user.tag}`
      );
    } catch (err) {
      verificar.unmarkCommand(member.id);
      console.error(`✅ [verificar] ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude verificar a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
      return;
    }

    verificaciones.logVerification({
      action: "accepted",
      method: "command",
      actor: interaction.user,
      target: member.user,
      channelId: interaction.channelId
    });

    try {
      await verificar.announce(interaction.client, member);
    } catch (err) {
      console.error(`✅ [verificar] ⚠️ no pude anunciar: ${err.message}`);
      await interaction.editReply(
        `✅ Verifiqué a <@${member.id}>, pero no pude publicar el anuncio en <#${verificar.CHANNEL_GENERAL}>.`
      );
      return;
    }

    console.log(
      `✅ [verificar] ${interaction.user.tag} verificó a ${member.user.tag}`
    );
    await interaction.editReply(
      `✅ Verificaste a <@${member.id}>. El anuncio se publicó en <#${verificar.CHANNEL_GENERAL}>.`
    );
  }
};
