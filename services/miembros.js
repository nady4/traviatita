const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const cal = require("../utils/calendario");
const store = require("../lib/store");
const config = require("../config");
const { sendToChannel } = require("../utils/discord");

const TAG = "🚪 [miembros]";
const STORE = store.create("miembros.json", TAG);
const AVATAR_SIZE = 256;
const AVATAR_RING = "#ff8ad8";

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

async function circularAvatar(user) {
  const url = user.displayAvatarURL({
    extension: "png",
    size: AVATAR_SIZE,
    forceStatic: true
  });
  const image = await loadImage(url);
  const canvas = createCanvas(AVATAR_SIZE, AVATAR_SIZE);
  const ctx = canvas.getContext("2d");
  const center = AVATAR_SIZE / 2;
  const radius = center - 6;

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = AVATAR_RING;
  ctx.stroke();

  return canvas.encode("png");
}

async function announceJoin(client, member) {
  const buffer = await circularAvatar(member.user);
  const file = new AttachmentBuilder(buffer, { name: "bienvenida.png" });
  const embed = new EmbedBuilder()
    .setColor(0xff8ad8)
    .setImage("attachment://bienvenida.png");
  const name =
    member.displayName || member.user.displayName || member.user.username;

  await sendToChannel(client, config.channels.general, {
    content:
      `DENLE LA BIENVENIDA A ${member.user.toString()} (${name})!!!!\n` +
      `Mirá las <#${config.channels.reglas}>, ponete <#${config.channels.roles}> y portate bien >w<`,
    embeds: [embed],
    files: [file],
    allowedMentions: { parse: [] }
  });
}

function start(client) {
  client.on("guildMemberAdd", async (member) => {
    if (recordJoin(member)) {
      console.log(`${TAG} ➕ ${member.user.tag} entró al servidor`);
    }

    if (!member?.user || member.user.bot) return;

    try {
      await announceJoin(client, member);
    } catch (err) {
      console.error(`${TAG} ⚠️ no pude anunciar la entrada:`, err.message);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    if (recordLeave(member)) {
      console.log(`${TAG} ➖ ${member.user.tag} salió del servidor`);
    }

    if (!member?.user || member.user.bot) return;

    const name =
      member.displayName || member.user.displayName || member.user.username;
    try {
      await sendToChannel(client, config.channels.general, {
        content: `${member.user.toString()} (${name}) se fue del server u.u`,
        allowedMentions: { parse: [] }
      });
    } catch (err) {
      console.error(`${TAG} ⚠️ no pude anunciar la salida:`, err.message);
    }
  });

  console.log(`${TAG} ✅ seguimiento de entradas y salidas activo`);
}

module.exports = { recordJoin, recordLeave, day, range, summary, start };
