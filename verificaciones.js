const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require("discord.js");
const config = require("./config");
const store = require("./store");
const { singleFlight } = require("./utils/async");
const { getTextChannel, timestamp } = require("./utils/discord");
const { hasAnyRole } = require("./utils/permissions");

const TAG = "🪪 [verificaciones]";
const STATE = store.create("verificaciones.json", TAG);
const LOG_STORE = store.create("verificaciones-log.json", TAG);

const VERIFIED_ROLE = config.roles.verificade;
const STAFF_ROLES = [config.roles.admin200kg, config.roles.admin120kg];
const CHANNEL_VERIFICACION = config.channels.verificacion;
const CHANNEL_ADMIN = config.channels.admin;

const TICKET_TTL_MS = 48 * 60 * 60 * 1000;
const SWEEP_MS = 5 * 60 * 1000;

const PANEL_TEXT =
  "Hacé click en el botón debajo para verificarte y poder acceder a los canales NSFW. " +
  "Vamos a pedirte una foto de alguna identificación que diga tu fecha de nacimiento " +
  "(censurá cualquier otra información) y EN LA MISMA IMAGEN algún papel que diga tu " +
  "username junto al nombre del servidor.";

const TICKET_TEXT = (username) =>
  `Hola ${username}! Para verificarte, vamos a necesitar una foto de alguna ` +
  "identificación que diga tu fecha de nacimiento (censurá cualquier otra información) " +
  "y EN LA MISMA IMAGEN algún papel que diga tu username junto al nombre del servidor. " +
  "Tenés 48 horas para hacerlo, luego la solicitud se cerrará y deberás crear una nueva.";

const REJECT_DM =
  "❌ Tu solicitud de verificación fue rechazada. " +
  "Podés crear una nueva desde el canal de verificación.";
const EXPIRE_DM =
  "⌛ Tu solicitud de verificación expiró después de 48 horas. " +
  "Podés crear una nueva desde el canal de verificación.";

let state = loadState();
let logs = loadLogs();
const creating = new Set();
const expectedRoleChanges = new Set();

function loadState() {
  const raw = STATE.load({});
  const tickets = {};

  if (raw?.tickets && typeof raw.tickets === "object" && !Array.isArray(raw.tickets)) {
    for (const [channelId, ticket] of Object.entries(raw.tickets)) {
      if (!ticket || typeof ticket !== "object") continue;
      if (typeof ticket.userId !== "string") continue;
      if (!Number.isFinite(ticket.expiresAt)) continue;

      tickets[channelId] = {
        userId: ticket.userId,
        userTag:
          typeof ticket.userTag === "string" ? ticket.userTag : ticket.userId,
        guildId: typeof ticket.guildId === "string" ? ticket.guildId : null,
        createdAt: Number.isFinite(ticket.createdAt) ? ticket.createdAt : null,
        expiresAt: ticket.expiresAt
      };
    }
  }

  return {
    panelMessageId:
      typeof raw?.panelMessageId === "string" ? raw.panelMessageId : null,
    tickets
  };
}

function loadLogs() {
  const raw = LOG_STORE.load([]);
  return Array.isArray(raw) ? raw : [];
}

function saveState() {
  STATE.save(state);
}

