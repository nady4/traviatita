const { stockSummaryTz } = require('./config');

const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: stockSummaryTz,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const CLOCK_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: stockSummaryTz,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(date = new Date()) {
  const parts = Object.fromEntries(DAY_FMT.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function utcKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(key, n) {
  const { y, m, d } = parseDay(key);
  return utcKey(new Date(Date.UTC(y, m - 1, d + n)));
}

function weekday(key) {
  const { y, m, d } = parseDay(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysBetween(start, end) {
  const days = [];
  for (let key = start; key <= end; key = addDays(key, 1)) days.push(key);
  return days;
}

function lastCompletedSunday(todayKey = dateKey()) {
  const day = weekday(todayKey);
  return addDays(todayKey, day === 0 ? -7 : -day);
}

function weekEndingSunday(key = dateKey()) {
  return addDays(key, (7 - weekday(key)) % 7);
}

function weekRange(sundayKey) {
  return { start: addDays(sundayKey, -6), end: sundayKey };
}

function previousMonthKey(todayKey = dateKey()) {
  const { y, m } = parseDay(todayKey);
  const date = new Date(Date.UTC(y, m - 2, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${pad(last)}` };
}

function msUntilNextMidnight(now = new Date()) {
  const parts = Object.fromEntries(CLOCK_FMT.formatToParts(now).map((p) => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  const m = Number(parts.minute);
  const s = Number(parts.second);
  const elapsed = ((h * 60 + m) * 60 + s) * 1000 + now.getMilliseconds();
  return 86_400_000 - elapsed;
}

function fmtDate(key) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function fmtShortDate(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

function fmtWeekRange(start, end) {
  const [sy] = start.split('-');
  const [ey] = end.split('-');
  return sy === ey
    ? `${fmtShortDate(start)} al ${fmtDate(end)}`
    : `${fmtDate(start)} al ${fmtDate(end)}`;
}

function fmtMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

function fmtAge(ms) {
  if (!Number.isFinite(ms)) return 'tiempo desconocido';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

module.exports = {
  timeZone: stockSummaryTz,
  dateKey,
  addDays,
  weekday,
  daysBetween,
  lastCompletedSunday,
  weekEndingSunday,
  weekRange,
  previousMonthKey,
  monthRange,
  msUntilNextMidnight,
  fmtDate,
  fmtShortDate,
  fmtWeekRange,
  fmtMonth,
  fmtAge,
};
