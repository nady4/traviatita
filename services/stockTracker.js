const { EmbedBuilder } = require("discord.js");
const { create } = require("../lib/store");
const { channels, stockCheckMinutes } = require("../config");
const cal = require("../utils/calendario");
const produccion = require("./produccion");
const { sleep, singleFlight } = require("../utils/async");
const { timestamp, announceStockChange } = require("../utils/discord");
const { every } = require("../utils/time");

const STALE_ANNOUNCE_MS = 30 * 60_000;

function createStockTracker({
  tag,
  base,
  storeKey,
  storeFile,
  roleId,
  products,
  title,
  url,
  productUrl,
  initialDelay = 30_000,
  fetchProduct,
  migrate,
  extraState,
  changeLog,
  firstLog,
  countSoldOutExit = true
}) {
  const STORE = create(storeFile, tag);
  let state = { lastCheck: null, lastChange: null, products: {} };

  function loadState() {
    const raw = STORE.load({});
    if (migrate) migrate(raw);
    state = {
      lastCheck: raw.lastCheck ?? null,
      lastChange: raw.lastChange ?? null,
      products: raw.products ?? {}
    };
  }

  function saveState() {
    STORE.save(state);
  }

  async function runCheck(client) {
    const badges = [];
    let ok = 0;
    let fails = 0;

    for (const p of products) {
      try {
        const prod = await fetchProduct(p.slug);

        const now = new Date();
        const nowIso = now.toISOString();
        const inStock =
          typeof prod.inStock === "boolean"
            ? prod.inStock
            : Number(prod.stock) > 0;
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
          stockDelta < 0 &&
          fresh &&
          (countSoldOutExit || !inStock || prod.stock > 0)
            ? -stockDelta
            : 0;

        if (restocked > 0) {
          const date = cal.dateKey(now);
          produccion.add(storeKey, date, p.slug, restocked);
          console.log(
            `${tag} 📦 ${p.label}: +${restocked} viales el ${cal.fmtDate(date)}`
          );
        }

        if (exited > 0) {
          const date = cal.dateKey(now);
          produccion.addExit(storeKey, date, p.slug, exited);
          console.log(
            `${tag} 📤 ${p.label}: -${exited} viales el ${cal.fmtDate(date)}`
          );
        }

        if (inStock) {
          produccion.markInStock(
            storeKey,
            p.slug,
            nowIso,
            prev?.inStock ? prev.lastChange : null
          );
        } else if (changed && prev?.inStock) {
          const endIso = staleAnnounce ? (prev.lastRead ?? nowIso) : nowIso;
          const weekKey = cal.weekEndingSunday(cal.dateKey(new Date(endIso)));
          const result = produccion.markOutOfStock(
            storeKey,
            p.slug,
            endIso,
            weekKey,
            prev.lastChange
          );
          if (result) {
            console.log(
              `${tag} ⏱️ ${p.label}: en stock ${cal.fmtAge(result.ms)} (promedio semanal ${cal.fmtAge(result.weekAverageMs)})`
            );
          }
        }

        const nextState = {
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

        if (extraState) {
          Object.assign(nextState, extraState({ prod, prev, product: p }));
        }

        state.products[p.slug] = nextState;
        saveState();
        badges.push(inStock ? "🟢" : "🔴");

        const context = { tag, product: p, prod, prev, inStock };

        if (staleAnnounce) {
          console.log(
            `${tag} 🕓 ${p.label}: ${prev.inStock ? "🟢 → 🔴" : "🔴 → 🟢"} reconciliado tras corte de ${cal.fmtAge(prevAgeMs)} (sin anuncio)`
          );
        } else if (changed) {
          state.lastChange = nowIso;
          console.log(
            changeLog
              ? changeLog(context)
              : `${tag} 🔔 ${p.label}: ${prev.inStock ? "🟢 → 🔴" : "🔴 → 🟢"} (${prod.stock} u.)`
          );
          await announceStockChange({
            client,
            channelId: channels.stock,
            roleId,
            title,
            url: productUrl(p),
            label: p.label,
            wasInStock: prev.inStock,
            inStock,
            tag
          });
        } else if (!prev) {
          console.log(
            firstLog
              ? firstLog(context)
              : `${tag} ➕ ${p.label}: ${inStock ? "🟢" : "🔴"} (primera lectura · ${prod.stock} u.)`
          );
        }

        ok++;
      } catch (err) {
        fails++;
        badges.push("⚠️");
        console.error(`${tag} ⚠️ ${p.slug}: ${err.message}`);
      }

      await sleep(2000);
    }

    produccion.flush();

    if (ok > 0) {
      state.lastCheck = new Date().toISOString();
      saveState();
    }

    console.log(
      `${tag} 📋 ${badges.join("")} (${ok}/${products.length}${fails ? `, ${fails} fallas` : ""})`
    );
  }

  const checkAll = singleFlight(runCheck);

  function hasData() {
    return products.every((p) => state.products[p.slug]);
  }

  const ensureData = singleFlight(async (client) => {
    if (hasData()) return;
    await checkAll(client);
  });

  function getProductState() {
    return { products: state.products, lastCheck: state.lastCheck };
  }

  function buildEmbed() {
    const anyInStock = products.some((p) => state.products[p.slug]?.inStock);
    const embed = new EmbedBuilder()
      .setColor(anyInStock ? 0x2ecc71 : 0xe74c3c)
      .setTitle(title)
      .setURL(url);

    for (const p of products) {
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
          ? `${s.inStock ? `En stock${qty}` : "Agotado"}${lastSeen}\n[Ver producto](${productUrl(p)})`
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

    every(minutes * 60_000, () => checkAll(client), {
      first: initialDelay,
      label: tag
    });

    const age = state.lastCheck
      ? `, estado de hace ${cal.fmtAge(Date.now() - Date.parse(state.lastCheck))}`
      : ", estado vacío (primera lectura al vuelo)";

    console.log(
      `${tag} ✅ rastreo: ${products.length} productos cada ${minutes} min (${base.replace("https://", "")})${age}`
    );
  }

  loadState();

  return {
    PRODUCTS: products,
    checkAll,
    ensureData,
    buildEmbed,
    getProductState,
    start
  };
}

module.exports = { createStockTracker };
