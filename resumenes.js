const { EmbedBuilder } = require('discord.js');
const { create } = require('./store');
const { channels } = require('./config');
const cal = require('./calendario');
const produccion = require('./produccion');
const { PRODUCTS: ASTROVIALS_PRODUCTS } = require('./astrovials');
const { PRODUCTS: OTOKONOKO_PRODUCTS } = require('./otokonoko');
const { singleFlight } = require('./utils/async');
const { sendToChannel } = require('./utils/discord');

const TAG = '📊 [resumenes]';
const ASTROVIALS_URL = 'https://astrovials.com/en/shop';
const STORE = create('resumenes.json', TAG);

let state = loadState();

function loadState() {
  const raw = STORE.load({});
  return {
    daily: raw.daily ?? null,
    weekly: raw.weekly ?? null,
    monthly: raw.monthly ?? null,
  };
}

function saveState() {
  STORE.save(state);
}

function plural(n) {
  return n === 1 ? 'vial' : 'viales';
}

function productLines(products, totals) {
  return products
    .map((p) => {
      const n = totals[p.slug] ?? 0;
      return `${n > 0 ? '🟢' : '⚪'} **${p.label}**: ${n} ${plural(n)}`;
    })
    .join('\n');
}

function totalOf(products, totals) {
  return products.reduce((sum, p) => sum + (totals[p.slug] ?? 0), 0);
}

function storeSection(title, products, totals) {
  return `**${title}**\n${productLines(products, totals)}`;
}

async function sendEmbed(client, embed, label) {
  const channelId = channels.stock;
  if (!channelId || !client) return false;
  try {
    await sendToChannel(client, channelId, { embeds: [embed] });
    return true;
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude anunciar ${label}:`, err.message);
    return false;
  }
}

async function announceDaily(client, date) {
  const totals = produccion.day('astrovials', date);
  const total = totalOf(ASTROVIALS_PRODUCTS, totals);
  if (total <= 0) {
    console.log(`${TAG} 📊 sin viales de Astrovials el ${cal.fmtDate(date)}, no anuncio el resumen diario`);
    return "empty";
  }
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🚀 Viales ingresados — Astrovials 💉')
    .setURL(ASTROVIALS_URL)
    .setDescription(`Resumen del **${cal.fmtDate(date)}**:\n\n${productLines(ASTROVIALS_PRODUCTS, totals)}`)
    .setFooter({ text: `Total: ${total} ${plural(total)}` });
  if (await sendEmbed(client, embed, `el resumen diario del ${cal.fmtDate(date)}`)) {
    console.log(`${TAG} 📊 resumen diario del ${cal.fmtDate(date)} anunciado (${total} ${plural(total)})`);
    return "sent";
  }

  return "error";
}

async function announceWeekly(client, sunday) {
  const { start, end } = cal.weekRange(sunday);
  const astro = produccion.range('astrovials', start, end);
  const otk = produccion.range('otokonoko', start, end);
  const total = totalOf(ASTROVIALS_PRODUCTS, astro) + totalOf(OTOKONOKO_PRODUCTS, otk);
  if (total <= 0) {
    console.log(`${TAG} 📊 sin viales del ${cal.fmtDate(start)} al ${cal.fmtDate(end)}, no anuncio el resumen semanal`);
    return "empty";
  }
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`📅 Viales ingresados — Semana del ${cal.fmtWeekRange(start, end)}`)
    .setDescription(
      `${storeSection('🚀 Astrovials', ASTROVIALS_PRODUCTS, astro)}\n\n${storeSection('💊 Otokonoko', OTOKONOKO_PRODUCTS, otk)}`,
    )
    .setFooter({ text: `Total: ${total} ${plural(total)}` });
  if (await sendEmbed(client, embed, `el resumen semanal del ${cal.fmtDate(end)}`)) {
    console.log(`${TAG} 📊 resumen semanal del ${cal.fmtDate(start)} al ${cal.fmtDate(end)} anunciado (${total} ${plural(total)})`);
    return "sent";
  }

  return "error";
}

async function announceMonthly(client, month) {
  const { start, end } = cal.monthRange(month);
  const astro = produccion.range('astrovials', start, end);
  const otk = produccion.range('otokonoko', start, end);
  const total = totalOf(ASTROVIALS_PRODUCTS, astro) + totalOf(OTOKONOKO_PRODUCTS, otk);
  if (total <= 0) {
    console.log(`${TAG} 📊 sin viales en ${cal.fmtMonth(month)}, no anuncio el resumen mensual`);
    return "empty";
  }
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🗓️ Viales ingresados — ${cal.fmtMonth(month)}`)
    .setDescription(
      `${storeSection('🚀 Astrovials', ASTROVIALS_PRODUCTS, astro)}\n\n${storeSection('💊 Otokonoko', OTOKONOKO_PRODUCTS, otk)}`,
    )
    .setFooter({ text: `Total: ${total} ${plural(total)}` });
  if (await sendEmbed(client, embed, `el resumen mensual de ${cal.fmtMonth(month)}`)) {
    console.log(`${TAG} 📊 resumen mensual de ${cal.fmtMonth(month)} anunciado (${total} ${plural(total)})`);
    return "sent";
  }

  return "error";
}

async function runSummariesOnce(client, now) {
  const today = cal.dateKey(now);
  const yesterday = cal.addDays(today, -1);
  let ok = true;

  if (state.daily !== yesterday) {
    const result = await announceDaily(client, yesterday);

    if (result === "error") {
      ok = false;
    } else {
      state.daily = yesterday;
      saveState();
    }
  }

  const sunday = cal.lastCompletedSunday(today);
  if (state.weekly !== sunday) {
    const result = await announceWeekly(client, sunday);

    if (result === "error") {
      ok = false;
    } else {
      state.weekly = sunday;
      saveState();
    }
  }

  const month = cal.previousMonthKey(today);
  if (state.monthly !== month) {
    const result = await announceMonthly(client, month);

    if (result === "error") {
      ok = false;
    } else {
      state.monthly = month;
      saveState();
    }
  }

  return ok;
}

const runSummaries = singleFlight(runSummariesOnce);

const RETRY_MS = 30 * 60_000;

function runAndSchedule(client, delay) {
  setTimeout(async () => {
    let ok = true;

    try {
      ok = await runSummaries(client);
    } catch (err) {
      console.error(`${TAG} ⚠️ resúmenes:`, err.message);
      ok = false;
    }

    schedule(client, ok ? cal.msUntilNextMidnight() + 1000 : RETRY_MS);
  }, delay);
}

function schedule(client, delay = cal.msUntilNextMidnight() + 1000) {
  runAndSchedule(client, delay);
  console.log(`${TAG} 🕛 resúmenes programados para dentro de ${cal.fmtAge(delay)} (${cal.timeZone})`);
}

function start(client) {
  schedule(client, 10_000);
  console.log(`${TAG} ✅ resúmenes diario, semanal y mensual activos (${cal.timeZone})`);
}

module.exports = { runSummaries, start };
