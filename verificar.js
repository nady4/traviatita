const { roles, channels } = require("./config");
const verificaciones = require("./verificaciones");
const { hasRole } = require("./utils/permissions");
const { sendToChannel } = require("./utils/discord");

const TAG = "✅ [verificar]";

const ROLE_VERIFICADE = roles.verificade;
const ROLE_200KG = roles.admin200kg;
const CHANNEL_GENERAL = channels.general;
const CHANNEL_VERIFICACION = channels.verificacion;

const pending = new Set();

function canUse(interaction) {
  return hasRole(interaction, ROLE_200KG);
}

function announcement(member) {
  return (
    `✅ <@${member.id}> se ha verificado y ahora tiene acceso a los canales NSFW.\n` +
    `Para verificarte también crea un ticket en <#${CHANNEL_VERIFICACION}>.`
  );
}

async function announce(client, member) {
  await sendToChannel(client, CHANNEL_GENERAL, {
    content: announcement(member)
  });
}

function markCommand(memberId) {
  pending.add(memberId);
  setTimeout(() => pending.delete(memberId), 15000).unref();
}

function unmarkCommand(memberId) {
  pending.delete(memberId);
}

function start(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (oldMember.roles.cache.has(ROLE_VERIFICADE)) return;
    if (!newMember.roles.cache.has(ROLE_VERIFICADE)) return;
    if (pending.delete(newMember.id)) return;

    const fromTicket = verificaciones.consumeExpectedRoleChange(
      newMember.id
    );

    if (!fromTicket) {
      verificaciones.logVerification({
        action: "accepted",
        method: "manual",
        target: newMember.user
      });
    }

    try {
      await announce(client, newMember);
      console.log(
        `${TAG} ✅ ${newMember.user.tag} verificado${
          fromTicket ? " por ticket" : " manualmente"
        }`
      );
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude anunciar a ${newMember.user.tag}: ${err.message}`
      );
    }
  });
}

module.exports = {
  ROLE_VERIFICADE,
  ROLE_200KG,
  CHANNEL_GENERAL,
  CHANNEL_VERIFICACION,
  canUse,
  announcement,
  announce,
  markCommand,
  unmarkCommand,
  start
};
