function fmtAge(ms) {
  if (!Number.isFinite(ms)) return 'tiempo desconocido';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

module.exports = { fmtAge };
