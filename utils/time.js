function fmtAge(ms) {
  if (!Number.isFinite(ms)) return 'tiempo desconocido';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

function every(ms, run, { first = 0, label = "" } = {}) {
  const safe = () =>
    Promise.resolve()
      .then(run)
      .catch((err) => console.error(`${label} ⚠️`, err.message));

  if (first > 0) {
    setTimeout(safe, first);
  } else {
    safe();
  }

  return setInterval(safe, ms);
}

module.exports = { fmtAge, every };
