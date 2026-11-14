const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");
const { roles } = require("../config");
const { create } = require("../store");
const quilombo = require("../quilombo");
const miembros = require("../miembros");
const { PRODUCTS: OTOKONOKO_PRODUCTS } = require("../otokonoko");
const { PRODUCTS: ASTROVIALS_PRODUCTS } = require("../astrovials");
const { timestamp } = require("../utils/discord");

const TAG = "📊 [stats]";
const CACHE_MS = 60_000;

const STOCK = create("stock.json", TAG);
const ASTRO = create("astro.json", TAG);
const TWEETS = create("tweets.json", TAG);

const memberCache = new Map();
const numberFmt = new Intl.NumberFormat("es-AR");

function fmtDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

async function memberStats(guild) {
  const cached = memberCache.get(guild.id);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }

  const members = await guild.members.fetch();
  const data = {
    total: members.size,
    humans: 0,
    bots: 0,
    traviatense: 0,
    verificade: 0,
    preso: 0,
    cuck: 0,
    otokonoko: 0,
    astrovials: 0
  };

  for (const member of members.values()) {
    if (member.user.bot) {
      data.bots++;
      continue;
    }
    data.humans++;

    if (member.roles.cache.has(roles.traviatense)) data.traviatense++;
    if (member.roles.cache.has(roles.verificade)) data.verificade++;
    if (member.roles.cache.has(roles.preso)) data.preso++;
    if (member.roles.cache.has(roles.cuck)) data.cuck++;
    if (member.roles.cache.has(roles.otokonoko)) data.otokonoko++;
    if (member.roles.cache.has(roles.astrovials)) data.astrovials++;
  }

  memberCache.set(guild.id, { at: Date.now(), data });
  return data;
}

function fmtBalance(joins, leaves) {
  const balance = joins - leaves;
  return `${balance > 0 ? "+" : ""}${numberFmt.format(balance)}`;
}

function movementLine(label, counts) {
  return (
    `${label}: **${numberFmt.format(counts.joins)}** entraron · ` +
    `**${numberFmt.format(counts.leaves)}** salieron · ` +
    `balance **${fmtBalance(counts.joins, counts.leaves)}**`
  );
}

function stockLine(label, store, products) {
  const raw = store.load({});
  const inStock = products.filter(
    (product) => raw.products?.[product.slug]?.inStock
  ).length;
  const check = raw.lastCheck ? timestamp(raw.lastCheck) : "nunca";
  return `${label}: **${inStock}/${products.length}** en stock · chequeo ${check}`;
}

function buildEmbed(guild, stats, client) {
  const pendingTweets = (TWEETS.load({}).pending ?? []).length;
  const streak = quilombo.get(guild.id);
  const movement = miembros.summary();
  const unverified = Math.max(0, stats.humans - stats.verificade);
  const ping = Math.round(client.ws.ping);

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📊 Operación Traviata - Estado del servidor")
    .addFields(
      {
        name: "👥 Comunidad",
        value:
          `Miembros: **${numberFmt.format(stats.total)}**\n` +
          `Humanes: **${numberFmt.format(stats.humans)}** · Bots: **${numberFmt.format(stats.bots)}**`
      },
      {
        name: "🏷️ Roles",
        value:
          `🏳️‍⚧️ Traviatenses: **${numberFmt.format(stats.traviatense)}**\n` +
          `✅ Verificades: **${numberFmt.format(stats.verificade)}**\n` +
          `🙈 Sin verificar: **${numberFmt.format(unverified)}**\n` +
          `🔒 Presos: **${numberFmt.format(stats.preso)}**\n` +
          `🐂 Cucks: **${numberFmt.format(stats.cuck)}**\n` +
          `💊 Suscriptes Otokonoko: **${numberFmt.format(stats.otokonoko)}**\n` +
          `🚀 Suscriptes Astrovials: **${numberFmt.format(stats.astrovials)}**`
      },
      {
        name: "🚪 Movimiento de miembros",
        value: [
          movementLine("Hoy", movement.today),
          movementLine("Esta semana", movement.week),
          movementLine("Este mes", movement.month)
        ].join("\n")
      },
      {
        name: "📡 Estado",
        value:
          `${stockLine("📦 Otokonoko", STOCK, OTOKONOKO_PRODUCTS)}\n` +
          `${stockLine("🚀 Astrovials", ASTRO, ASTROVIALS_PRODUCTS)}\n` +
          `💥 Racha sin quilombos: **${streak ? fmtDuration(Date.now() - Date.parse(streak.ts)) : "sin datos"}**\n` +
          `🐦 Tweets pendientes: **${pendingTweets}**\n` +
          `⏱️ Uptime: **${fmtDuration(client.uptime)}** · Ping: **${ping >= 0 ? `${ping} ms` : "desconocido"}**`
      }
    )
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("📊 Estadísticas y estado del servidor"),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "Este comando solo sirve dentro de un servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();
    try {
      const stats = await memberStats(interaction.guild);
      await interaction.editReply({
        embeds: [buildEmbed(interaction.guild, stats, interaction.client)]
      });
    } catch (err) {
      console.error(`${TAG} ⚠️ ${err.message}`);
      await interaction.editReply("❌ No pude calcular las estadísticas.");
    }
  }
};
