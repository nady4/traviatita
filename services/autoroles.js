const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const store = require("../lib/store");
const { singleFlight } = require("../utils/async");
const { getTextChannel } = require("../utils/discord");

const TAG = "🎭 [autoroles]";

const UNICODE_EMOJI = {
  microphone2: "🎙️",
  video_game: "🎮",
  leaves: "🍃",
  speaking_head: "🗣️",
  bell: "🔔",
  handshake: "🤝",
  light_blue_heart: "🩵",
  pink_heart: "🩷",
  purple_heart: "💜",
  green_heart: "💚",
  yellow_heart: "💛",
  heart: "❤️",
  biohazard: "☣️",
  radioactive: "☢️",
  mobile_phone_off: "📴",
  black_heart: "🖤"
};

function unicodeEmoji(shortcode) {
  const name = shortcode.slice(1, -1);
  const code = name.startsWith("flag_") ? name.slice(5) : "";

  if (/^[a-z]{2}$/.test(code)) {
    return [...code.toUpperCase()]
      .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
      .join("");
  }

  const emoji = UNICODE_EMOJI[name];
  if (!emoji) throw new Error(`emoji sin equivalencia: ${shortcode}`);
  return emoji;
}

const GROUPS = config.roleGroups.map((group) => ({
  ...group,
  roles: group.roles.map((role) => ({
    ...role,
    emoji: unicodeEmoji(role.emoji)
  }))
}));

const ID_STORE = store.create("autoroles.json", TAG, { dir: store.repoDataDir() });
let savedIds = ID_STORE.load({});
if (!savedIds || typeof savedIds !== "object" || Array.isArray(savedIds)) {
  savedIds = {};
}

let storeWritable = true;

function validId(value) {
  return /^\d{17,20}$/.test(value ?? "");
}

function saveIds() {
  if (!storeWritable) return;

  try {
    ID_STORE.save(savedIds);
  } catch (err) {
    storeWritable = false;
    console.error(
      `${TAG} ⚠️ no pude guardar IDs en ${ID_STORE.FILE}; sigo con los de memoria:`,
      err.message
    );
  }
}

function storedMessageId(group) {
  const saved = savedIds[group.id];
  return validId(saved) ? saved : null;
}

function rememberMessageId(group, messageId) {
  savedIds[group.id] = messageId;
  saveIds();
}

function forgetMessageId(group) {
  delete savedIds[group.id];
  saveIds();
}

function messagePayload(group) {
  const embed = new EmbedBuilder()
    .setColor(group.color)
    .setTitle(group.title)
    .setDescription(
      group.roles.map((role) => `${role.emoji} - ${role.name}`).join("\n")
    )
    .setFooter({
      text: "Reaccioná con un emoji para recibir o quitar el rol."
    });

  return { embeds: [embed] };
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function groupSignature(group) {
  return normalizeText(
    group.roles.map((role) => `${role.emoji} - ${role.name}`).join("\n")
  );
}

function matchesGroup(message, group) {
  const signature = groupSignature(group);

  return (message.embeds ?? []).some(
    (embed) =>
      normalizeText(embed.title) === normalizeText(group.title) &&
      normalizeText(embed.description) === signature
  );
}

async function findExistingMessages(client, channel) {
  const found = new Map();
  let before;

  for (let page = 0; page < 5 && found.size < GROUPS.length; page += 1) {
    let batch;

    try {
      const options = { limit: 100 };
      if (before) options.before = before;
      batch = await channel.messages.fetch(options);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude buscar los mensajes existentes:`,
        err.message
      );
      break;
    }

    if (batch.size === 0) break;

    for (const message of batch.values()) {
      if (message.author?.id !== client.user.id) continue;

      for (const group of GROUPS) {
        if (found.has(group.id)) continue;
        if (matchesGroup(message, group)) found.set(group.id, message);
      }
    }

    if (batch.size < 100) break;
    before = batch.last()?.id;
  }

  return found;
}

function bySnowflake(a, b) {
  const left = BigInt(a.id);
  const right = BigInt(b.id);
  return left < right ? -1 : left > right ? 1 : 0;
}

async function enforceOrder(client, channel, messages) {
  const ordered = messages.filter(Boolean).sort(bySnowflake);
  if (ordered.length !== GROUPS.length) return;

  const entries = GROUPS.map((group) => ({
    group,
    id: storedMessageId(group)
  }));
  const ids = ordered.map((message) => message.id);

  let keep = 0;
  let lastIndex = -1;

  for (const { id } of entries) {
    const index = ids.indexOf(id);
    if (index <= lastIndex) break;
    lastIndex = index;
    keep += 1;
  }

  if (keep === entries.length) return;

  const toRepost = entries.slice(keep);
  const idsToDelete = new Set(toRepost.map((entry) => entry.id));
  const deleted = new Set();

  console.log(
    `${TAG} 🔄 reordenando ${toRepost.length} mensaje(s) para dejar los países arriba`
  );

  for (const message of ordered) {
    if (!idsToDelete.has(message.id)) continue;

    try {
      await message.delete();
      deleted.add(message.id);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude borrar ${message.id} para reordenar:`,
        err.message
      );
    }
  }

  for (const { group, id } of toRepost) {
    if (!deleted.has(id)) continue;

    forgetMessageId(group);

    try {
      await ensureMessage(client, channel, group);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude repostear "${group.title}":`,
        err.message
      );
    }
  }
}

async function ensureMessage(client, channel, group) {
  const storedId = storedMessageId(group);
  let message = null;

  if (storedId) {
    try {
      message = await channel.messages.fetch(storedId);
      if (message.author.id !== client.user.id) message = null;
    } catch (err) {
      if (err.code !== 10008) {
        throw new Error(`no pude revisar el mensaje: ${err.message}`);
      }
    }
  }

  if (!message) {
    message = await channel.send(messagePayload(group));
    rememberMessageId(group, message.id);
    console.log(`${TAG} ✅ "${group.title}" publicado en <#${channel.id}>`);
  } else {
    await message.edit(messagePayload(group)).catch((err) => {
      console.error(`${TAG} ⚠️ no pude actualizar "${group.title}":`, err.message);
    });
  }

  for (const role of group.roles) {
    await message.react(role.emoji).catch((err) => {
      console.error(
        `${TAG} ⚠️ no pude reaccionar con ${role.emoji} en "${group.title}":`,
        err.message
      );
    });
  }

  return message;
}

const ensureAll = singleFlight(async (client) => {
  const channel = await getTextChannel(client, config.channels.roles);
  const missing = GROUPS.some((group) => !storedMessageId(group));
  const existing = missing
    ? await findExistingMessages(client, channel)
    : new Map();

  let adopted = 0;

  for (const group of GROUPS) {
    if (storedMessageId(group)) continue;

    const found = existing.get(group.id);
    if (!found) continue;

    rememberMessageId(group, found.id);
    adopted += 1;
  }

  if (adopted > 0) {
    console.log(`${TAG} 🔗 ${adopted} mensaje(s) existente(s) reutilizados`);
  }

  const messages = [];

  for (const group of GROUPS) {
    try {
      messages.push(await ensureMessage(client, channel, group));
    } catch (err) {
      messages.push(null);
      console.error(
        `${TAG} ⚠️ no pude preparar "${group.title}":`,
        err.message
      );
    }
  }

  try {
    await enforceOrder(client, channel, messages);
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude reordenar los mensajes:`, err.message);
  }

  console.log(
    `${TAG} ✅ mensajes de autoasignación listos en <#${config.channels.roles}>`
  );
});

function emojiKey(emoji) {
  return String(emoji ?? "").replace(/\uFE0F/g, "");
}

async function resolveReaction(reaction) {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return null;
    }
  }

  const { message } = reaction;
  if (!message.guild || message.channelId !== config.channels.roles) return null;

  const group = GROUPS.find((item) => storedMessageId(item) === message.id);
  if (!group) return null;

  const key = emojiKey(reaction.emoji.name);
  const role = group.roles.find((item) => emojiKey(item.emoji) === key);
  if (!role) return null;

  return { group, role, message };
}

