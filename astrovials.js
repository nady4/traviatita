const { EmbedBuilder } = require('discord.js');
const { create } = require('./store');
const { roles, channels, stockCheckMinutes } = require('./config');
const cal = require('./calendario');
const produccion = require('./produccion');
const { USER_AGENT, fetchText } = require('./utils/http');
const { sleep, singleFlight } = require('./utils/async');
const { timestamp, announceStockChange } = require('./utils/discord');

const BASE = 'https://astrovials.com';
const NOTIFY_ROLE_ID = roles.astrovials;
const TAG = '🚀 [astrovials]';
const STORE = create('astro.json', TAG);

const PRODUCTS = [
  { slug: 'estradiol-valerate-mct', label: 'Valerato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-mct', label: 'Enantato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-castor-oil', label: 'Enantato de estradiol (Castor)' },
  { slug: 'estradiol-undecylate-mct', label: 'Undecilato de estradiol (MCT)' },
];

let state = { lastCheck: null, lastChange: null, products: {} };

const STALE_ANNOUNCE_MS = 30 * 60_000;

function loadState() {
  const raw = STORE.load({});
  if (raw.daily?.date) {
    produccion.mergeMax('astrovials', raw.daily.date, raw.daily.counts ?? {});
    console.log(`${TAG} 📦 histórico diario migrado a produccion.json (${raw.daily.date})`);
  }
  state = {
    lastCheck: raw.lastCheck ?? null,
    lastChange: raw.lastChange ?? null,
    products: raw.products ?? {},
  };
}

function saveState() {
  STORE.save(state);
}

async function fetchProductPage(slug) {
  const url = `${BASE}/en/shop/${slug}`;
  const body = (
    await fetchText(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    })
  ).replace(/\\"/g, '"');
  const re = /"productId":"[\da-f-]+","slug":"([\w-]+)","name":"([^"]+)","priceCents":(\d+),"currency":"([A-Z]+)","stock":(-?\d+)/g;
  for (const m of body.matchAll(re)) {
    if (m[1] === slug) {
      return { name: m[2], priceCents: Number(m[3]), currency: m[4], stock: Number(m[5]) };
    }
  }
  throw new Error('payload de producto no encontrado');
}

function priceStr(p) {
  return `${p.priceCents / 100} ${p.currency}`;
}

async function runCheck(client) {
  const badges = [];
  let ok = 0;
  let fails = 0;
  for (const p of PRODUCTS) {
    try {
      const prod = await fetchProductPage(p.slug);
      const now = new Date();
      const nowIso = now.toISOString();
      const inStock = prod.stock > 0;
      const prev = state.products[p.slug];
      const changed = !!prev && prev.inStock !== inStock;
      const prevRead = prev ? Date.parse(prev.lastRead ?? state.lastCheck ?? '') : NaN;
      const prevAgeMs = Number.isFinite(prevRead) ? Math.max(0, now.getTime() - prevRead) : Infinity;
      const staleAnnounce = STALE_ANNOUNCE_MS > 0 && changed && prevAgeMs > STALE_ANNOUNCE_MS;
      const prevStock = !prev
        ? null
        : Number.isFinite(prev.stock)
          ? Math.max(0, prev.stock)
          : prev.inStock === false
            ? 0
            : null;
      const stockDelta = prevStock !== null ? prod.stock - prevStock : 0;
      const fresh = prevAgeMs <= STALE_ANNOUNCE_MS;
      const restocked = stockDelta > 0 && fresh ? stockDelta : 0;
      const exited = stockDelta < 0 && fresh ? -stockDelta : 0;

      if (restocked > 0) {
        const date = cal.dateKey(now);
        produccion.add('astrovials', date, p.slug, restocked);
        console.log(`${TAG} 📦 ${p.label}: +${restocked} viales el ${cal.fmtDate(date)}`);
      }

      if (exited > 0) {
        const date = cal.dateKey(now);
        produccion.addExit('astrovials', date, p.slug, exited);
        console.log(`${TAG} 📤 ${p.label}: -${exited} viales el ${cal.fmtDate(date)}`);
      }

      if (inStock) {
        produccion.markInStock('astrovials', p.slug, nowIso, prev?.inStock ? prev.lastChange : null);
      } else if (changed && prev?.inStock) {
        const endIso = staleAnnounce ? prev.lastRead ?? nowIso : nowIso;
        const weekKey = cal.weekEndingSunday(cal.dateKey(new Date(endIso)));
        const result = produccion.markOutOfStock('astrovials', p.slug, endIso, weekKey, prev.lastChange);
        if (result) {
          console.log(
            `${TAG} ⏱️ ${p.label}: en stock ${cal.fmtAge(result.ms)} (promedio semanal ${cal.fmtAge(result.weekAverageMs)})`,
          );
        }
      }

      state.products[p.slug] = {
        name: prod.name,
        price: priceStr(prod),
        stock: prod.stock,
        inStock,
        lastRead: nowIso,
        lastInStock: inStock ? nowIso : prev?.lastInStock ?? null,
        lastChange: staleAnnounce ? prev?.lastChange ?? null : changed ? nowIso : prev?.lastChange ?? null,
      };
      saveState();
      badges.push(inStock ? '🟢' : '🔴');
      if (staleAnnounce) {
        console.log(`${TAG} 🕓 ${p.label}: ${prev.inStock ? '🟢 → 🔴' : '🔴 → 🟢'} reconciliado tras corte de ${cal.fmtAge(prevAgeMs)} (sin anuncio)`);
      } else if (changed) {
        console.log(`${TAG} 🔔 ${p.label}: ${prev.inStock ? '🟢 → 🔴' : '🔴 → 🟢'} (${priceStr(prod)} · ${prod.stock} u.)`);
        state.lastChange = nowIso;
        await announceStockChange({
          client,
          channelId: channels.stock,
          roleId: NOTIFY_ROLE_ID,
          title: 'Astrovials',
          url: `${BASE}/en/shop/${p.slug}`,
          label: p.label,
          wasInStock: prev.inStock,
          inStock: state.products[p.slug].inStock,
          tag: TAG,
        });
      } else if (!prev) {
        console.log(`${TAG} ➕ ${p.label}: ${inStock ? '🟢' : '🔴'} (primera lectura) · ${priceStr(prod)}`);
      }
      ok++;
    } catch (err) {
      fails++;
      badges.push('⚠️');
      console.error(`${TAG} ⚠️ ${p.slug}: ${err.message}`);
    }
    await sleep(2000);
  }
  if (ok > 0) {
    state.lastCheck = new Date().toISOString();
    saveState();
  }
  console.log(`${TAG} 📋 ${badges.join('')} (${ok}/${PRODUCTS.length}${fails ? `, ${fails} fallas` : ''})`);
}

