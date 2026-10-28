const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const STATE_FILE = path.join(__dirname, 'quilombo.json');

let state = { chats: {} };

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { chats: raw.chats ?? {} };
  } catch {
    state = { chats: {} };
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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
  set(key);
  const start = new Date(get(key).ts);
  const { days, hours } = elapsed(start);
  return {
    content: `💥 Uh, se armó un quilombo. La cuenta vuelve a empezar: ${fmt(days, hours)} sin quilombos desde el ${discordTs(start)}. Suerte 🫡`,
    components: [row()],
  };
}

loadState();

module.exports = { get, set, buildView, reset };
