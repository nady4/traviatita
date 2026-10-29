const { EmbedBuilder } = require('discord.js');
const { create } = require('./store');

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const BASE = 'https://astrovials.com';
const NOTIFY_ROLE_ID = process.env.ASTRO_NOTIFY_ROLE_ID ?? '1564743677601915051';
const TAG = '🚀 [astrovials]';
const STORE = create('astro.json', TAG);

const PRODUCTS = [
  { slug: 'estradiol-valerate-mct', label: 'Valerato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-mct', label: 'Enantato de estradiol (MCT)' },
  { slug: 'estradiol-enanthate-castor-oil', label: 'Enantato de estradiol (Castor)' },
  { slug: 'estradiol-undecylate-mct', label: 'Undecilato de estradiol (MCT)' },
];

let state = { lastCheck: null, lastChange: null, products: {} };
let inFlight = null;

function parseMin(raw, fallback) {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const STALE_ANNOUNCE_MS = parseMin(process.env.ASTRO_STALE_ANNOUNCE_MIN, 30) * 60_000;

function fmtAge(ms) {
  if (!Number.isFinite(ms)) return 'tiempo desconocido';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

function loadState() {
  const raw = STORE.load({});
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
    console.error(`${TAG} ⚠️ no pude anunciar:`, err.message);
  }
}

async function checkAll(client) {
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
        console.log(`${TAG} 🕓 ${p.label}: ${prev.inStock ? '🟢 → 🔴' : '🔴 → 🟢'} reconciliado tras corte de ${fmtAge(prevAgeMs)} (sin anuncio)`);
      } else if (changed) {
        console.log(`${TAG} 🔔 ${p.label}: ${prev.inStock ? '🟢 → 🔴' : '🔴 → 🟢'} (${priceStr(prod)} · ${prod.stock} u.)`);
        state.lastChange = nowIso;
        await announceChange(client, p.slug, p.label, prev.inStock, state.products[p.slug]);
      } else if (!prev) {
        console.log(`${TAG} ➕ ${p.label}: ${inStock ? '🟢' : '🔴'} (primera lectura) · ${priceStr(prod)}`);
      }
      ok++;
    } catch (err) {
      fails++;
      badges.push('⚠️');
      console.error(`${TAG} ⚠️ ${p.slug}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (ok > 0) {
    state.lastCheck = new Date().toISOString();
    saveState();
  }
  console.log(`${TAG} 📋 ${badges.join('')} (${ok}/${PRODUCTS.length}${fails ? `, ${fails} fallas` : ''})`);
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
  const run = () => checkAll(client).catch((err) => console.error(`${TAG} ⚠️`, err.message));
  setTimeout(run, 45_000);
  setInterval(run, minutes * 60_000);
  const age = state.lastCheck ? `, estado de hace ${fmtAge(Date.now() - Date.parse(state.lastCheck))}` : ', estado vacío (primera lectura al vuelo)';
  console.log(`${TAG} ✅ rastreo: ${PRODUCTS.length} productos cada ${minutes} min (${BASE.replace('https://', '')})${age}`);
}

loadState();

module.exports = { PRODUCTS, NOTIFY_ROLE_ID, checkAll, ensureData, buildEmbed, start };
