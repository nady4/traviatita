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

module.exports = { hasRole, hasAnyRole };
