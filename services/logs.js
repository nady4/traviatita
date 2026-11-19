const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { sendToChannel, timestamp } = require("../utils/discord");

const TAG = "📝 [logs]";
const LOG_CHANNEL = config.channels.logs;
const MAX_CACHE = 2000;
const MAX_ATTACHMENTS = 5;
const FIELD_LIMIT = 1024;

const recent = new Map();

function isVerificationTicket(message) {
  if (!message?.embeds) return false;

  return message.embeds.some((embed) =>
    String(embed.title ?? "").includes("Solicitud de verificación")
  );
}

function cut(text, max = FIELD_LIMIT) {
  const value = String(text ?? "");
  if (!value) return "(vacío)";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function userLabel(user, member) {
  const id = user?.id;
  if (!id) return "Desconocidx";

  const name = member?.displayName ?? user.displayName ?? user.username;
  return name ? `<@${id}> (${name})` : `<@${id}>`;
}

function channelLabel(channelId) {
  return channelId ? `<#${channelId}>` : "Desconocido";
}

function avatarUrl(user) {
  if (typeof user?.displayAvatarURL === "function") {
    return user.displayAvatarURL({ extension: "png", size: 128 });
  }

  return user?.avatar ?? null;
}

function attachmentsOf(message) {
  if (!message?.attachments) return [];

  return [...message.attachments.values()]
    .slice(0, MAX_ATTACHMENTS)
    .map((attachment) => ({
      name: attachment.name,
      url: attachment.url
    }));
}

function attachmentUrls(list) {
  return (list ?? []).map((item) => item.url).sort();
}

function sameAttachments(a, b) {
  const left = attachmentUrls(a);
  const right = attachmentUrls(b);

  return (
    left.length === right.length &&
    left.every((url, index) => url === right[index])
  );
}

function attachmentsField(list) {
  if (!list || list.length === 0) return null;

  return list
    .map((item) => `[${cut(item.name, 80)}](${item.url})`)
    .join("\n");
}

function remember(message) {
  if (!message?.guildId || message.system) return;

  const author = message.author;

  recent.set(message.id, {
    content: message.content ?? "",
    attachments: attachmentsOf(message),
    createdAt: message.createdAt,
    verification: isVerificationTicket(message),
    author: author
      ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatar: avatarUrl(author)
        }
      : null
  });

  if (recent.size > MAX_CACHE) {
    recent.delete(recent.keys().next().value);
  }
}

function logEmbed(title, color, user) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  const avatar = avatarUrl(user);
  if (avatar) embed.setThumbnail(avatar);

  return embed;
}

async function sendLog(client, embed) {
  try {
    await sendToChannel(client, LOG_CHANNEL, {
      embeds: [embed],
      allowedMentions: { parse: [] }
    });
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude enviar el log:`, err.message);
  }
}

async function onMessageDelete(client, message) {
  if (!message.guildId) return;

  const snapshot = recent.get(message.id);
  recent.delete(message.id);

  const author = message.author ?? snapshot?.author ?? null;
  if (author?.id === client.user.id) return;
  if (snapshot?.verification || isVerificationTicket(message)) return;

  const createdAt = snapshot?.createdAt ?? message.createdAt;
  const content = snapshot
    ? snapshot.content
    : message.partial
      ? null
      : message.content;
  const attachments = snapshot?.attachments ?? attachmentsOf(message);

  const embed = logEmbed("🗑️ Mensaje eliminado", 0xe74c3c, author)
    .addFields(
      { name: "Canal", value: channelLabel(message.channelId) },
      { name: "Autor", value: userLabel(author) },
      { name: "ID del mensaje", value: `\`${message.id}\`` }
    );

  if (createdAt) {
    embed.addFields({
      name: "Creado",
      value: timestamp(createdAt, "R")
    });
  }

  embed.addFields({
    name: "Contenido",
    value: content === null ? "No disponible" : cut(content)
  });

  const attachmentsValue = attachmentsField(attachments);
  if (attachmentsValue) {
    embed.addFields({ name: "Adjuntos", value: cut(attachmentsValue) });
  }

  await sendLog(client, embed);
}

async function onMessageUpdate(client, oldMessage, newMessage) {
  if (!newMessage.guildId || newMessage.system) return;
  if (newMessage.author?.id === client.user.id) return;

  let after = newMessage;

  if (after.partial) {
    try {
      after = await after.fetch();
    } catch {
      return;
    }
  }

  if (after.author?.id === client.user.id) {
    remember(after);
    return;
  }

  const snapshot = recent.get(after.id);
  if (snapshot?.verification || isVerificationTicket(after)) {
    remember(after);
    return;
  }

  const beforeContent = snapshot
    ? snapshot.content
    : oldMessage.partial
      ? null
      : oldMessage.content;
  const beforeAttachments = snapshot
    ? snapshot.attachments
    : oldMessage.partial
      ? null
      : attachmentsOf(oldMessage);

  if (beforeContent === null) return;

  const afterContent = after.content ?? "";
  const afterAttachments = attachmentsOf(after);

  if (
    beforeContent === afterContent &&
    sameAttachments(beforeAttachments, afterAttachments)
  ) {
    remember(after);
    return;
  }

  const author = after.author ?? snapshot?.author ?? null;
  const createdAt = snapshot?.createdAt ?? after.createdAt;

  const embed = logEmbed("✏️ Mensaje editado", 0xf1c40f, author)
    .setURL(after.url)
    .addFields(
      { name: "Canal", value: channelLabel(after.channelId) },
      { name: "Autor", value: userLabel(author) },
      { name: "ID del mensaje", value: `\`${after.id}\`` }
    );

  if (createdAt) {
    embed.addFields({
      name: "Creado",
      value: timestamp(createdAt, "R")
    });
  }

  embed.addFields(
    { name: "Antes", value: cut(beforeContent) },
    { name: "Después", value: cut(afterContent) }
  );

  const beforeFiles = attachmentsField(beforeAttachments);
  const afterFiles = attachmentsField(afterAttachments);

  if (beforeFiles || afterFiles) {
    embed.addFields({
      name: "Adjuntos",
      value: cut(
        `Antes: ${beforeFiles || "(sin adjuntos)"}\n` +
          `Después: ${afterFiles || "(sin adjuntos)"}`
      )
    });
  }

  remember(after);
  await sendLog(client, embed);
}

