const crypto = require("crypto");
const { create } = require("../lib/store");
const { roles } = require("../config");
const { createStockTracker } = require("./stockTracker");
const { USER_AGENT } = require("../utils/http");
const { decodeEntities } = require("../utils/html");

const BASE = "https://otkph.am";
const TAG = "💊 [otokonoko]";
const ROLE_OTOKONOKO = roles.otokonoko;
const PRODUCTS = [
  { slug: "estradiol-valerate", label: "Valerato de estradiol" },
  { slug: "estradiol-cypionate", label: "Cipionato de estradiol" },
  { slug: "estradiol-enanthate", label: "Enantato de estradiol" }
];

const FETCH_TIMEOUT_MS = 15 * 1000;
const POW_CHUNK = 50_000;
const POW_LIMIT = 5_000_000;
const COOKIE_STORE = create("anubis.json", TAG);

let jar = loadJar();

function loadJar() {
  const raw = COOKIE_STORE.load({});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function saveJar() {
  try {
    COOKIE_STORE.save(jar);
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude guardar las cookies: ${err.message}`);
  }
}

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function eatCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const pair = sc.split(";")[0];
    const i = pair.indexOf("=");
    if (i <= 0) continue;
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (name && value) jar[name] = value;
  }
}

async function timedFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function httpGet(url, headers = {}, depth = 0) {
  const res = await timedFetch(url, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader(), ...headers },
    redirect: "manual"
  });
  eatCookies(res);
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location && depth < 5) {
    const next = new URL(location, url);
    if (
      next.hostname === "otkph.am" ||
      next.hostname.endsWith(".otkph.am")
    ) {
      return httpGet(next.href, headers, depth + 1);
    }
  }
  return { res, url };
}

async function solvePow(challenge, startTime) {
  const prefix = "0".repeat(challenge.difficulty);
  const solved = (hash) => hash.startsWith(prefix);
  let nonce = 0;
  let hash = "";

  do {
    const end = Math.min(nonce + POW_CHUNK, POW_LIMIT);

    do {
      hash = crypto
        .createHash("sha256")
        .update(challenge.randomData + nonce)
        .digest("hex");
      nonce++;
    } while (!solved(hash) && nonce < end);

    if (!solved(hash) && nonce < POW_LIMIT) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  } while (!solved(hash) && nonce < POW_LIMIT);

  nonce--;

  if (!solved(hash)) throw new Error("anubis: pow no resuelto");

  return { hash, nonce, elapsedTime: Math.max(1, Date.now() - startTime) };
}

async function authenticate(challengeHtml, challengeUrl) {
  const m = challengeHtml.match(
    /<script id="anubis_challenge" type="application\/json">(.*?)<\/script>/s
  );
  if (!m) throw new Error("anubis: challenge no encontrado en la respuesta");
  const c = JSON.parse(m[1].trim());
  const startTime = Date.now();
  const { hash, nonce, elapsedTime } = await solvePow(c.challenge, startTime);

  const base = new URL(challengeUrl).origin;
  const passUrl =
    `${base}/.within.website/x/cmd/anubis/api/pass-challenge` +
    `?id=${encodeURIComponent(c.challenge.id)}&response=${hash}&nonce=${nonce}` +
    `&redir=${encodeURIComponent(BASE + "/")}&elapsedTime=${elapsedTime}`;
  const res = await timedFetch(passUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: cookieHeader(),
      Referer: challengeUrl
    },
    redirect: "manual"
  });
  eatCookies(res);
  await res.text().catch(() => "");
  if (res.status !== 302)
    throw new Error(`anubis: pass-challenge respondió ${res.status}`);
  saveJar();
  console.log(`${TAG} 🔐 anubis autenticado`);
}

async function anubisFetch(url, accept = "application/json") {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, url: finalUrl } = await httpGet(url, { Accept: accept });
    const body = await res.text();
    if (!body.includes("anubis_challenge")) {
      return { res, body };
    }
    await authenticate(body, finalUrl);
  }
  throw new Error("anubis: sigue mostrando challenge tras re-autenticar");
}

function parseVariations(html) {
  const match = html.match(/data-product_variations="([^"]*)"/);
  if (!match) throw new Error("variaciones no encontradas en la página");
  const parsed = JSON.parse(decodeEntities(match[1]));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("variaciones inválidas en la página");
  }
  return parsed;
}

function variationStock(variation) {
  const html = variation.availability_html ?? "";
  if (/out of stock/i.test(html)) return 0;
  const match = html.match(/(\d+)\s+(?:in stock|left in stock)/i);
  return match ? Number(match[1]) : null;
}

async function fetchProductStock(slug) {
  const url = `${BASE}/product/${slug}/`;
  const { res, body } = await anubisFetch(url, "text/html");
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const variations = parseVariations(body);
  const quantities = variations
    .map(variationStock)
    .filter((n) => n !== null);
  const stock = quantities.length ? Math.max(...quantities) : 0;
  const inStock =
    variations.some((v) => v.is_in_stock === true) || stock > 0;
  const nameMatch = body.match(
    /<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/h1>/i
  );
  const name = nameMatch ? decodeEntities(nameMatch[1]).trim() : null;
  return { name, stock, inStock };
}

const tracker = createStockTracker({
  tag: TAG,
  base: BASE,
  storeKey: "otokonoko",
  storeFile: "stock.json",
  roleId: ROLE_OTOKONOKO,
  products: PRODUCTS,
  title: "Otokonoko Pharmacy",
  url: BASE,
  productUrl: (p) => `${BASE}/product/${p.slug}/`,
  initialDelay: 30_000,
  fetchProduct: fetchProductStock,
  countSoldOutExit: false,
  migrate: (raw) => {
    if (
      raw?.jar &&
      typeof raw.jar === "object" &&
      !Array.isArray(raw.jar) &&
      Object.keys(jar).length === 0
    ) {
      jar = { ...raw.jar };
      saveJar();
      console.log(`${TAG} 🍪 cookies migradas a anubis.json`);
    }
  }
});

module.exports = {
  PRODUCTS,
  checkAll: tracker.checkAll,
  ensureData: tracker.ensureData,
  buildEmbed: tracker.buildEmbed,
  getProductState: tracker.getProductState,
  start: tracker.start,
  parseVariations,
  variationStock,
  fetchProductStock
};
