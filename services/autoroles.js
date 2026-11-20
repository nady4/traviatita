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

const TRACKED_ROLE_IDS = new Set(
  GROUPS.flatMap((group) => group.roles.map((role) => role.id))
);

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

function roleCount(guild, roleId) {
  return guild?.roles.cache.get(roleId)?.members.size ?? 0;
}

function messagePayload(group, guild) {
  const embed = new EmbedBuilder()
    .setColor(group.color)
    .setTitle(group.title)
    .setDescription(
      group.roles
        .map(
          (role) =>
            `${role.emoji} - <@&${role.id}> (**${roleCount(guild, role.id)}**)`
        )
        .join("\n")
    )
    .setFooter({
      text: "Reaccioná con un emoji para recibir o quitar el rol."
    });

  return { embeds: [embed], allowedMentions: { parse: [] } };
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesRoleLine(description, role) {
  const prefix = `${normalizeText(role.emoji)} - `;
  const name = normalizeText(role.name);
  const mention = `<@&${role.id}>`;

  return String(description ?? "")
    .split("\n")
    .map(normalizeText)
    .some(
      (line) =>
        line.startsWith(prefix) &&
        (line.includes(mention) || line.includes(name))
    );
}

function matchesGroup(message, group) {
  return (message.embeds ?? []).some(
    (embed) =>
      normalizeText(embed.title) === normalizeText(group.title) &&
      group.roles.every((role) => matchesRoleLine(embed.description, role))
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

async function ensureMemberCache(guild) {
  if (!guild) return;
  if (guild.members.cache.size >= guild.memberCount) return;
  await guild.members.fetch();
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
    message = await channel.send(messagePayload(group, channel.guild));
    rememberMessageId(group, message.id);
    console.log(`${TAG} ✅ "${group.title}" publicado en <#${channel.id}>`);
  } else {
    await message.edit(messagePayload(group, channel.guild)).catch((err) => {
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

  await ensureMemberCache(channel.guild).catch((err) => {
    console.error(
      `${TAG} ⚠️ no pude cargar los miembros para los contadores:`,
      err.message
    );
  });

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

  for (const group of GROUPS) {
    try {
      await ensureMessage(client, channel, group);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude preparar "${group.title}":`,
        err.message
      );
    }
  }

  console.log(
    `${TAG} ✅ mensajes de autoasignación listos en <#${config.channels.roles}>`
  );
});

function changedRoleIds(oldMember, newMember) {
  const ids = new Set();

  for (const id of oldMember.roles.cache.keys()) {
    if (!newMember.roles.cache.has(id)) ids.add(id);
  }

  for (const id of newMember.roles.cache.keys()) {
    if (!oldMember.roles.cache.has(id)) ids.add(id);
  }

  return ids;
}

async function refreshRoleCounts(client, roleIds) {
  const channel = await getTextChannel(client, config.channels.roles);
  const groups = GROUPS.filter((group) =>
    group.roles.some((role) => roleIds.has(role.id))
  );

  if (groups.length === 0) return;

  for (const group of groups) {
    try {
      const storedId = storedMessageId(group);

      if (!storedId) {
        await ensureMessage(client, channel, group);
        continue;
      }

      const message = await channel.messages.fetch(storedId);

      if (message.author.id !== client.user.id) {
        forgetMessageId(group);
        await ensureMessage(client, channel, group);
        continue;
      }

      await message.edit(messagePayload(group, channel.guild));
    } catch (err) {
      if (err.code === 10008) {
        forgetMessageId(group);
        await ensureMessage(client, channel, group).catch((error) => {
          console.error(
            `${TAG} ⚠️ no pude reponer "${group.title}" al actualizar contadores:`,
            error.message
          );
        });
        continue;
      }

      console.error(
        `${TAG} ⚠️ no pude actualizar contadores de "${group.title}":`,
        err.message
      );
    }
  }

  console.log(
    `${TAG} 🔢 contadores actualizados en ${groups.length} mensaje(s)`
  );
}

const pendingRoleIds = new Set();
let refreshTimer = null;
let refreshQueue = Promise.resolve();
let countsReady = false;

function scheduleCountRefresh(client, roleIds) {
  if (!countsReady) return;

  let relevant = false;

  for (const id of roleIds) {
    if (!TRACKED_ROLE_IDS.has(id)) continue;
    pendingRoleIds.add(id);
    relevant = true;
  }

  if (!relevant || refreshTimer) return;

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    const ids = new Set(pendingRoleIds);
    pendingRoleIds.clear();

    refreshQueue = refreshQueue
      .then(() => refreshRoleCounts(client, ids))
      .catch((err) => {
        console.error(`${TAG} ⚠️ error al actualizar contadores:`, err.message);
      });
  }, 750);
}

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

  client.on("guildMemberUpdate", (oldMember, newMember) => {
    scheduleCountRefresh(client, changedRoleIds(oldMember, newMember));
  });

  client.on("guildMemberAdd", (member) => {
    scheduleCountRefresh(client, member.roles.cache.keys());
  });

  client.on("guildMemberRemove", (member) => {
    scheduleCountRefresh(client, member.roles.cache.keys());
  });

  client.on("messageDelete", (message) => {
    const group = GROUPS.find((item) => storedMessageId(item) === message.id);
    if (!group) return;

    forgetMessageId(group);

    ensureAll(client).catch((err) => {
      console.error(`${TAG} ⚠️ no pude reponer "${group.title}":`, err.message);
    });
  });

  ensureAll(client)
    .finally(() => {
      countsReady = true;
    })
    .catch((err) => {
      console.error(`${TAG} ⚠️ no pude preparar los mensajes:`, err.message);
    });

  console.log(`${TAG} 💾 IDs de mensajes en ${ID_STORE.FILE}`);
  console.log(`${TAG} ✅ autoasignación de roles por reacción activa`);
}

module.exports = { start, ensureAll, GROUPS };
