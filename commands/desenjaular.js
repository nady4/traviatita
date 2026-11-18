const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { roles, channels } = require("../config");
const { canPunish } = require("../utils/permissions");
const { sendToChannel } = require("../utils/discord");
const { defineCommand } = require("../utils/command");

const TAG = "🔓 [desenjaular]";
const ROLE_200KG = roles.admin200kg;
const ROLE_PRESO = roles.preso;
const ROLE_TRAVIATENSE = roles.traviatense;
const CHANNEL_GENERAL = channels.general;
const CHANNEL_JAULA = channels.jaula;

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("desenjaular")
    .setDescription(
      "🔓 Saca a un miembro de la cárcel y le devuelve el acceso al servidor"
    )
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Miembro al que querés desenjaular")
        .setRequired(true)
    ),

  guildOnly: true,
  roles: [ROLE_200KG],
  roleMessage: "🚫 Solo quienes tienen el rol 200kg pueden usar este comando.",

  async run(interaction) {
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
        content: "❌ No puedo desenjaular bots.",
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

    if (!member.roles.cache.has(ROLE_PRESO)) {
      await interaction.reply({
        content: `ℹ️ <@${member.id}> no está enjaulade.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const reason = `Desenjaulado por ${interaction.user.tag}`;

    try {
      await member.roles.remove(ROLE_PRESO, reason);
      if (!member.roles.cache.has(ROLE_TRAVIATENSE)) {
        await member.roles.add(ROLE_TRAVIATENSE, reason);
      }
    } catch (err) {
      console.error(`${TAG} ⚠️ ${err.message}`);
      await interaction.editReply(
        '❌ No pude desenjaular a esa persona (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
      return;
    }

    const payloads = [
      {
        channelId: CHANNEL_GENERAL,
        content:
          `🔓 <@${member.id}> ha sido desenjaulade y recuperó el acceso al servidor. ` +
          "Si necesita el acceso a los canales NSFW, tiene que volver a verificarse."
      },
      {
        channelId: CHANNEL_JAULA,
        content: `🔓 <@${member.id}> salió de la cárcel. ¡Portate bien!`
      }
    ];

    const results = await Promise.allSettled(
      payloads.map(({ channelId, content }) =>
        sendToChannel(interaction.client, channelId, {
          content,
          allowedMentions: { users: [member.id] }
        })
      )
    );

    const failed = results.filter((result) => result.status === "rejected");
    for (const result of failed) {
      console.error(
        `${TAG} ⚠️ no pude anunciar: ${result.reason?.message ?? result.reason}`
      );
    }

    console.log(`${TAG} ${interaction.user.tag} → ${member.user.tag}`);
    await interaction.editReply(
      failed.length
        ? `🔓 Desenjaulaste a <@${member.id}>, pero no pude publicar todos los anuncios. Revisá los canales configurados.`
        : `🔓 Desenjaulaste a <@${member.id}>. El anuncio se publicó en <#${CHANNEL_GENERAL}> y la despedida en <#${CHANNEL_JAULA}>.`
    );
  }
});
