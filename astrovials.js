const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const BASE = 'https://astrovials.com';
const STATE_FILE = path.join(__dirname, 'astro.json');
const NOTIFY_ROLE_ID = process.env.ASTRO_NOTIFY_ROLE_ID ?? '1564743677601915051';

const PRODUCTS = [
  { slug: 'estradiol-valerate-mct', label: 'Valerato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-mct', label: 'Enantato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-castor-oil', label: 'Enantato de estradiol (Castor)' },
  { slug: 'estradiol-undecylate-mct', label: 'Undecilato de estradiol (MCT)' },
];

let state = { lastCheck: null, lastChange: null, products: {} };
let inFlight = null;

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = {
      lastCheck: raw.lastCheck ?? null,
      lastChange: raw.lastChange ?? null,
      products: raw.products ?? {},
    };
  } catch {
    state = { lastCheck: null, lastChange: null, products: {} };
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchProductPage(slug) {
  const url = `${BASE}/en/shop/${slug}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.text()).replace(/\\"/g, '"');
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

async function announceChange(client, slug, label, wasInStock, current) {
  const channelId = process.env.ASTRO_ANNOUNCE_CHANNEL_ID ?? process.env.OTK_ANNOUNCE_CHANNEL_ID;
  if (!channelId || !client) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error('canal de anuncios inválido');
    const embed = new EmbedBuilder()
      .setColor(current.inStock ? 0x2ecc71 : 0xe74c3c)
      .setTitle('Astrovials')
      .setURL(`${BASE}/en/shop/${slug}`)
      .setDescription(
        `**${label}**: ${wasInStock ? '🟢 en stock' : '🔴 agotado'} → ${current.inStock ? '🟢 **en stock**' : '🔴 **agotado**'}`,
      );
    await channel.send({
      content: `<@&${NOTIFY_ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: { roles: [NOTIFY_ROLE_ID] },
    });
  } catch (err) {
    console.error('[astrovials] anuncio:', err.message);
  }
}

async function checkAll(client) {
  let ok = 0;
  for (const p of PRODUCTS) {
    try {
      const prod = await fetchProductPage(p.slug);
      const now = new Date().toISOString();
      const inStock = prod.stock > 0;
      const prev = state.products[p.slug];
      const changed = !!prev && prev.inStock !== inStock;

      state.products[p.slug] = {
        name: prod.name,
        price: priceStr(prod),
        stock: prod.stock,
        inStock,
        lastInStock: inStock ? now : prev?.lastInStock ?? null,
        lastChange: changed ? now : prev?.lastChange ?? null,
      };
      if (changed) {
        state.lastChange = now;
        console.log(`[astrovials] CAMBIO ${p.label}: ${prev.inStock ? 'en stock → agotado' : 'agotado → EN STOCK'}`);
        await announceChange(client, p.slug, p.label, prev.inStock, state.products[p.slug]);
      } else {
        console.log(`[astrovials] ${p.label}: ${inStock ? `EN STOCK (${prod.stock})` : 'agotado'} · ${priceStr(prod)}`);
      }
      ok++;
    } catch (err) {
      console.error(`[astrovials] error con ${p.slug}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (ok > 0) {
    state.lastCheck = new Date().toISOString();
    saveState();
  }
}

function hasData() {
  return PRODUCTS.every((p) => state.products[p.slug]);
}

async function ensureData(client) {
  if (hasData()) return;
  if (!inFlight) {
    inFlight = checkAll(client).finally(() => {
      inFlight = null;
    });
  }
  await inFlight;
}

function discordTs(iso) {
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
}

function buildEmbed() {
  const anyInStock = PRODUCTS.some((p) => state.products[p.slug]?.inStock);
  const embed = new EmbedBuilder()
    .setColor(anyInStock ? 0x2ecc71 : 0xe74c3c)
    .setTitle('🚀 Stock de estradiol — Astrovials 💉')
    .setURL(`${BASE}/en/shop`);

  for (const p of PRODUCTS) {
    const s = state.products[p.slug];
    const lastSeen = !s?.inStock && s?.lastInStock ? ` · Última vez en stock: ${discordTs(s.lastInStock)}` : '';
    embed.addFields({
      name: s ? `${s.inStock ? '🟢' : '🔴'} ${p.label}` : `⏳ ${p.label}`,
      value: s
        ? `${s.inStock ? 'En stock' : 'Agotado'}${lastSeen}\n[Ver producto](${BASE}/en/shop/${p.slug})`
        : 'Sin datos de stock aún',
    });
  }

  embed.addFields({
    name: 'Last check / Last change',
    value: `Check: ${state.lastCheck ? discordTs(state.lastCheck) : 'nunca'}\nCambio: ${state.lastChange ? discordTs(state.lastChange) : 'sin cambios registrados'}`,
  });

  return embed;
}

function start(client) {
  const minutes = Math.max(1, Number.parseInt(process.env.ASTRO_CHECK_MINUTES ?? '10', 10) || 10);
  const run = () => checkAll(client).catch((err) => console.error('[astrovials]', err.message));
  setTimeout(run, 45_000);
  setInterval(run, minutes * 60_000);
  console.log(`[astrovials] rastreando ${PRODUCTS.length} productos, chequeo cada ${minutes} min`);
}

loadState();

module.exports = { PRODUCTS, NOTIFY_ROLE_ID, checkAll, ensureData, buildEmbed, start };
