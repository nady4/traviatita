const cal = require("./calendario");
const store = require("./store");

const TAG = "🚪 [miembros]";
const STORE = store.create("miembros.json", TAG);

let state = loadState();

function loadState() {
  const raw = STORE.load({});
  return { days: raw.days ?? {} };
}

function saveState() {
  STORE.save(state);
}

function empty() {
  return { joins: 0, leaves: 0 };
}

function bump(date, field) {
  const counts = (state.days[date] ??= empty());
  counts[field] = (counts[field] ?? 0) + 1;
  saveState();
}

function recordJoin(member) {
  if (!member?.user || member.user.bot) return false;
  bump(cal.dateKey(new Date()), "joins");
  return true;
}

function recordLeave(member) {
  if (!member?.user || member.user.bot) return false;
  bump(cal.dateKey(new Date()), "leaves");
  return true;
}

function day(date) {
  const counts = state.days[date] ?? {};
  return { joins: counts.joins ?? 0, leaves: counts.leaves ?? 0 };
}

function range(start, end) {
  const totals = empty();
  for (const date of cal.daysBetween(start, end)) {
    const counts = state.days[date];
    if (!counts) continue;
    totals.joins += counts.joins ?? 0;
    totals.leaves += counts.leaves ?? 0;
  }
  return totals;
}

function weekStart(today) {
  const sunday = cal.weekEndingSunday(today);
  return cal.weekRange(sunday).start;
}

function summary(now = new Date()) {
  const today = cal.dateKey(now);
  return {
    today: day(today),
    week: range(weekStart(today), today),
    month: range(`${today.slice(0, 7)}-01`, today)
  };
}

function start(client) {
  client.on("guildMemberAdd", (member) => {
    if (recordJoin(member)) {
      console.log(`${TAG} ➕ ${member.user.tag} entró al servidor`);
    }
  });

  client.on("guildMemberRemove", (member) => {
    if (recordLeave(member)) {
      console.log(`${TAG} ➖ ${member.user.tag} salió del servidor`);
    }
  });

  console.log(`${TAG} ✅ seguimiento de entradas y salidas activo`);
}

module.exports = { recordJoin, recordLeave, day, range, summary, start };
