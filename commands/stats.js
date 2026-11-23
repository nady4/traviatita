const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { roles } = require("../config");
const quilombo = require("../services/quilombo");
const miembros = require("../services/miembros");
const otokonoko = require("../services/otokonoko");
const astrovials = require("../services/astrovials");
const { timestamp } = require("../utils/discord");
const { defineCommand } = require("../utils/command");

const TAG = "📊 [stats]";
const CACHE_MS = 60_000;
const SECTION_GAP = "\n\u200b";

const memberCache = new Map();
const numberFmt = new Intl.NumberFormat("es-AR");

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
    verificado100kg: 0,
    preso: [],
    cuck: [],
    otokonoko: 0,
    astrovials: 0,
    admin200kg: [],
    admin150kg: []
  };

  for (const member of members.values()) {
    if (member.user.bot) {
      data.bots++;
      continue;
    }
    data.humans++;

    if (member.roles.cache.has(roles.traviatense)) data.traviatense++;
    if (member.roles.cache.has(roles.verificado100kg)) data.verificado100kg++;
    if (member.roles.cache.has(roles.preso)) data.preso.push(member.id);
    if (member.roles.cache.has(roles.cuck)) data.cuck.push(member.id);
    if (member.roles.cache.has(roles.otokonoko)) data.otokonoko++;
    if (member.roles.cache.has(roles.astrovials)) data.astrovials++;
    if (member.roles.cache.has(roles.admin200kg))
      data.admin200kg.push(member.id);
    if (member.roles.cache.has(roles.admin150kg))
      data.admin150kg.push(member.id);
  }

  memberCache.set(guild.id, { at: Date.now(), data });
  return data;
}

function fmtBalance(joins, leaves) {
  const balance = joins - leaves;
  return `${balance > 0 ? "+" : ""}${numberFmt.format(balance)}`;
}

function mentionList(ids) {
  if (ids.length === 0) return "nadie";
  const shown = ids.slice(0, 20).map((id) => `<@${id}>`);
  if (ids.length > 20) shown.push(`y ${ids.length - 20} más`);
  return shown.join(", ");
}

function movementLine(label, counts) {
  return (
    `${label}: **${numberFmt.format(counts.joins)}** entraron · ` +
    `**${numberFmt.format(counts.leaves)}** salieron · ` +
    `balance **${fmtBalance(counts.joins, counts.leaves)}**`
  );
}

function stockLine(label, snapshot, products) {
  const inStock = products.filter(
    (product) => snapshot.products?.[product.slug]?.inStock
  ).length;
  const check = snapshot.lastCheck ? timestamp(snapshot.lastCheck) : "nunca";
  return `${label}: **${inStock}/${products.length}** en stock · chequeo ${check}`;
}

function streakLine(streak) {
  const ts = streak ? Date.parse(streak.ts) : NaN;
  if (!Number.isFinite(ts)) return "sin datos";
  const unix = Math.floor(ts / 1000);
  return `<t:${unix}:R> (desde <t:${unix}:f>)`;
}

function buildEmbed(guild, stats) {
  const streak = quilombo.get(guild.id);
  const movement = miembros.summary();
  const owner = guild.ownerId;

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📊 Operación Traviata - Estado del servidor")
    .addFields(
      {
        name: "👥 Comunidad",
        value:
          `Miembros: **${numberFmt.format(stats.total)}**\n` +
          `Humanos: **${numberFmt.format(stats.humans)}** · Bots: **${numberFmt.format(stats.bots)}**\n`
      },
      {
        name: "\u200b",
        value: `💥 Racha sin quilombos: **${streakLine(streak)}**${SECTION_GAP}`
      },
      {
        name: "🏷️ Roles",
        value:
          `👑 Owner: <@${owner}>\n` +
          `🛡️ 200kg (**${numberFmt.format(stats.admin200kg.length)}**): ${mentionList(stats.admin200kg)}\n` +
          `🔑 150kg (**${numberFmt.format(stats.admin150kg.length)}**): ${mentionList(stats.admin150kg)}` +
          `✅ 100kg: **${numberFmt.format(stats.verificado100kg)}**\n` +
          `🏳️‍⚧️ Traviatenses: **${numberFmt.format(stats.traviatense)}**\n` +
          `🔒 Presos (**${numberFmt.format(stats.preso.length)}**): ${mentionList(stats.preso)}\n` +
          `🐂 Cucks (**${numberFmt.format(stats.cuck.length)}**): ${mentionList(stats.cuck)}${SECTION_GAP}`
      },
      {
        name: "🚪 Movimiento de miembros",
        value:
          [
            movementLine("Hoy", movement.today),
            movementLine("Esta semana", movement.week),
            movementLine("Este mes", movement.month)
          ].join("\n") + SECTION_GAP
      },
      {
        name: "📦 Stock de estrógeno",
        value:
          `${stockLine("💊 Otokonoko", otokonoko.getProductState(), otokonoko.PRODUCTS)}\n` +
          `${stockLine("🚀 Astrovials", astrovials.getProductState(), astrovials.PRODUCTS)}`
      }
    )
    .setTimestamp();
}

module.exports = defineCommand({
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("📊 Estadísticas y estado del servidor"),

  guildOnly: true,

  async run(interaction) {
    await interaction.deferReply();
    try {
      const stats = await memberStats(interaction.guild);
      await interaction.editReply({
        embeds: [buildEmbed(interaction.guild, stats)]
      });
    } catch (err) {
      console.error(`${TAG} ⚠️ ${err.message}`);
      await interaction.editReply("❌ No pude calcular las estadísticas.");
    }
  }
});
