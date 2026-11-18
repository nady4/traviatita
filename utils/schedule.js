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

module.exports = { every };