function sanitizeUsername(username, fallbackId) {
  const fallback = `user-${fallbackId}`;
  const normalized = String(username ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  const base = normalized || fallback;
  const trimmed = base.slice(0, 80).replace(/[-_]+$/g, "");

  return trimmed || fallback;
}

function panelPayload() {
  return {
    content: PANEL_TEXT,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verificacion:open")
          .setLabel("Verificarme")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

function ticketButtons(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verificacion:cancel:${channelId}`)
      .setLabel("❌ Cancelar verificación")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`verificacion:accept:${channelId}`)
      .setLabel("✅ Aceptar solicitud")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`verificacion:reject:${channelId}`)
      .setLabel("❌ Rechazar solicitud")
      .setStyle(ButtonStyle.Danger)
  );
}

function ticketPayload(user, channelId) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Solicitud de verificación")
    .setDescription(TICKET_TEXT(user.username));

  return {
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [ticketButtons(channelId)],
    allowedMentions: { users: [user.id] }
  };
}

function isStaff(interaction) {
  if (!interaction.inGuild()) return false;

  return (
    interaction.guild.ownerId === interaction.user.id ||
    hasAnyRole(interaction, STAFF_ROLES)
  );
}

function findTicketByUser(userId) {
  for (const [channelId, ticket] of Object.entries(state.tickets)) {
    if (ticket.userId === userId) return { channelId, ...ticket };
  }

  return null;
}

function ticketForInteraction(interaction, channelId) {
  const id = channelId || interaction.channelId;
  if (!id || id !== interaction.channelId) return null;

  const ticket = state.tickets[id];
  return ticket ? { channelId: id, ...ticket } : null;
}

function removeTicket(channelId) {
  if (!state.tickets[channelId]) return false;

  delete state.tickets[channelId];

  try {
    saveState();
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude guardar el estado: ${err.message}`);
  }

  return true;
}

function expectRoleChange(userId) {
  expectedRoleChanges.add(userId);
  const timer = setTimeout(() => {
    expectedRoleChanges.delete(userId);
  }, 15000);
  timer.unref?.();
}

function clearExpectedRoleChange(userId) {
  expectedRoleChanges.delete(userId);
}

function consumeExpectedRoleChange(userId) {
  if (!expectedRoleChanges.has(userId)) return false;

  expectedRoleChanges.delete(userId);
  return true;
}

function logVerification({ action, method, actor = null, target = null, channelId = null }) {
  const entry = {
    at: new Date().toISOString(),
    action,
    method,
    actorId: actor?.id ?? null,
    actorTag: actor?.tag ?? actor?.username ?? null,
    targetId: target?.id ?? null,
    targetTag: target?.tag ?? target?.username ?? null,
    channelId
  };

  logs.push(entry);

  try {
    LOG_STORE.save(logs);
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude guardar el log: ${err.message}`);
  }

  const actorLabel = entry.actorTag ?? "sistema";
  const targetLabel = entry.targetTag ?? entry.targetId ?? "desconocido";
  console.log(`${TAG} 📝 ${action}: ${actorLabel} → ${targetLabel}`);
}

async function defer(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
}

async function respond(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content }).catch(() => {});
    return;
  }

  await interaction
    .reply({ content, flags: MessageFlags.Ephemeral })
    .catch(() => {});
}

const ensurePanel = singleFlight(async (client) => {
  const channel = await getTextChannel(client, CHANNEL_VERIFICACION);
  let missing = !state.panelMessageId;

  if (state.panelMessageId) {
    try {
      const message = await channel.messages.fetch(state.panelMessageId);

      if (message.author.id === client.user.id) {
        await message.edit(panelPayload());
        return message;
      }

      missing = true;
    } catch (err) {
      if (err.code === 10008) {
        missing = true;
      } else {
        console.error(`${TAG} ⚠️ no pude revisar el panel: ${err.message}`);
        return null;
      }
    }
  }

  if (!missing) return null;

  const message = await channel.send(panelPayload());
  state.panelMessageId = message.id;
  saveState();
  console.log(`${TAG} ✅ panel publicado en <#${CHANNEL_VERIFICACION}>`);

  return message;
});

async function sendExpiryNotice(client, ticket) {
  const user = await client.users.fetch(ticket.userId).catch((err) => {
    console.error(
      `${TAG} ⚠️ no pude obtener a ${ticket.userTag}: ${err.message}`
    );
    return null;
  });

  if (!user) return;

  await user.send({ content: EXPIRE_DM }).catch((err) => {
    console.error(
      `${TAG} ⚠️ no pude avisar por DM a ${ticket.userTag}: ${err.message}`
    );
  });
}

async function expireTickets(client) {
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(state.tickets)) {
    if (ticket.expiresAt > now) continue;

    let channel;

    try {
      channel = await client.channels.fetch(channelId);
    } catch (err) {
      if (err.code !== 10003) {
        console.error(`${TAG} ⚠️ no pude revisar ${channelId}: ${err.message}`);
        continue;
      }

      channel = null;
    }

    if (channel) {
      try {
        await channel.delete("Solicitud de verificación expirada (48 h)");
      } catch (err) {
        console.error(`${TAG} ⚠️ no pude borrar ${channelId}: ${err.message}`);
        continue;
      }
    }

    removeTicket(channelId);
    await sendExpiryNotice(client, ticket);

    logVerification({
      action: "expired",
      method: "sweep",
      target: { id: ticket.userId, tag: ticket.userTag },
      channelId
    });
  }
}

const sweep = singleFlight(async (client) => {
  await expireTickets(client);
  await ensurePanel(client);
});

