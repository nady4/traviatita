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

module.exports = { add, mergeMax, day, range };
