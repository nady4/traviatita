const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { roles, channels } = require("../config");
const { hasRole, canPunish } = require("../utils/permissions");
const { sendToChannel } = require("../utils/discord");

const ROLE_200KG = roles.admin200kg;
const ROLE_TRAVIATENSE = roles.traviatense;
const ROLE_VERIFICADE = roles.verificade;
const ROLE_PRESO = roles.preso;
const CHANNEL_GENERAL = channels.general;
const CHANNEL_JAULA = channels.jaula;

module.exports = {
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
        content: "❌ No puedo enjaular bots.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!canPunish(interaction, member)) {
      await interaction.reply({
        content: "🚫 No podés apuntar a alguien con tu mismo rol o superior.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const hasPrisonRoles =
      member.roles.cache.has(ROLE_TRAVIATENSE) ||
      member.roles.cache.has(ROLE_VERIFICADE);
    if (member.roles.cache.has(ROLE_PRESO) && !hasPrisonRoles) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> ya está enjaulade.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = `Enjaulado por ${interaction.user.tag}`;
    try {
      if (!member.roles.cache.has(ROLE_PRESO)) {
        await member.roles.add(ROLE_PRESO, reason);
      }

      const remove = [ROLE_TRAVIATENSE, ROLE_VERIFICADE].filter((roleId) =>
        member.roles.cache.has(roleId)
      );
      if (remove.length) {
        await member.roles.remove(remove, reason);
      }
    } catch (err) {
      console.error(`🔒 [enjaular] ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude enjaular a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
      return;
    }

    const results = await Promise.allSettled([
      sendToChannel(interaction.client, CHANNEL_GENERAL, {
        content:
          `🔒 <@${member.id}> ha sido enjaulade y perdió acceso a todo el servidor. ` +
          `Sólo puede ver y escribir en <#${CHANNEL_JAULA}>.`,
        allowedMentions: { users: [member.id] }
      }),
      sendToChannel(interaction.client, CHANNEL_JAULA, {
        content:
          `🔒 ¡Bienvenide a la cárcel, <@${member.id}>! ` +
          "A partir de ahora sólo tenés acceso a este canal. " +
          "Cuidá la colita y que no se te caiga el jabón.",
        allowedMentions: { users: [member.id] }
      })
    ]);

    const failed = results.filter((result) => result.status === "rejected");
    for (const result of failed) {
      console.error(
        `🔒 [enjaular] ⚠️ no pude anunciar: ${result.reason?.message ?? result.reason}`
      );
    }

    console.log(
      `🔒 [enjaular] ${interaction.user.tag} enjauló a ${member.user.tag}`
    );

    if (failed.length) {
      await interaction.editReply(
        `🔒 Enjaulaste a <@${member.id}>, pero no pude publicar todos los anuncios. Revisá los canales configurados.`
      );
      return;
    }

    await interaction.editReply(
      `🔒 Enjaulaste a <@${member.id}>. El anuncio se publicó en <#${CHANNEL_GENERAL}> y la bienvenida en <#${CHANNEL_JAULA}>.`
    );
  }
};
