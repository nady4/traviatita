const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const store = require('./store');

const TAG = '💥 [quilombo]';
const ANNOUNCE_CHANNEL_ID = process.env.QUILOMBO_ANNOUNCE_CHANNEL_ID ?? '1527109090965192774';
const RESET_ROLES = ['1527108970857234595', '1527108969741422672'];
const STORE = store.create('quilombo.json', TAG);

let state = { chats: {} };

function loadState() {
  const raw = STORE.load({ chats: {} });
  state = { chats: raw.chats ?? {} };
}

function saveState() {
  STORE.save(state);
}

function get(key) {
  const r = state.chats[key];
  if (!r) return null;
  // migración del formato viejo { date: 'AAAA-MM-DD' } (mediodía UTC, como mostraba <t:D>)
  const iso = r.ts ?? (r.date ? `${r.date}T12:00:00.000Z` : null);
  return iso ? { ts: iso } : null;
}

function set(key, date = new Date()) {
  state.chats[key] = { ts: date.toISOString() };
  saveState();
}

function discordTs(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

function fmt(days, hours) {
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  return `**${parts.join(' y ')}**`;
}

function elapsed(start) {
  const totalHours = Math.max(0, Math.floor((Date.now() - start.getTime()) / 3_600_000));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

function row() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('quilombo:reset')
      .setLabel('Se armó un quilombo')
      .setEmoji('💥')
      .setStyle(ButtonStyle.Danger),
  );
}

function canReset(interaction) {
  if (!interaction.inGuild()) return false;
  const cache = interaction.member?.roles?.cache;
  return !!cache && RESET_ROLES.some((id) => cache.has(id));
}

function buildView(key) {
  if (!get(key)) {
    set(key);
    return {
      content: '🕊️ Arranca la cuenta: **0 horas** sin quilombos. Si se arma uno, apretá el botón y la cuenta vuelve a cero.',
      components: [row()],
    };
  }
  const start = new Date(get(key).ts);
  const { days, hours } = elapsed(start);
  return {
    content: `Llevamos ${fmt(days, hours)} sin quilombos desde el ${discordTs(start)}. Que dure 🕊️`,
    components: [row()],
  };
}

function reset(key) {
  const prev = get(key);
  let streak = null;
  if (prev) {
    const e = elapsed(new Date(prev.ts));
    streak = fmt(e.days, e.hours);
  }
  set(key);
  const start = new Date(get(key).ts);
  const { days, hours } = elapsed(start);
  const view = {
    content: `💥 Uh, se armó un quilombo. La cuenta vuelve a empezar: ${fmt(days, hours)} sin quilombos desde el ${discordTs(start)}. Suerte 🫡`,
    components: [row()],
  };
  return { view, streak };
}

function announce(client, { user, guild, streak }) {
  if (!client) return;
  client.channels
    .fetch(ANNOUNCE_CHANNEL_ID)
    .then((channel) => {
      if (!channel?.isTextBased()) throw new Error('canal de anuncios inválido');
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('💥 Se armó un quilombo')
        .setDescription(streak ? `Racha perdida: ${streak} sin quilombos 💀` : null);
      return channel.send({ embeds: [embed] });
    })
    .catch((err) => console.error(`${TAG} ⚠️ anuncio: ${err.message}`));
}

loadState();

module.exports = { get, set, buildView, reset, announce, canReset, RESET_ROLES };
