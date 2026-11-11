const { Events, MessageFlags } = require("discord.js");

const interactions = {
  dado: require("../interactions/dado"),
  dias: require("../interactions/dias"),
  hormonas: require("../interactions/hormonas"),
  quilombo: require("../interactions/quilombo"),
  notify: require("../interactions/notify")
};

async function dispatch(interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    await command.execute(interaction);
    return;
  }

  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  const [prefix] = interaction.customId.split(":");
  const handler = interactions[prefix];
  if (!handler) return;

  if (interaction.isButton() && handler.button) {
    await handler.button(interaction);
  } else if (interaction.isModalSubmit() && handler.modal) {
    await handler.modal(interaction);
  }
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    try {
      await dispatch(interaction);
    } catch (err) {
      const id = interaction.isChatInputCommand()
        ? interaction.commandName
        : interaction.customId;
      console.error(`⚠️ [interacción] ${id}:`, err.message);

      const payload = {
        content: "Ocurrió un error procesando la interacción.",
        flags: MessageFlags.Ephemeral
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
};
