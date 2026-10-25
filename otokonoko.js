const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const BASE = 'https://otkph.am';
const STORE_API = `${BASE}/wp-json/wc/store/v1/products`;
const STATE_FILE = path.join(__dirname, 'stock.json');

const PRODUCTS = [
  { slug: 'estradiol-valerate', label: 'Valerato de estradiol' },
  { slug: 'estradiol-cypionate', label: 'Cipionato de estradiol' },
  { slug: 'estradiol-enanthate', label: 'Enanato de estradiol' },
];

let state = { jar: {}, lastCheck: null, lastChange: null, products: {} };
let inFlight = null;

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = {
      jar: raw.jar ?? {},
      lastCheck: raw.lastCheck ?? null,
      lastChange: raw.lastChange ?? null,
      products: raw.products ?? {},
    };
  } catch {
    state = { jar: {}, lastCheck: null, lastChange: null, products: {} };
  }
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function cookieHeader() {
  return Object.entries(state.jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function eatCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const pair = sc.split(';')[0];
    const i = pair.indexOf('=');
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value) state.jar[name] = value;
  }
}

async function httpGet(url, headers = {}, depth = 0) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: cookieHeader(), ...headers },
    redirect: 'manual',
  });
  eatCookies(res);
  const location = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && location && depth < 5) {
    const next = new URL(location, url);
    if (next.hostname.endsWith('otkph.am')) {
      return httpGet(next.href, headers, depth + 1);
    }
  }
  return { res, url };
}

function solvePow(challenge, startTime) {
  const prefix = '0'.repeat(challenge.difficulty);
  let nonce = 0;
  let hash;
  do {
    hash = crypto.createHash('sha256').update(challenge.randomData + nonce).digest('hex');
    nonce++;
  } while (!hash.startsWith(prefix) && nonce < 5_000_000);
  nonce--;
  if (nonce >= 5_000_000) throw new Error('anubis: pow no resuelto');
  return { hash, nonce, elapsedTime: Math.max(1, Date.now() - startTime) };
}

async function authenticate(challengeHtml, challengeUrl) {
  const m = challengeHtml.match(/<script id="anubis_challenge" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('anubis: challenge no encontrado en la respuesta');
  const c = JSON.parse(m[1].trim());
  const startTime = Date.now();
  const { hash, nonce, elapsedTime } = solvePow(c.challenge, startTime);

  const base = new URL(challengeUrl).origin;
  const passUrl =
    `${base}/.within.website/x/cmd/anubis/api/pass-challenge` +
    `?id=${encodeURIComponent(c.challenge.id)}&response=${hash}&nonce=${nonce}` +
    `&redir=${encodeURIComponent(BASE + '/')}&elapsedTime=${elapsedTime}`;
  const res = await fetch(passUrl, {
    headers: { 'User-Agent': UA, Cookie: cookieHeader(), Referer: challengeUrl },
    redirect: 'manual',
  });
  eatCookies(res);
  await res.text().catch(() => '');
  if (res.status !== 302) throw new Error(`anubis: pass-challenge respondió ${res.status}`);
  saveState();
  console.log('[otokonoko] anubis autenticado');
}

async function anubisFetch(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, url: finalUrl } = await httpGet(url, { Accept: 'application/json' });
    const body = await res.text();
    if (!body.includes('anubis_challenge')) {
      return { res, body };
    }
    await authenticate(body, finalUrl);
  }
  throw new Error('anubis: sigue mostrando challenge tras re-autenticar');
}

async function announceChange(client, slug, label, wasInStock, current) {
  const channelId = process.env.OTK_ANNOUNCE_CHANNEL_ID;
  if (!channelId || !client) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error('canal de anuncios inválido');
    const embed = new EmbedBuilder()
      .setColor(current.inStock ? 0x2ecc71 : 0xe74c3c)
      .setTitle('Otokonoko Pharmacy')
      .setURL(`${BASE}/product/${slug}/`)
      .setDescription(
        `**${label}**: ${wasInStock ? '🟢 en stock' : '🔴 agotado'} → ${current.inStock ? '🟢 **en stock**' : '🔴 **agotado**'}`,
      );
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[otokonoko] anuncio:', err.message);
  }
}

async function checkAll(client) {
  let ok = 0;
  for (const p of PRODUCTS) {
    try {
      const { res, body } = await anubisFetch(`${STORE_API}?slug=${p.slug}`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(body);
      const prod = Array.isArray(data) ? data[0] : null;
      if (!prod) throw new Error('producto no encontrado en la API');

      const now = new Date().toISOString();
      const inStock = prod.is_in_stock === true;
      const prev = state.products[p.slug];
      const changed = !!prev && prev.inStock !== inStock;

      state.products[p.slug] = {
        name: prod.name,
        inStock,
        lastInStock: inStock ? now : prev?.lastInStock ?? null,
        lastChange: changed ? now : prev?.lastChange ?? null,
      };
      if (changed) {
        state.lastChange = now;
        console.log(`[otokonoko] CAMBIO ${p.label}: ${prev.inStock ? 'en stock → agotado' : 'agotado → EN STOCK'}`);
        await announceChange(client, p.slug, p.label, prev.inStock, state.products[p.slug]);
      } else {
        console.log(`[otokonoko] ${p.label}: ${inStock ? 'EN STOCK' : 'agotado'}`);
      }
      ok++;
    } catch (err) {
      console.error(`[otokonoko] error con ${p.slug}:`, err.message);
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
    .setTitle('🏳️‍⚧️ Stock de estradiol — Otokonoko Pharmacy 💊')
    .setURL(BASE);

  for (const p of PRODUCTS) {
    const s = state.products[p.slug];
    const lastSeen = !s?.inStock && s?.lastInStock ? ` · Última vez en stock: ${discordTs(s.lastInStock)}` : '';
    embed.addFields({
      name: s ? `${s.inStock ? '🟢' : '🔴'} ${p.label}` : `⏳ ${p.label}`,
      value: s
        ? `${s.inStock ? 'En stock' : 'Agotado'}${lastSeen}\n[Ver producto](${BASE}/product/${p.slug}/)`
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
  const minutes = Math.max(1, Number.parseInt(process.env.OTK_CHECK_MINUTES ?? '10', 10) || 10);
  const run = () => checkAll(client).catch((err) => console.error('[otokonoko]', err.message));
  setTimeout(run, 30_000);
  setInterval(run, minutes * 60_000);
  console.log(`[otokonoko] rastreando ${PRODUCTS.length} productos, chequeo cada ${minutes} min`);
}

loadState();

module.exports = { PRODUCTS, checkAll, ensureData, buildEmbed, start };
