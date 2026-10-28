const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { create } = require('./store');

const STORE = create('dias.json', '⏳ [dias]');

let state = { users: {} };

function loadState() {
  const raw = STORE.load({ users: {} });
  state = { users: raw.users ?? {} };
}

function saveState() {
  STORE.save(state);
}

function parse(str) {
  const s = String(str ?? '').trim();
  let y, mo, d;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const eu = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (iso) {
    [, y, mo, d] = iso;
  } else if (eu) {
    [, d, mo, y] = eu;
  } else {
    return null;
  }
  [y, mo, d] = [Number(y), Number(mo), Number(d)];
  if (y < 1900) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (date > new Date()) return null;
  return date;
}

function todayUtc() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function get(userId) {
  return state.users[userId] ?? null;
}

function set(userId, date) {
  state.users[userId] = { date: date.toISOString().slice(0, 10) };
  saveState();
}

function breakdown(start, now = todayUtc()) {
  const totalDays = Math.round((now - start) / 86_400_000);
  let y = now.getUTCFullYear() - start.getUTCFullYear();
  let mo = now.getUTCMonth() - start.getUTCMonth();
  let d = now.getUTCDate() - start.getUTCDate();
  if (d < 0) {
    mo--;
    const py = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const pm = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
    d += new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
  }
  if (mo < 0) {
    y--;
    mo += 12;
  }
  return { y, mo, d, totalDays };
}

function fmtDuration({ y, mo, d }) {
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'año' : 'años'}`);
  if (mo) parts.push(`${mo} ${mo === 1 ? 'mes' : 'meses'}`);
  if (d || !parts.length) parts.push(`${d} ${d === 1 ? 'día' : 'días'}`);
  const first = parts.shift();
  if (!parts.length) return first;
  const last = parts.pop();
  return `${first}${parts.length ? '' : ''}${parts.length ? ', ' + parts.join(', ') + ' y ' : ' y '}${last}`;
}

// mediodía UTC: <t:D> muestra el mismo día calendario en cualquier huso hasta ±11 h
function stableTs(date) {
  const noon = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  return `<t:${Math.floor(noon / 1000)}:D>`;
}

function buildView(userId) {
  const r = get(userId);
  if (!r) {
    return {
      content: 'Todavía no cargaste tu fecha de inicio en HRT — ponla con el botón',
      components: [viewRow()],
    };
  }
  const start = new Date(`${r.date}T00:00:00.000Z`);
  const b = breakdown(start);
  return {
    content: `Llevás **${fmtDuration(b)}** con tus hormonas (${b.totalDays} ${b.totalDays === 1 ? 'día' : 'días'}), desde el ${stableTs(start)}`,
    components: [viewRow()],
  };
}

function viewRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dias:edit')
      .setLabel('Editar fecha de inicio')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildModal(current = '') {
  return new ModalBuilder()
    .setCustomId('dias:modal')
    .setTitle('Fecha de inicio en HRT')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dias:fecha')
          .setLabel('DD/MM/AAAA (ej. 15/03/2023)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(10)
          .setValue(current),
      ),
    );
}

loadState();

module.exports = { parse, get, set, breakdown, buildView, buildModal };