const checkAll = singleFlight(runCheck);

function hasData() {
  return PRODUCTS.every((p) => state.products[p.slug]);
}

const ensureData = singleFlight(async (client) => {
  if (hasData()) return;
  await checkAll(client);
});

function buildEmbed() {
  const anyInStock = PRODUCTS.some((p) => state.products[p.slug]?.inStock);
  const embed = new EmbedBuilder()
    .setColor(anyInStock ? 0x2ecc71 : 0xe74c3c)
    .setTitle('🚀 Stock de estradiol — Astrovials 💉')
    .setURL(`${BASE}/en/shop`);

  for (const p of PRODUCTS) {
    const s = state.products[p.slug];
    const lastSeen = !s?.inStock && s?.lastInStock ? ` · Última vez en stock: ${timestamp(s.lastInStock)}` : '';
    const qty = s?.inStock && Number.isFinite(s.stock) ? ` · ${s.stock} u.` : '';
    embed.addFields({
      name: s ? `${s.inStock ? '🟢' : '🔴'} ${p.label}` : `⏳ ${p.label}`,
      value: s
        ? `${s.inStock ? `En stock${qty}` : 'Agotado'}${lastSeen}\n[Ver producto](${BASE}/en/shop/${p.slug})`
        : 'Sin datos de stock aún',
    });
  }

  embed.addFields({
    name: 'Last check / Last change',
    value: `Check: ${state.lastCheck ? timestamp(state.lastCheck) : 'nunca'}\nCambio: ${state.lastChange ? timestamp(state.lastChange) : 'sin cambios registrados'}`,
  });

  return embed;
}

function start(client) {
  const minutes = stockCheckMinutes;
  const run = () => checkAll(client).catch((err) => console.error(`${TAG} ⚠️`, err.message));
  setTimeout(run, 45_000);
  setInterval(run, minutes * 60_000);
  const age = state.lastCheck ? `, estado de hace ${cal.fmtAge(Date.now() - Date.parse(state.lastCheck))}` : ', estado vacío (primera lectura al vuelo)';
  console.log(`${TAG} ✅ rastreo: ${PRODUCTS.length} productos cada ${minutes} min (${BASE.replace('https://', '')})${age}`);
}

loadState();

module.exports = { PRODUCTS, checkAll, ensureData, buildEmbed, start };
