const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { create } = require('./store');

const TAG = '⏰ [hormonas]';

const STORE = create('hormonas.json', TAG);

const INTERVALS = {
  '12h': { ms: 12 * 60 * 60_000, label: 'cada 12 horas' },
  '1d': { ms: 24 * 60 * 60_000, label: 'cada 1 día' },
  '36h': { ms: 36 * 60 * 60_000, label: 'cada 1,5 días' },
  '5d': { ms: 5 * 24 * 60 * 60_000, label: 'cada 5 días' },
  '1w': { ms: 7 * 24 * 60 * 60_000, label: 'cada 1 semana' },
  '2w': { ms: 14 * 24 * 60 * 60_000, label: 'cada 2 semanas' },
  '1mo': { ms: 30 * 24 * 60 * 60_000, label: 'cada 1 mes' },
};

let state = { users: {} };

function loadState() {
  const raw = STORE.load({ users: {} });
  state = { users: raw.users ?? {} };
}

function saveState() {
  STORE.save(state);
}

function get(userId) {
  return state.users[userId] ?? null;
}

function set(userId, key) {
  const iv = INTERVALS[key];
  state.users[userId] = {
    interval: key,
    next: new Date(Date.now() + iv.ms).toISOString(),
    fails: 0,
  };
  saveState();
  return state.users[userId];
}

function cancel(userId) {
  const had = !!state.users[userId];
  delete state.users[userId];
  if (had) saveState();
  return had;
}

function discordTs(iso) {
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
}

function intervalRows(current, userId) {
  const mk = (key) =>
    new ButtonBuilder()
      .setCustomId(`hormonas:set:${key}`)
      .setLabel(key)
      .setStyle(key === current ? ButtonStyle.Success : ButtonStyle.Secondary);
  const inputs = Object.keys(INTERVALS);
  const row1 = new ActionRowBuilder().addComponents(...inputs.slice(0, 5).map(mk));
  const row2 = new ActionRowBuilder().addComponents(
    ...inputs.slice(5).map(mk),
    new ButtonBuilder()
      .setCustomId('hormonas:cancel')
      .setLabel('Cancelar')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

function view(userId) {
  const r = get(userId);
  const embed = new EmbedBuilder().setColor(0xe77cae).setTitle('💊 Recordatorio de hormonas');

  if (r) {
    const label = INTERVALS[r.interval]?.label ?? r.interval;
    embed.addFields(
      { name: '⏰ Activo', value: `${label}\nPróxima toma: ${r.next ? discordTs(r.next) : '—'}` },
      { name: '✏️ Cambiar', value: 'Pulsa otro intervalo (queda vencido dentro de ese tiempo)' },
    );
  } else {
    embed.addFields({ name: '⏰ Activo', value: 'Sin recordatorio activo' });
  }

  embed.addFields({ name: '💌 Aviso', value: 'Te llegaré por DM cuando toque la próxima toma' });
  return { embeds: [embed], components: intervalRows(r?.interval, userId) };
}

function reminderEmbed(label) {
  return new EmbedBuilder()
    .setColor(0xe77cae)
    .setTitle('⏰ Hora de tus hormonas 💉')
    .setDescription('Es hora de tomarte la próxima dosis 💜\nSalud y fuerza para ti 🌸')
    .setFooter({ text: `Recordatorio ${label} · /hormonas para cambiar o cancelar` });
}

async function tick(client) {
  const now = Date.now();
  let changed = false;
  for (const [id, r] of Object.entries(state.users)) {
    let next = new Date(r.next).getTime();
    if (Number.isNaN(next)) next = now;
    if (next > now) continue;

    const iv = INTERVALS[r.interval]?.ms ?? 24 * 60 * 60_000;
    const label = INTERVALS[r.interval]?.label ?? 'el intervalo configurado';
    let sent = false;
    try {
      const user = await client.users.fetch(id);
      await user.send({ embeds: [reminderEmbed(label)] });
      sent = true;
      console.log(`${TAG} 💌 DM enviado a ${id} (${r.interval})`);
    } catch (err) {
      console.error(`${TAG} ⚠️ DM a ${id}: ${err.message}`);
    }

    if (sent) {
      while (next <= now) next += iv;
      r.next = new Date(next).toISOString();
      r.fails = 0;
    } else {
      r.fails = (r.fails ?? 0) + 1;
      if (r.fails >= 5) {
        while (next <= now) next += iv;
        r.next = new Date(next).toISOString();
        r.fails = 0;
        console.error(`${TAG} ⚠️ ${id}: 5 fallos de DM seguidos, salto al próximo vencimiento`);
      } else {
        r.next = new Date(now + 15 * 60_000).toISOString();
      }
    }
    changed = true;
  }
  if (changed) saveState();
}

function start(client) {
  const run = () => tick(client).catch((err) => console.error(`${TAG} ⚠️ tick:`, err.message));
  setTimeout(run, 5_000);
  setInterval(run, 60_000);
  const n = Object.keys(state.users).length;
  console.log(`${TAG} ✅ tick cada 60 s · ${n === 0 ? 'sin recordatorios' : `${n} recordatorio${n === 1 ? '' : 's'}`}`);
}

loadState();

module.exports = { INTERVALS, get, set, cancel, view, start, tick };
