const { NOTIFY_STORES } = require("../ui/stockNotify");
const { replyEphemeral } = require("../utils/interactions");

module.exports = {
  async button(interaction) {
    const [, storeKey, mode] = interaction.customId.split(":");
    const store = NOTIFY_STORES[storeKey];
    if (!store || (mode !== "on" && mode !== "off")) return;

    try {
      if (!interaction.inGuild()) throw new Error("fuera de servidor");
      const member = interaction.member;
      const roleId = store.roleId;
      const subscribed = member.roles.cache.has(roleId);

      if (mode === "on") {
        if (subscribed) {
          await replyEphemeral(
            interaction,
            `🔔 Ya estabas suscritx — te seguiré pingheando con los cambios de **${store.name}**.`
          );
        } else {
          await member.roles.add(roleId, "Alertas de stock: suscripción");
          await replyEphemeral(
            interaction,
            `🔔 Listo — te pingearé cuando cambie el stock de **${store.name}**.`
          );
        }
      } else if (!subscribed) {
        await replyEphemeral(
          interaction,
          `🔕 No estabas suscritx — no recibirás ping de **${store.name}**.`
        );
      } else {
        await member.roles.remove(roleId, "Alertas de stock: desuscripción");
        await replyEphemeral(
          interaction,
          `🔕 Desuscripción confirmada — no recibirás más ping de **${store.name}**.`
        );
      }
    } catch (err) {
      console.error(`⚠️ [suscripción] ${interaction.customId}:`, err.message);
      await replyEphemeral(
        interaction,
        'No pude gestionar tu suscripción (revisa mis permisos de "gestionar roles" y la jerarquía del rol).'
      );
    }
  }
};
