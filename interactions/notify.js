const { MessageFlags } = require("discord.js");
const config = require("../config");
const { NOTIFY_STORES } = require("../ui/stockNotify");

module.exports = {
  async button(interaction) {
    const [, storeKey, mode] = interaction.customId.split(":");
    const store = NOTIFY_STORES[storeKey];
    if (!store || (mode !== "on" && mode !== "off")) return;

    try {
      if (!interaction.inGuild()) throw new Error("fuera de servidor");
      const member = interaction.member;
      const roleId = config.roles.admin200kg;
      const subscribed = member.roles.cache.has(roleId);

      if (mode === "on") {
        if (subscribed) {
          await interaction.reply({
            content: `🔔 Ya estabas suscrito — te seguiré pingheando con los cambios de **${store.name}**.`,
            flags: MessageFlags.Ephemeral
          });
        } else {
          await member.roles.add(roleId, "Alertas de stock: suscripción");
          await interaction.reply({
            content: `🔔 Listo — te pinghearé cuando cambie el stock de **${store.name}**.`,
            flags: MessageFlags.Ephemeral
          });
        }
      } else if (!subscribed) {
        await interaction.reply({
          content: `🔕 No estabas suscrito — no recibirás ping de **${store.name}**.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await member.roles.remove(roleId, "Alertas de stock: desuscripción");
        await interaction.reply({
          content: `🔕 Desuscripción confirmada — no recibirás más ping de **${store.name}**.`,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (err) {
      console.error(`⚠️ [suscripción] ${interaction.customId}:`, err.message);
      await interaction
        .reply({
          content:
            'No pude gestionar tu suscripción (revisa mis permisos de "gestionar roles" y la jerarquía del rol).',
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
    }
  }
};
