const { create } = require('./store');
const { daysBetween } = require('./calendario');

const TAG = '📦 [produccion]';
const STORE = create('produccion.json', TAG);

let state = loadState();

function loadState() {
  const raw = STORE.load({});
  return {
    astrovials: raw.astrovials ?? {},
    otokonoko: raw.otokonoko ?? {},
    exits: {
      astrovials: raw.exits?.astrovials ?? {},
      otokonoko: raw.exits?.otokonoko ?? {},
    },
    inStockSince: {
      astrovials: raw.inStockSince?.astrovials ?? {},
      otokonoko: raw.inStockSince?.otokonoko ?? {},
    },
    durations: {
      astrovials: raw.durations?.astrovials ?? {},
      otokonoko: raw.durations?.otokonoko ?? {},
    },
  };
}

function saveState() {
  STORE.save(state);
}

function add(store, date, slug, qty) {
  const n = Math.floor(Number(qty));
  if (!date || !slug || !Number.isFinite(n) || n <= 0) return 0;
  const days = (state[store] ??= {});
  const counts = (days[date] ??= {});
  counts[slug] = (counts[slug] ?? 0) + n;
  saveState();
  return counts[slug];
}

function addExit(store, date, slug, qty) {
  const n = Math.floor(Number(qty));
  if (!date || !slug || !Number.isFinite(n) || n <= 0) return 0;
  const days = (state.exits[store] ??= {});
  const counts = (days[date] ??= {});
  counts[slug] = (counts[slug] ?? 0) + n;
  saveState();
  return counts[slug];
}

function mergeMax(store, date, counts) {
  if (!date || !counts) return;
  const days = (state[store] ??= {});
  const day = (days[date] ??= {});
  let changed = false;
  for (const [slug, qty] of Object.entries(counts)) {
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n > (day[slug] ?? 0)) {
      day[slug] = n;
      changed = true;
    }
  }
  if (changed) saveState();
}

function day(store, date) {
  return state[store]?.[date] ?? {};
}

function exitDay(store, date) {
  return state.exits[store]?.[date] ?? {};
}

function range(store, start, end) {
  const totals = {};
  for (const date of daysBetween(start, end)) {
    const counts = state[store]?.[date];
    if (!counts) continue;
    for (const [slug, qty] of Object.entries(counts)) {
      totals[slug] = (totals[slug] ?? 0) + qty;
    }
  }
  return totals;
}

function markInStock(store, slug, sinceIso, fallbackIso) {
  if (!store || !slug || !sinceIso) return;
  const periods = (state.inStockSince[store] ??= {});
  if (periods[slug]?.since) return;
  const since =
    fallbackIso && Date.parse(fallbackIso) < Date.parse(sinceIso)
      ? fallbackIso
      : sinceIso;
  periods[slug] = { since };
  saveState();
}

function markOutOfStock(store, slug, endIso, weekKey, fallbackIso) {
  if (!store || !slug || !endIso || !weekKey) return null;
  const periods = (state.inStockSince[store] ??= {});
  const sinceIso = periods[slug]?.since ?? fallbackIso;
  delete periods[slug];
  if (!sinceIso) {
    saveState();
    return null;
  }

  const start = Date.parse(sinceIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    saveState();
    return null;
  }

  const ms = end - start;
  const byStore = (state.durations[store] ??= {});
  const product = (byStore[slug] ??= {
    weeks: {},
    totalMs: 0,
    episodes: 0,
    averageMs: 0,
  });
  product.totalMs += ms;
  product.episodes += 1;
  product.averageMs = Math.round(product.totalMs / product.episodes);

  const week = (product.weeks[weekKey] ??= {
    totalMs: 0,
    episodes: 0,
    averageMs: 0,
  });
  week.totalMs += ms;
  week.episodes += 1;
  week.averageMs = Math.round(week.totalMs / week.episodes);

  saveState();
  return { ms, weekKey, averageMs: product.averageMs, weekAverageMs: week.averageMs };
}

function duration(store, slug) {
  return state.durations[store]?.[slug] ?? null;
}

module.exports = {
  add,
  addExit,
  mergeMax,
  day,
  exitDay,
  range,
  markInStock,
  markOutOfStock,
  duration,
};
