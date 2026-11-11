require("dotenv").config();

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

function positiveInt(name) {
  const value = Number.parseInt(required(name), 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} debe ser un entero mayor a 0`);
  }
  return value;
}

module.exports = {
  token: required("TOKEN"),
  roles: {
    traviatense: snowflake("ROLE_TRAVIATENSE_ID"),
    bot: snowflake("ROLE_BOT_ID"),
    admin200kg: snowflake("ROLE_200KG_ID")
  },
  channels: {
    quilombo: snowflake("CHANNEL_ANNOUNCE_QUILOMBO_ID"),
    stock: snowflake("CHANNEL_ANNOUNCE_STOCK_ID")
  },
  stockCheckMinutes: positiveInt("STOCK_CHECK_MINUTES"),
  stateDir: process.env.STATE_DIR || undefined
};