async function openTicket(interaction) {
  if (!interaction.inGuild()) {
    await respond(interaction, "Este botón solo funciona dentro del servidor.");
    return;
  }

  await defer(interaction);

  const { user, member, guild } = interaction;

  if (!member) {
    await respond(interaction, "❌ No pude identificar tu membresía.");
    return;
  }

  if (member.roles.cache.has(VERIFIED_ROLE)) {
    await respond(interaction, "ℹ️ Ya estás verificade.");
    return;
  }

  if (creating.has(user.id)) {
    await respond(interaction, "⏳ Ya se está creando tu solicitud.");
    return;
  }

  creating.add(user.id);

  try {
    const existing = findTicketByUser(user.id);

    if (existing) {
      let channel = null;

      try {
        channel = await guild.channels.fetch(existing.channelId);
      } catch (err) {
        if (err.code !== 10003) {
          console.error(
            `${TAG} ⚠️ no pude revisar el ticket de ${user.tag}: ${err.message}`
          );
          await respond(
            interaction,
            "❌ No pude comprobar tu solicitud existente. Avisá al staff."
          );
          return;
        }
      }

      if (channel) {
        await respond(
          interaction,
          `ℹ️ Ya tenés una solicitud abierta: <#${existing.channelId}>.`
        );
        return;
      }

      removeTicket(existing.channelId);
    }

    let category = null;

    try {
      category = await guild.channels.fetch(CHANNEL_ADMIN);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude acceder a CHANNEL_ADMIN_ID: ${err.message}`
      );
    }

    if (!category || category.type !== ChannelType.GuildCategory) {
      console.error(`${TAG} ⚠️ CHANNEL_ADMIN_ID no es una categoría válida`);
      await respond(
        interaction,
        "❌ La categoría configurada para verificaciones no es válida."
      );
      return;
    }

    const now = Date.now();
    const expiresAt = now + TICKET_TTL_MS;
    const safeName = sanitizeUsername(user.username, user.id);
    const overwrites = new Map();

    const memberAllow = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles
    ];
    const staffAllow = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles
    ];
    const botAllow = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ];

    overwrites.set(guild.roles.everyone.id, {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    });
    overwrites.set(user.id, {
      id: user.id,
      allow: memberAllow
    });
    overwrites.set(config.roles.admin200kg, {
      id: config.roles.admin200kg,
      allow: staffAllow
    });
    overwrites.set(config.roles.admin120kg, {
      id: config.roles.admin120kg,
      allow: staffAllow
    });
    overwrites.set(guild.ownerId, {
      id: guild.ownerId,
      allow: staffAllow
    });
    overwrites.set(interaction.client.user.id, {
      id: interaction.client.user.id,
      allow: botAllow
    });

    const channel = await guild.channels.create({
      name: `verificacion-${safeName}`,
      type: ChannelType.GuildText,
      parent: CHANNEL_ADMIN,
      topic:
        `Verificación de ${user.tag} (${user.id}) · ` +
        `vence ${timestamp(expiresAt, "f")}`,
      permissionOverwrites: [...overwrites.values()],
      reason: `Solicitud de verificación de ${user.tag}`
    });

    const ticket = {
      userId: user.id,
      userTag: user.tag,
      guildId: guild.id,
      createdAt: now,
      expiresAt
    };

    try {
      state.tickets[channel.id] = ticket;
      saveState();
      await channel.send(ticketPayload(user, channel.id));
    } catch (err) {
      delete state.tickets[channel.id];

      try {
        saveState();
      } catch {}

      await channel
        .delete("No se pudo publicar la solicitud de verificación")
        .catch(() => {});
      throw err;
    }

    console.log(`${TAG} 🪪 ${user.tag} abrió ${channel.name}`);
    await respond(
      interaction,
      `✅ Tu solicitud fue creada: <#${channel.id}>.`
    );
  } catch (err) {
    console.error(
      `${TAG} ⚠️ no pude crear el ticket de ${user.tag}: ${err.message}`
    );
    await respond(
      interaction,
      "❌ No pude crear tu solicitud. Avisá al staff."
    );
  } finally {
    creating.delete(user.id);
  }
}