function voiceUsers(channel, excludeId) {
  if (!channel) return { count: "?", limit: "∞" };

  const members = excludeId
    ? channel.members.filter((member) => member.id !== excludeId)
    : channel.members;

  return {
    count: members.size,
    limit: channel.userLimit || "∞"
  };
}

async function onVoiceStateUpdate(client, oldState, newState) {
  if (!newState.guild) return;
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member ?? oldState.member;
  const user = member?.user;
  if (!user) return;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;
  const moved = oldState.channelId && newState.channelId;

  let embed;

  if (joined) {
    const channel = newState.channel;
    const users = voiceUsers(channel);

    embed = logEmbed("🔊 Se unió a un canal de voz", 0x2ecc71, user).addFields(
      { name: "Usuario", value: userLabel(user, member) },
      { name: "Canal", value: channelLabel(newState.channelId) },
      { name: "Usuarios", value: `${users.count}/${users.limit}` }
    );
  } else if (left) {
    const channel = oldState.channel;
    const users = voiceUsers(channel, user.id);

    embed = logEmbed("🔇 Salió de un canal de voz", 0xe74c3c, user).addFields(
      { name: "Usuario", value: userLabel(user, member) },
      { name: "Canal", value: channelLabel(oldState.channelId) },
      { name: "Usuarios", value: `${users.count}/${users.limit}` }
    );
  } else if (moved) {
    const channel = newState.channel;
    const users = voiceUsers(channel);

    embed = logEmbed("🔀 Se movió de canal de voz", 0x3498db, user).addFields(
      { name: "Usuario", value: userLabel(user, member) },
      { name: "Canal anterior", value: channelLabel(oldState.channelId) },
      { name: "Canal nuevo", value: channelLabel(newState.channelId) },
      { name: "Usuarios", value: `${users.count}/${users.limit}` }
    );
  }

  if (embed) await sendLog(client, embed);
}

async function onGuildMemberAdd(client, member) {
  const embed = logEmbed("📥 Se unió al servidor", 0x2ecc71, member.user)
    .addFields(
      { name: "Usuario", value: userLabel(member.user, member) },
      {
        name: "Cuenta creada",
        value: timestamp(member.user.createdAt, "R")
      },
      { name: "Miembros", value: String(member.guild.memberCount) }
    );

  await sendLog(client, embed);
}

async function onGuildMemberRemove(client, member) {
  const embed = logEmbed("📤 Salió del servidor", 0xe74c3c, member.user).addFields(
    { name: "Usuario", value: userLabel(member.user, member) },
    { name: "Miembros", value: String(member.guild.memberCount) }
  );

  if (member.joinedTimestamp) {
    embed.addFields({
      name: "Se unió",
      value: timestamp(member.joinedTimestamp, "R")
    });
  }

  const roles = member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => `<@&${role.id}>`);

  if (roles.length > 0) {
    embed.addFields({ name: "Roles", value: cut(roles.join(", ")) });
  }

  await sendLog(client, embed);
}

function start(client) {
  client.on("messageCreate", (message) => remember(message));

  client.on("messageDelete", (message) => {
    onMessageDelete(client, message).catch((err) => {
      console.error(`${TAG} ⚠️ error al registrar borrado:`, err.message);
    });
  });

  client.on("messageUpdate", (oldMessage, newMessage) => {
    onMessageUpdate(client, oldMessage, newMessage).catch((err) => {
      console.error(`${TAG} ⚠️ error al registrar edición:`, err.message);
    });
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    onVoiceStateUpdate(client, oldState, newState).catch((err) => {
      console.error(`${TAG} ⚠️ error al registrar voz:`, err.message);
    });
  });

  client.on("guildMemberAdd", (member) => {
    onGuildMemberAdd(client, member).catch((err) => {
      console.error(`${TAG} ⚠️ error al registrar entrada:`, err.message);
    });
  });

  client.on("guildMemberRemove", (member) => {
    onGuildMemberRemove(client, member).catch((err) => {
      console.error(`${TAG} ⚠️ error al registrar salida:`, err.message);
    });
  });

  console.log(`${TAG} ✅ logs de actividad activos en <#${LOG_CHANNEL}>`);
}

module.exports = { start };
