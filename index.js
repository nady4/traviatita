require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const otokonoko = require('./otokonoko');
const astrovials = require('./astrovials');
const hormonas = require('./hormonas');
const dias = require('./dias');

const NOTIFY_STORES = {
  otokonoko: { mod: otokonoko, name: 'Otokonoko Pharmacy' },
  astrovials: { mod: astrovials, name: 'Astrovials' },
};

function notifyRow(storeKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`notify:${storeKey}:on`)
      .setLabel('Notificarme cambios de stock')
      .setEmoji('🔔')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`notify:${storeKey}:off`)
      .setLabel('Dejar de avisar')
      .setEmoji('🔕')
      .setStyle(ButtonStyle.Secondary),
  );
}

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
  new SlashCommandBuilder()
    .setName('otokonoko')
    .setDescription('Stock de estradiol en Otokonoko Pharmacy'),
  new SlashCommandBuilder()
    .setName('astrovials')
    .setDescription('Stock de estradiol en Astrovials'),
  new SlashCommandBuilder()
    .setName('hormonas')
    .setDescription('Recordatorio para tomarte tus hormonas'),
  new SlashCommandBuilder()
    .setName('dias')
    .setDescription('Cuánto llevás en HRT'),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', async () => {
  console.log(`☑️ Conectado como ${client.user.tag}`);

  const rest = new REST().setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log(`⚡ ${commands.length} comandos registrados`);

  otokonoko.start(client);
  astrovials.start(client);
  hormonas.start(client);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'dias:modal') {
      const raw = interaction.fields.getTextInputValue('dias:fecha');
      const date = dias.parse(raw);

      if (!date) {
        await interaction
          .reply({
            content: `Formato inválido \`${raw}\` — usa DD/MM/AAAA (ej. 15/03/2023), sin fechas futuras.`,
            ephemeral: true,
          })
          .catch(() => {});
        return;
      }

      dias.set(interaction.user.id, date);
      console.log(
        `⏳ [${new Date().toISOString()}] ${interaction.user.tag}: inicio HRT ${date.toISOString().slice(0, 10)}`,
      );
      const view = dias.buildView(interaction.user.id);
      try {
        if (interaction.isFromMessage()) {
          await interaction.update(view);
        } else {
          await interaction.reply({ ephemeral: true, ...view });
        }
      } catch (err) {
        console.error('⏳ [dias] ⚠️ modal submit:', err.message);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('hormonas:')) {
      const [, action, key] = interaction.customId.split(':');
      try {
        if (action === 'set' && hormonas.INTERVALS[key]) {
          const r = hormonas.set(interaction.user.id, key);
          const label = hormonas.INTERVALS[key].label;
          console.log(
            `⏰ [${new Date().toISOString()}] ${interaction.user.tag}: recordatorio ${label} · próxima ${r.next}`,
          );
        } else if (action === 'cancel') {
          hormonas.cancel(interaction.user.id);
        } else {
          return;
        }
        await interaction.update(hormonas.view(interaction.user.id));
      } catch (err) {
        console.error('⏰ [hormonas] ⚠️ botón:', err.message);
        await interaction
          .reply({ content: 'Error gestionando el recordatorio.', ephemeral: true })
          .catch(() => {});
      }
      return;
    }

    if (interaction.customId.startsWith('dias:edit')) {
      const current = dias.get(interaction.user.id)?.date ?? '';
      await interaction.showModal(dias.buildModal(current)).catch((err) => {
        console.error('⏳ [dias] ⚠️ modal:', err.message);
      });
      return;
    }

    if (!interaction.customId.startsWith('notify:')) return;
    const [, storeKey, mode] = interaction.customId.split(':');
    const store = NOTIFY_STORES[storeKey];
    if (!store || (mode !== 'on' && mode !== 'off')) return;

    try {
      if (!interaction.inGuild()) throw new Error('fuera de servidor');
      const member = interaction.member;
      const roleId = store.mod.NOTIFY_ROLE_ID;
      const subscribed = member.roles.cache.has(roleId);

      if (mode === 'on') {
        if (subscribed) {
          await interaction.reply({
            content: `🔔 Ya estabas suscrito — te seguiré pingheando con los cambios de **${store.name}**.`,
            ephemeral: true,
          });
        } else {
          await member.roles.add(roleId, 'Alertas de stock: suscripción');
          await interaction.reply({
            content: `🔔 Listo — te pinghearé cuando cambie el stock de **${store.name}**.`,
            ephemeral: true,
          });
        }
      } else {
        if (!subscribed) {
          await interaction.reply({
            content: `🔕 No estabas suscrito — no recibirás ping de **${store.name}**.`,
            ephemeral: true,
          });
        } else {
          await member.roles.remove(roleId, 'Alertas de stock: desuscripción');
          await interaction.reply({
            content: `🔕 Desuscripción confirmada — no recibirás más ping de **${store.name}**.`,
            ephemeral: true,
          });
        }
      }
    } catch (err) {
      console.error(`⚠️ [suscripción] ${interaction.customId}:`, err.message);
      await interaction
        .reply({
          content: 'No pude gestionar tu suscripción (revisa mis permisos de "gestionar roles" y la jerarquía del rol).',
          ephemeral: true,
        })
        .catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'talk') {
    const mensaje = interaction.options.getString('mensaje');
    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.channel.send(mensaje);
      await interaction.deleteReply();
      console.log(
        `💌 [${new Date().toISOString()}] Confesión de ${interaction.user.tag} en #${interaction.channel.name}`,
      );
    } catch (error) {
      console.error('💌 [talk] ⚠️ no pude enviar la confesión:', error.message);
      await interaction.editReply('No pude enviar tu confesión (revisa mis permisos en el canal).');
    }
  }

  if (interaction.commandName === 'otokonoko') {
    await interaction.deferReply();
    await otokonoko.ensureData(client);
    await interaction.editReply({ embeds: [otokonoko.buildEmbed()], components: [notifyRow('otokonoko')] });
  }

  if (interaction.commandName === 'astrovials') {
    await interaction.deferReply();
    await astrovials.ensureData(client);
    await interaction.editReply({ embeds: [astrovials.buildEmbed()], components: [notifyRow('astrovials')] });
  }

  if (interaction.commandName === 'hormonas') {
    await interaction.reply({ ephemeral: true, ...hormonas.view(interaction.user.id) });
  }

  if (interaction.commandName === 'dias') {
    await interaction.reply({ ...dias.buildView(interaction.user.id) });
  }
});

client.login(process.env.TOKEN);
