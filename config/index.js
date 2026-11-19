require("dotenv").config({ quiet: true });

const ids = require("./ids.json");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env`);
  return value;
}

function snowflake(name) {
  const value = required(name);
  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} debe ser un ID de Discord válido`);
  }
  return value;
}

function optionalSnowflake(name) {
  if (!process.env[name]) return undefined;
  return snowflake(name);
}

function positiveInt(name) {
  const value = Number.parseInt(required(name), 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} debe ser un entero mayor a 0`);
  }
  return value;
}

function timeZone(name, fallback) {
  const value = process.env[name] || fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
  } catch {
    throw new Error(`${name} debe ser una zona horaria IANA válida`);
  }
  return value;
}

module.exports = {
  token: required("TOKEN"),
  guildId: optionalSnowflake("GUILD_ID"),
  roles: ids.roles,
  channels: ids.channels,
  tweetUserId: snowflake("TWEET_USER_ID"),
  roleGroups: ids.roleGroups,
  tweetCheckMinutes: positiveInt("TWEET_CHECK_MINUTES"),
  stockCheckMinutes: positiveInt("STOCK_CHECK_MINUTES"),
  stockSummaryTz: timeZone("STOCK_SUMMARY_TZ", "America/Argentina/Buenos_Aires"),
  stateDir: process.env.STATE_DIR || undefined
};
