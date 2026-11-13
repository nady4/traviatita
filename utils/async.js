function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function singleFlight(fn) {
  let inFlight = null;
  return function (...args) {
    if (!inFlight) {
      inFlight = Promise.resolve()
        .then(() => fn.apply(this, args))
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
}

module.exports = { sleep, singleFlight };