async function acceptTicket(interaction, channelId) {
  if (!interaction.inGuild()) {
    await respond(interaction, "Este botón solo funciona dentro del servidor.");
    return;
  }

  if (!isStaff(interaction)) {
    await respond(
      interaction,
      "🚫 Solo el owner, 200kg o 120kg pueden aceptar solicitudes."
    );
    return;
  }

  const ticket = ticketForInteraction(interaction, channelId);

  if (!ticket) {
    await respond(interaction, "❌ No encontré esta solicitud.");
    return;
  }

  await defer(interaction);

  const member = await interaction.guild.members
    .fetch(ticket.userId)
    .catch((err) => {
      console.error(
        `${TAG} ⚠️ no pude obtener a ${ticket.userTag}: ${err.message}`
      );
      return null;
    });

  if (!member) {
    await respond(
      interaction,
      "❌ Esa persona ya no está en el servidor. Podés rechazar la solicitud."
    );
    return;
  }

  const alreadyVerified = member.roles.cache.has(VERIFIED_ROLE);

  if (!alreadyVerified) {
    expectRoleChange(member.id);

    try {
      await member.roles.add(
        VERIFIED_ROLE,
        `Verificación aprobada por ${interaction.user.tag}`
      );
    } catch (err) {
      clearExpectedRoleChange(member.id);
      console.error(`${TAG} ⚠️ no pude asignar verificade: ${err.message}`);
      await respond(
        interaction,
        '❌ No pude asignar el rol verificade (revisá permisos y jerarquía de roles).'
      );
      return;
    }
  }

  logVerification({
    action: "accepted",
    method: "ticket",
    actor: interaction.user,
    target: member.user,
    channelId: ticket.channelId
  });

  await respond(
    interaction,
    alreadyVerified
      ? "✅ Solicitud aceptada. La persona ya estaba verificada."
      : "✅ Solicitud aceptada. El anuncio se publicará en el canal general."
  );

  removeTicket(ticket.channelId);

  try {
    await interaction.channel.delete(
      `Verificación aprobada por ${interaction.user.tag}`
    );
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude borrar el canal: ${err.message}`);
  }
}

async function rejectTicket(interaction, channelId) {
  if (!interaction.inGuild()) {
    await respond(interaction, "Este botón solo funciona dentro del servidor.");
    return;
  }

  if (!isStaff(interaction)) {
    await respond(
      interaction,
      "🚫 Solo el owner, 200kg o 120kg pueden rechazar solicitudes."
    );
    return;
  }

  const ticket = ticketForInteraction(interaction, channelId);

  if (!ticket) {
    await respond(interaction, "❌ No encontré esta solicitud.");
    return;
  }

  await defer(interaction);

  const user = await interaction.client.users
    .fetch(ticket.userId)
    .catch((err) => {
      console.error(
        `${TAG} ⚠️ no pude obtener a ${ticket.userTag}: ${err.message}`
      );
      return null;
    });

  if (user) {
    await user.send({ content: REJECT_DM }).catch((err) => {
      console.error(
        `${TAG} ⚠️ no pude avisar por DM a ${ticket.userTag}: ${err.message}`
      );
    });
  }

  logVerification({
    action: "rejected",
    method: "ticket",
    actor: interaction.user,
    target: { id: ticket.userId, tag: ticket.userTag },
    channelId: ticket.channelId
  });

  await respond(interaction, "❌ Solicitud rechazada.");
  removeTicket(ticket.channelId);

  try {
    await interaction.channel.delete(
      `Verificación rechazada por ${interaction.user.tag}`
    );
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude borrar el canal: ${err.message}`);
  }
}

async function cancelTicket(interaction, channelId) {
  if (!interaction.inGuild()) {
    await respond(interaction, "Este botón solo funciona dentro del servidor.");
    return;
  }

  const ticket = ticketForInteraction(interaction, channelId);

  if (!ticket) {
    await respond(interaction, "❌ No encontré esta solicitud.");
    return;
  }

  if (ticket.userId !== interaction.user.id) {
    await respond(
      interaction,
      "🚫 Solo quien abrió la solicitud puede cancelarla."
    );
    return;
  }

  await defer(interaction);

  logVerification({
    action: "cancelled",
    method: "ticket",
    actor: interaction.user,
    target: { id: ticket.userId, tag: ticket.userTag },
    channelId: ticket.channelId
  });

  await respond(interaction, "❌ Solicitud cancelada.");
  removeTicket(ticket.channelId);

  try {
    await interaction.channel.delete(
      `Verificación cancelada por ${interaction.user.tag}`
    );
  } catch (err) {
    console.error(`${TAG} ⚠️ no pude borrar el canal: ${err.message}`);
  }
}

function start(client) {
  client.on("channelDelete", (channel) => {
    try {
      removeTicket(channel.id);
    } catch (err) {
      console.error(`${TAG} ⚠️ no pude limpiar el ticket: ${err.message}`);
    }
  });

  sweep(client).catch((err) => {
    console.error(`${TAG} ⚠️ error en el barrido inicial: ${err.message}`);
  });

  const timer = setInterval(() => {
    sweep(client).catch((err) => {
      console.error(`${TAG} ⚠️ error en el barrido: ${err.message}`);
    });
  }, SWEEP_MS);

  timer.unref?.();
  console.log(`${TAG} ✅ panel y tickets de verificación activos`);
}

module.exports = {
  SWEEP_MS,
  TICKET_TTL_MS,
  sanitizeUsername,
  ensurePanel,
  openTicket,
  acceptTicket,
  rejectTicket,
  cancelTicket,
  logVerification,
  consumeExpectedRoleChange,
  isStaff,
  start
};
