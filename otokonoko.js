const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const { create } = require("./store");
const { roles, channels, stockCheckMinutes } = require("./config");
const cal = require("./calendario");
const produccion = require("./produccion");
const { USER_AGENT } = require("./utils/http");
const { fmtAge } = require("./utils/time");
const { decodeEntities } = require("./utils/html");
const { sleep, singleFlight } = require("./utils/async");
const { timestamp, announceStockChange } = require("./utils/discord");

const BASE = "https://otkph.am";
const TAG = "💊 [otokonoko]";
const STORE = create("stock.json", TAG);
const ROLE_OTOKONOKO = roles.otokonoko;
const PRODUCTS = [
  { slug: "estradiol-valerate", label: "Valerato de estradiol" },
  { slug: "estradiol-cypionate", label: "Cipionato de estradiol" },
  { slug: "estradiol-enanthate", label: "Enantato de estradiol" }
];

let state = { jar: {}, lastCheck: null, lastChange: null, products: {} };

const STALE_ANNOUNCE_MS = 30 * 60_000;

function loadState() {
  const raw = STORE.load({});
  state = {
    jar: raw.jar ?? {},
    lastCheck: raw.lastCheck ?? null,
    lastChange: raw.lastChange ?? null,
    products: raw.products ?? {}
  };
}

function saveState() {
  STORE.save(state);
}

