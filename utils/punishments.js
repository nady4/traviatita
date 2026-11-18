const { MessageFlags } = require("discord.js");
const { canPunish } = require("./permissions");
const { sendToChannel } = require("./discord");

async function runPunishment({
  interaction,
  tag,
  reasonPrefix,
  roleId,
  rolesToRemove = [],
  announcements = () => [],
  messages
}) {
  const member = interaction.options.getMember("usuario");

  if (!member) {
    await interaction.reply({
      content: messages.notFound(),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (member.user.bot) {
    await interaction.reply({
      content: messages.bot(),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!canPunish(interaction, member)) {
    await interaction.reply({
      content: messages.hierarchy(),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const keepsAccess = rolesToRemove.some((id) => member.roles.cache.has(id));

  if (member.roles.cache.has(roleId) && !keepsAccess) {
    await interaction.reply({
      content: messages.already(member),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reason = `${reasonPrefix} por ${interaction.user.tag}`;

  try {
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, reason);
    }

    const remove = rolesToRemove.filter((id) => member.roles.cache.has(id));
    if (remove.length) {
      await member.roles.remove(remove, reason);
    }
  } catch (err) {
    console.error(`${tag} ⚠️ ${err.message}`);
    await interaction.editReply(messages.roleError());
    return;
  }

  const payloads = announcements(member);
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
      `${tag} ⚠️ no pude anunciar: ${result.reason?.message ?? result.reason}`
    );
  }

  console.log(`${tag} ${interaction.user.tag} → ${member.user.tag}`);
  await interaction.editReply(
    failed.length ? messages.partial(member) : messages.success(member)
  );
}

module.exports = { runPunishment };
