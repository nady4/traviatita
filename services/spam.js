const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { sendToChannel } = require("../utils/discord");
const { every } = require("../utils/time");

const TAG = "🚫 [spam]";

const SPAM_THRESHOLD = 3;
const SPAM_TIME_WINDOW = 30_000;
const MAX_ENTRIES_PER_KEY = 50;
const CLEANUP_MS = 5 * 60 * 1000;
const CONTENT_LIMIT = 900;

const CHANNEL_STAFF = config.channels.staff;
const ROLE_PRESO = config.roles.preso;
const ROLES_TO_REMOVE = [config.roles.traviatense, config.roles.verificado100kg];

const recent = new Map();

function spamKey(message) {
  const content = (message.content ?? "").trim();
  const attachments = [...message.attachments.values()]
    .map((attachment) => attachment.url)
    .sort();

  if (!content && attachments.length === 0) return null;

  return `${message.author.id}\n${content}\n${attachments.join(" ")}`;
}

function prune(entries, now = Date.now()) {
  return entries.filter((entry) => now - entry.at < SPAM_TIME_WINDOW);
}

function cut(text, max = CONTENT_LIMIT) {
  const value = String(text ?? "");
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function preview(content) {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return "(sin texto)";
  return cut(trimmed).replaceAll("```", "'''");
}

async function deleteMessages(entries) {
  let deleted = 0;

  for (const entry of entries) {
    if (entry.deleted) continue;

    try {
      await entry.message.delete();
      entry.deleted = true;
      deleted++;
    } catch (err) {
      entry.deleted = true;
      if (err.code !== 10008) {
        console.error(
          `${TAG} ⚠️ no pude borrar ${entry.message.id}: ${err.message}`
        );
      }
    }
  }

  return deleted;
}

async function jailMember(message, reason) {
  const guild = message.guild;
  if (!guild) return false;

  const member = await guild.members
    .fetch(message.author.id)
    .catch(() => null);

  if (!member || member.user.bot) return false;
  if (member.id === guild.ownerId) return false;

  const me =
    guild.members.me ??
    (await guild.members.fetch(message.client.user.id).catch(() => null));

  if (!me || member.roles.highest.position >= me.roles.highest.position) {
    return false;
  }

  try {
    const remove = ROLES_TO_REMOVE.filter((id) => member.roles.cache.has(id));
    if (remove.length) await member.roles.remove(remove, reason);
    if (!member.roles.cache.has(ROLE_PRESO)) {
      await member.roles.add(ROLE_PRESO, reason);
    }

    return member.roles.cache.has(ROLE_PRESO);
  } catch (err) {
    console.error(
      `${TAG} ⚠️ no pude enjaular a ${member.user.tag}: ${err.message}`
    );
    return false;
  }
}

function spamEmbed(message, entries, deleted, jailed) {
  const channels = [...new Set(entries.map((entry) => entry.channelId))];
  const channelList = channels
    .slice(0, 10)
    .map((id) => `<#${id}>`)
    .join(", ");

  return new EmbedBuilder()
    .setTitle("🚫 Spam detectado")
    .setColor(0xff4444)
    .setDescription(
      `<@${message.author.id}> envió ${entries.length} mensajes repetidos ` +
        `en menos de ${SPAM_TIME_WINDOW / 1000} segundos.`
    )
    .addFields(
      {
        name: "Usuario",
        value: `<@${message.author.id}> (${message.author.tag})`
      },
      { name: "Mensajes detectados", value: String(entries.length), inline: true },
      { name: "Eliminados", value: String(deleted), inline: true },
      { name: "Enjaulado", value: jailed ? "✅ Sí" : "❌ No", inline: true },
      {
        name: "Canales",
        value: channelList +
          (channels.length > 10 ? ` y ${channels.length - 10} más` : "")
      },
      { name: "Contenido", value: `\`\`\`${preview(message.content)}\`\`\`` }
    )
    .setTimestamp();
}

async function punish(message, entries) {
  const reason = `Anti-spam: ${entries.length} mensajes repetidos en ${
    SPAM_TIME_WINDOW / 1000
  }s`;

  const deleted = await deleteMessages(entries);
  const jailed = await jailMember(message, reason);

  try {
    await sendToChannel(message.client, CHANNEL_STAFF, {
      embeds: [spamEmbed(message, entries, deleted, jailed)],
      allowedMentions: { parse: [] }
    });
  } catch (err) {
    console.error(
      `${TAG} ⚠️ no pude avisar en <#${CHANNEL_STAFF}>: ${err.message}`
    );
  }

  console.log(
    `${TAG} ${message.author.tag}: ${entries.length} mensajes, ` +
      `${deleted} eliminados${jailed ? ", enjaulade" : ""}`
  );
}

async function onMessage(message) {
  if (!message?.guildId || message.author?.bot || message.system) return;

  const key = spamKey(message);
  if (!key) return;

  const list = prune(recent.get(key) ?? []);
  list.push({
    at: Date.now(),
    channelId: message.channelId,
    message,
    deleted: false,
    notified: false
  });

  while (list.length > MAX_ENTRIES_PER_KEY) list.shift();
  recent.set(key, list);

  if (list.length < SPAM_THRESHOLD) return;
  if (list.some((entry) => entry.notified)) return;

  for (const entry of list) entry.notified = true;

  await punish(message, list);
}

function cleanup() {
  const now = Date.now();

  for (const [key, entries] of recent) {
    const alive = prune(entries, now);
    if (alive.length === 0) recent.delete(key);
    else recent.set(key, alive);
  }
}

function start(client) {
  client.on("messageCreate", (message) => {
    onMessage(message).catch((err) => {
      console.error(`${TAG} ⚠️ error al analizar mensaje:`, err.message);
    });
  });

  every(CLEANUP_MS, cleanup, { label: TAG }).unref?.();

  console.log(`${TAG} ✅ anti-spam activo (avisa en <#${CHANNEL_STAFF}>)`);
}

module.exports = { start, onMessage, SPAM_THRESHOLD, SPAM_TIME_WINDOW };