function cookieHeader() {
  return Object.entries(state.jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function eatCookies(res) {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const pair = sc.split(";")[0];
    const i = pair.indexOf("=");
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    if (value) state.jar[name] = value;
  }
}

async function httpGet(url, headers = {}, depth = 0) {
  const res = await fetch(url, {
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

function solvePow(challenge, startTime) {
  const prefix = "0".repeat(challenge.difficulty);
  let nonce = 0;
  let hash;
  do {
    hash = crypto
      .createHash("sha256")
      .update(challenge.randomData + nonce)
      .digest("hex");
    nonce++;
  } while (!hash.startsWith(prefix) && nonce < 5_000_000);
  nonce--;
  if (nonce >= 5_000_000) throw new Error("anubis: pow no resuelto");
  return { hash, nonce, elapsedTime: Math.max(1, Date.now() - startTime) };
}

async function authenticate(challengeHtml, challengeUrl) {
  const m = challengeHtml.match(
    /<script id="anubis_challenge" type="application\/json">(.*?)<\/script>/s
  );
  if (!m) throw new Error("anubis: challenge no encontrado en la respuesta");
  const c = JSON.parse(m[1].trim());
  const startTime = Date.now();
  const { hash, nonce, elapsedTime } = solvePow(c.challenge, startTime);

  const base = new URL(challengeUrl).origin;
  const passUrl =
    `${base}/.within.website/x/cmd/anubis/api/pass-challenge` +
    `?id=${encodeURIComponent(c.challenge.id)}&response=${hash}&nonce=${nonce}` +
    `&redir=${encodeURIComponent(BASE + "/")}&elapsedTime=${elapsedTime}`;
  const res = await fetch(passUrl, {
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
  saveState();
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

async function runCheck(client) {
  const badges = [];
  let ok = 0;
  let fails = 0;
  for (const p of PRODUCTS) {
    try {
      const prod = await fetchProductStock(p.slug);

      const now = new Date();
      const nowIso = now.toISOString();
      const inStock = prod.inStock;
      const prev = state.products[p.slug];
      const changed = !!prev && prev.inStock !== inStock;
      const prevRead = prev
        ? Date.parse(prev.lastRead ?? state.lastCheck ?? "")
        : NaN;
      const prevAgeMs = Number.isFinite(prevRead)
        ? Math.max(0, now.getTime() - prevRead)
        : Infinity;
      const staleAnnounce =
        STALE_ANNOUNCE_MS > 0 && changed && prevAgeMs > STALE_ANNOUNCE_MS;
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
      const exited =
        stockDelta < 0 && fresh && (!prod.inStock || prod.stock > 0)
          ? -stockDelta
          : 0;

      if (restocked > 0) {
        const date = cal.dateKey(now);
        produccion.add("otokonoko", date, p.slug, restocked);
        console.log(
          `${TAG} 📦 ${p.label}: +${restocked} viales el ${cal.fmtDate(date)}`
        );
      }

      if (exited > 0) {
        const date = cal.dateKey(now);
        produccion.addExit("otokonoko", date, p.slug, exited);
        console.log(
          `${TAG} 📤 ${p.label}: -${exited} viales el ${cal.fmtDate(date)}`
        );
      }

      if (inStock) {
        produccion.markInStock(
          "otokonoko",
          p.slug,
          nowIso,
          prev?.inStock ? prev.lastChange : null
        );
      } else if (changed && prev?.inStock) {
        const endIso = staleAnnounce ? (prev.lastRead ?? nowIso) : nowIso;
        const weekKey = cal.weekEndingSunday(cal.dateKey(new Date(endIso)));
        const result = produccion.markOutOfStock(
          "otokonoko",
          p.slug,
          endIso,
          weekKey,
          prev.lastChange
        );
        if (result) {
          console.log(
            `${TAG} ⏱️ ${p.label}: en stock ${cal.fmtAge(result.ms)} (promedio semanal ${cal.fmtAge(result.weekAverageMs)})`
          );
        }
      }

      state.products[p.slug] = {
        name: prod.name ?? prev?.name ?? p.label,
        stock: prod.stock,
        inStock,
        lastRead: nowIso,
        lastInStock: inStock ? nowIso : (prev?.lastInStock ?? null),
        lastChange: staleAnnounce
          ? (prev?.lastChange ?? null)
          : changed
            ? nowIso
            : (prev?.lastChange ?? null)
      };
      saveState();
      badges.push(inStock ? "🟢" : "🔴");
      if (staleAnnounce) {
        console.log(
          `${TAG} 🕓 ${p.label}: ${prev.inStock ? "🟢 → 🔴" : "🔴 → 🟢"} reconciliado tras corte de ${cal.fmtAge(prevAgeMs)} (sin anuncio)`
        );
      } else if (changed) {
        state.lastChange = nowIso;
        console.log(
          `${TAG} 🔔 ${p.label}: ${prev.inStock ? "🟢 → 🔴" : "🔴 → 🟢"} (${prod.stock} u.)`
        );
        await announceStockChange({
          client,
          channelId: channels.stock,
          roleId: ROLE_OTOKONOKO,
          title: "Otokonoko Pharmacy",
          url: `${BASE}/product/${p.slug}/`,
          label: p.label,
          wasInStock: prev.inStock,
          inStock: state.products[p.slug].inStock,
          tag: TAG
        });
      } else if (!prev) {
        console.log(
          `${TAG} ➕ ${p.label}: ${inStock ? "🟢" : "🔴"} (primera lectura · ${prod.stock} u.)`
        );
      }
      ok++;
    } catch (err) {
      fails++;
      badges.push("⚠️");
      console.error(`${TAG} ⚠️ ${p.slug}: ${err.message}`);
    }
    await sleep(2000);
  }
  if (ok > 0) {
    state.lastCheck = new Date().toISOString();
    saveState();
  }
  console.log(
    `${TAG} 📋 ${badges.join("")} (${ok}/${PRODUCTS.length}${fails ? `, ${fails} fallas` : ""})`
  );
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
    .setTitle("🏳️‍⚧️ Stock de estradiol — Otokonoko Pharmacy 💊")
    .setURL(BASE);

  for (const p of PRODUCTS) {
    const s = state.products[p.slug];
    const lastSeen =
      !s?.inStock && s?.lastInStock
        ? ` · Última vez en stock: ${timestamp(s.lastInStock)}`
        : "";
    const qty =
      s?.inStock && Number.isFinite(s.stock) ? ` · ${s.stock} u.` : "";
    embed.addFields({
      name: s ? `${s.inStock ? "🟢" : "🔴"} ${p.label}` : `⏳ ${p.label}`,
      value: s
        ? `${s.inStock ? `En stock${qty}` : "Agotado"}${lastSeen}\n[Ver producto](${BASE}/product/${p.slug}/)`
        : "Sin datos de stock aún"
    });
  }

  embed.addFields({
    name: "Last check / Last change",
    value: `Check: ${state.lastCheck ? timestamp(state.lastCheck) : "nunca"}\nCambio: ${state.lastChange ? timestamp(state.lastChange) : "sin cambios registrados"}`
  });

  return embed;
}

function start(client) {
  const minutes = stockCheckMinutes;
  const run = () =>
    checkAll(client).catch((err) => console.error(`${TAG} ⚠️`, err.message));
  setTimeout(run, 30_000);
  setInterval(run, minutes * 60_000);
  const age = state.lastCheck
    ? `, estado de hace ${fmtAge(Date.now() - Date.parse(state.lastCheck))}`
    : ", estado vacío (primera lectura al vuelo)";
  console.log(
    `${TAG} ✅ rastreo: ${PRODUCTS.length} productos cada ${minutes} min (${BASE.replace("https://", "")})${age}`
  );
}

loadState();

module.exports = {
  PRODUCTS,
  checkAll,
  ensureData,
  buildEmbed,
  start,
  parseVariations,
  variationStock,
  fetchProductStock
};
