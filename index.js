require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('talk')
    .setDescription('El bot repite lo que le digas')
    .addStringOption((option) =>
      option
        .setName('mensaje')
        .setDescription('Lo que quieres que el bot diga')
        .setRequired(true),
    ),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  console.log(`Conectado como ${client.user.tag}`);

  const rest = new REST().setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('Comandos registrados');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'talk') {
    const mensaje = interaction.options.getString('mensaje');
    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.channel.send(mensaje);
      await interaction.deleteReply();
      console.log(
        `[${new Date().toISOString()}] Confesión de ${interaction.user.tag} en #${interaction.channel.name}`,
      );
    } catch (error) {
      console.error(error);
      await interaction.editReply('No pude enviar tu confesión (revisa mis permisos en el canal).');
    }
  }
});

client.login(process.env.TOKEN);