async function applyReaction(reaction, user, add) {
  if (user.bot) return;

  const resolved = await resolveReaction(reaction);
  if (!resolved) return;

  const { group, role, message } = resolved;
  const member = await message.guild.members.fetch(user.id).catch((err) => {
    console.error(`${TAG} ⚠️ no pude obtener a ${user.tag}:`, err.message);
    return null;
  });

  if (!member) return;

  const reason = `Autoasignación por reacción (${group.title})`;

  try {
    if (!add) {
      if (!member.roles.cache.has(role.id)) return;
      await member.roles.remove(role.id, reason);
      console.log(`${TAG} ➖ ${user.tag} perdió "${role.name}"`);
      return;
    }

    if (group.single) {
      const others = group.roles
        .filter((item) => item.id !== role.id && member.roles.cache.has(item.id))
        .map((item) => item.id);

      if (others.length > 0) {
        await member.roles.remove(others, reason);
      }
    }

    if (member.roles.cache.has(role.id)) return;

    await member.roles.add(role.id, reason);
    console.log(`${TAG} ➕ ${user.tag} recibió "${role.name}"`);
  } catch (err) {
    console.error(
      `${TAG} ⚠️ no pude ${add ? "asignar" : "quitar"} "${role.name}" a ${user.tag}:`,
      err.message
    );
  }
}

function start(client) {
  client.on("messageReactionAdd", (reaction, user) => {
    applyReaction(reaction, user, true).catch((err) => {
      console.error(`${TAG} ⚠️ error al asignar:`, err.message);
    });
  });

  client.on("messageReactionRemove", (reaction, user) => {
    applyReaction(reaction, user, false).catch((err) => {
      console.error(`${TAG} ⚠️ error al quitar:`, err.message);
    });
  });

  client.on("messageDelete", (message) => {
    const group = GROUPS.find((item) => storedMessageId(item) === message.id);
    if (!group) return;

    forgetMessageId(group);

    ensureAll(client).catch((err) => {
      console.error(`${TAG} ⚠️ no pude reponer "${group.title}":`, err.message);
    });
  });

  ensureAll(client).catch((err) => {
    console.error(`${TAG} ⚠️ no pude preparar los mensajes:`, err.message);
  });

  console.log(`${TAG} 💾 IDs de mensajes en ${ID_STORE.FILE}`);
  console.log(`${TAG} ✅ autoasignación de roles por reacción activa`);
}

module.exports = { start, ensureAll, GROUPS };
