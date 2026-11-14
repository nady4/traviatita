const config = require("../config");

function roleCache(interaction) {
  if (!interaction.inGuild()) return null;
  return interaction.member?.roles?.cache ?? null;
}

function hasRole(interaction, roleId) {
  const cache = roleCache(interaction);
  return !!cache && cache.has(roleId);
}

function hasAnyRole(interaction, roleIds) {
  const cache = roleCache(interaction);
  return !!cache && roleIds.some((id) => cache.has(id));
}

function canPunish(interaction, member) {
  if (!interaction.inGuild()) return false;
  if (member.id === interaction.guild.ownerId) return false;
  if (interaction.user.id === interaction.guild.ownerId) return true;

  const actorPosition = interaction.member?.roles?.highest?.position;
  const targetPosition = member.roles?.highest?.position;

  return (
    Number.isInteger(actorPosition) &&
    Number.isInteger(targetPosition) &&
    actorPosition > targetPosition
  );
}

module.exports = { hasRole, hasAnyRole, canPunish };
