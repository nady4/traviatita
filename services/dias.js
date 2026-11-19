const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { create } = require('../lib/store');
const { stableDayTimestamp } = require('../utils/discord');

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

function addMonthsClamped(date, months) {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

function breakdown(start, now = todayUtc()) {
  const totalDays = Math.round((now - start) / 86_400_000);
  let months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());

  let candidate = addMonthsClamped(start, months);

  if (candidate > now) {
    months--;
    candidate = addMonthsClamped(start, months);
  }

  if (
    candidate.getUTCDate() !== start.getUTCDate() &&
    candidate >= now
  ) {
    months--;
  }

  const anchor = addMonthsClamped(start, months);
  const d = Math.max(0, Math.round((now - anchor) / 86_400_000));

  return { y: Math.floor(months / 12), mo: months % 12, d, totalDays };
}

function fmtDuration({ y, mo, d }) {
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'año' : 'años'}`);
  if (mo) parts.push(`${mo} ${mo === 1 ? 'mes' : 'meses'}`);
  if (d || !parts.length) parts.push(`${d} ${d === 1 ? 'día' : 'días'}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
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
    content: `Llevás **${fmtDuration(b)}** con tus hormonas (${b.totalDays} ${b.totalDays === 1 ? 'día' : 'días'}), desde el ${stableDayTimestamp(start)}`,
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
