const { roles } = require("./config");

const TAG = "🏳️‍⚧️ [travestir]";

const ROLE_TRAVIATENSE = roles.traviatense;
const ROLE_BOT = roles.bot;
const ROLE_200KG = roles.admin200kg;

function excluded(member) {
  return member.user.bot || member.roles.cache.has(ROLE_BOT);
}

function canUse(interaction) {
  if (!interaction.inGuild()) return false;
  return !!interaction.member?.roles?.cache?.has(ROLE_200KG);
}

async function assignAll(guild) {
  const members = await guild.members.fetch();
  let added = 0;
  let already = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of members.values()) {
    if (excluded(member)) {
      skipped++;
      continue;
    }
    if (member.roles.cache.has(ROLE_TRAVIATENSE)) {
      already++;
      continue;
    }
    try {
      await member.roles.add(ROLE_TRAVIATENSE, "Comando /travestir");
      added++;
    } catch (err) {
      failed++;
      console.error(`${TAG} ⚠️ ${member.user.tag}: ${err.message}`);
    }
  }

  console.log(
    `${TAG} ✅ ${added} con rol, ${already} ya lo tenían, ${skipped} omitidos, ${failed} fallaron`
  );
  return { total: members.size, added, already, skipped, failed };
}

function start(client) {
  client.on("guildMemberAdd", async (member) => {
    if (excluded(member) || member.roles.cache.has(ROLE_TRAVIATENSE)) return;
    try {
      await member.roles.add(ROLE_TRAVIATENSE, "Nuevo miembro del servidor");
      console.log(`${TAG} ✅ ${member.user.tag} recibió el rol`);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude dar el rol a ${member.user.tag}: ${err.message}`
      );
    }
  });
}

module.exports = {
  ROLE_TRAVIATENSE,
  ROLE_BOT,
  ROLE_200KG,
  canUse,
  assignAll,
  start
};
