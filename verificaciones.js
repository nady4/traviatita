const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  OverwriteType,
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
const STAFF_ROLES = [
  config.roles.admin500kg,
  config.roles.admin200kg,
  config.roles.admin120kg
];
const CHANNEL_VERIFICACION = config.channels.verificacion;
const CATEGORY_ADMIN = config.channels.admin;

const TICKET_TTL_MS = 48 * 60 * 60 * 1000;
const SWEEP_MS = 5 * 60 * 1000;
const COUNTDOWN_MS = 60 * 1000;
const COOLDOWN_MS = 60 * 60 * 1000;
const MAX_LOG_ENTRIES = 1000;
const EMBED_COLOR = 0xe77cae;

const PANEL_TEXT =
  "🔞 Hacé click en el botón debajo para verificarte y poder acceder a los canales NSFW.\n\n" +
  "📸 Vamos a pedirte una foto de alguna identificación 🪪 que diga tu fecha de nacimiento " +
  "(censurá cualquier otra información) y EN LA MISMA IMAGEN algún papel 📄 que diga tu " +
  "username junto al nombre del servidor.";

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

const TICKET_TEXT = (username, expiresAt) =>
  `🔞 Hola ${username}!\n\n` +
  "Para verificarte, vamos a necesitar una foto 📸 de alguna " +
  "identificación 🪪 que diga tu fecha de nacimiento (censurá cualquier otra información) " +
  "y EN LA MISMA IMAGEN algún papel 📄 que diga tu username junto al nombre del servidor.\n\n" +
  `Tenés ${formatRemaining(expiresAt - Date.now())} para hacerlo, ` +
  "luego la solicitud se cerrará y deberás crear una nueva.";

const rejectDm = (retryAt) =>
  "❌ Tu solicitud de verificación a Operación Traviata fue rechazada. " +
  `Podés crear una nueva a partir de <t:${Math.floor(retryAt / 1000)}:R>.`;
const expireDm = (retryAt) =>
  "⌛ Tu solicitud de verificación a Operación Traviata expiró después de 48 horas. " +
  `Podés crear una nueva a partir de <t:${Math.floor(retryAt / 1000)}:R>.`;

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
        username:
          typeof ticket.username === "string"
            ? ticket.username
            : typeof ticket.userTag === "string"
              ? ticket.userTag
              : ticket.userId,
        messageId:
          typeof ticket.messageId === "string" ? ticket.messageId : null,
        guildId: typeof ticket.guildId === "string" ? ticket.guildId : null,
        createdAt: Number.isFinite(ticket.createdAt) ? ticket.createdAt : null,
        expiresAt: ticket.expiresAt
      };
    }
  }

  const cooldowns = {};

  if (raw?.cooldowns && typeof raw.cooldowns === "object" && !Array.isArray(raw.cooldowns)) {
    for (const [userId, until] of Object.entries(raw.cooldowns)) {
      if (/^\d{17,20}$/.test(userId) && Number.isFinite(until)) {
        cooldowns[userId] = until;
      }
    }
  }

  return {
    panelMessageId:
      typeof raw?.panelMessageId === "string" ? raw.panelMessageId : null,
    tickets,
    cooldowns
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
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(PANEL_TEXT);

  return {
    content: "",
    embeds: [embed],
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

function ticketEmbed(username, expiresAt) {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("✅ Solicitud de verificación")
    .setDescription(TICKET_TEXT(username, expiresAt));
}

function ticketPayload(user, channelId, expiresAt) {
  return {
    content:
      `<@${user.id}> ` +
      `<@&${config.roles.admin500kg}> ` +
      `<@&${config.roles.admin200kg}> ` +
      `<@&${config.roles.admin120kg}>`,
    embeds: [ticketEmbed(user.username, expiresAt)],
    components: [ticketButtons(channelId)],
    allowedMentions: {
      users: [user.id],
      roles: [
        config.roles.admin500kg,
        config.roles.admin200kg,
        config.roles.admin120kg
      ]
    }
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

function setCooldown(userId) {
  state.cooldowns[userId] = Date.now() + COOLDOWN_MS;
  saveState();
}

function cooldownFor(userId) {
  const until = state.cooldowns[userId];
  return Number.isFinite(until) && until > Date.now() ? until : null;
}

function cleanupCooldowns() {
  const now = Date.now();
  let changed = false;

  for (const [userId, until] of Object.entries(state.cooldowns)) {
    if (until <= now) {
      delete state.cooldowns[userId];
      changed = true;
    }
  }

  if (changed) {
    try {
      saveState();
    } catch (err) {
      console.error(`${TAG} ⚠️ no pude guardar el estado: ${err.message}`);
    }
  }

  return changed;
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

  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }

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

  const retryAt =
    cooldownFor(ticket.userId) ?? Date.now() + COOLDOWN_MS;

  await user.send({ content: expireDm(retryAt) }).catch((err) => {
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
    setCooldown(ticket.userId);
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
  cleanupCooldowns();
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

  const cooldownUntil = cooldownFor(user.id);

  if (cooldownUntil) {
    await respond(
      interaction,
      `⏳ Podrás crear otra solicitud el <t:${Math.floor(cooldownUntil / 1000)}:R>.`
    );
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
      category = await guild.channels.fetch(CATEGORY_ADMIN);
    } catch (err) {
      console.error(
        `${TAG} ⚠️ no pude acceder a CATEGORY_ADMIN_ID: ${err.message}`
      );
    }

    if (!category || category.type !== ChannelType.GuildCategory) {
      console.error(`${TAG} ⚠️ CATEGORY_ADMIN_ID no es una categoría válida`);
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
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel]
    });
    overwrites.set(user.id, {
      id: user.id,
      type: OverwriteType.Member,
      allow: memberAllow
    });
    for (const roleId of STAFF_ROLES) {
      overwrites.set(roleId, {
        id: roleId,
        type: OverwriteType.Role,
        allow: staffAllow
      });
    }
    overwrites.set(guild.ownerId, {
      id: guild.ownerId,
      type: OverwriteType.Member,
      allow: staffAllow
    });
    overwrites.set(interaction.client.user.id, {
      id: interaction.client.user.id,
      type: OverwriteType.Member,
      allow: botAllow
    });

    const channel = await guild.channels.create({
      name: `verificacion-${safeName}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ADMIN,
      topic:
        `Verificación de ${user.tag} (${user.id}) · ` +
        `vence ${timestamp(expiresAt, "f")}`,
      permissionOverwrites: [...overwrites.values()],
      reason: `Solicitud de verificación de ${user.tag}`
    });

    const ticket = {
      userId: user.id,
      userTag: user.tag,
      username: user.username,
      messageId: null,
      guildId: guild.id,
      createdAt: now,
      expiresAt
    };

    try {
      state.tickets[channel.id] = ticket;
      saveState();
      const message = await channel.send(
        ticketPayload(user, channel.id, expiresAt)
      );
      ticket.messageId = message.id;
      saveState();
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
      "🚫 Sólo la owner y el staff pueden aceptar solicitudes."
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
      "🚫 Sólo la owner y el staff pueden rechazar solicitudes."
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
    setCooldown(ticket.userId);
    const retryAt = cooldownFor(ticket.userId) ?? Date.now() + COOLDOWN_MS;
    await user.send({ content: rejectDm(retryAt) }).catch((err) => {
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

  if (ticket.userId !== interaction.user.id && !isStaff(interaction)) {
    await respond(
      interaction,
      "🚫 Solo quien abrió la solicitud o el staff pueden cancelarla."
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

  setCooldown(ticket.userId);
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

const refreshTicketCountdowns = singleFlight(async (client) => {
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(state.tickets)) {
    if (ticket.expiresAt <= now) continue;

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) continue;

      let message = null;

      if (ticket.messageId) {
        message = await channel.messages.fetch(ticket.messageId).catch((err) => {
          if (err.code === 10008) return null;
          throw err;
        });
      }

      if (!message) {
        const recent = await channel.messages.fetch({ limit: 20 });
        message = recent.find(
          (candidate) =>
            candidate.author.id === client.user.id &&
            candidate.embeds.some(
              (embed) => embed.title === "Solicitud de verificación"
            )
        );

        if (!message) continue;

        ticket.messageId = message.id;

        try {
          saveState();
        } catch (err) {
          console.error(`${TAG} ⚠️ no pude guardar el estado: ${err.message}`);
        }
      }

      await message.edit({
        embeds: [
          ticketEmbed(ticket.username ?? ticket.userTag, ticket.expiresAt)
        ]
      });
    } catch (err) {
      if (err.code === 10003) continue;

      console.error(
        `${TAG} ⚠️ no pude actualizar el contador de ${channelId}: ${err.message}`
      );
    }
  }
});

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

  refreshTicketCountdowns(client).catch((err) => {
    console.error(`${TAG} ⚠️ error al actualizar contadores: ${err.message}`);
  });

  const timer = setInterval(() => {
    sweep(client).catch((err) => {
      console.error(`${TAG} ⚠️ error en el barrido: ${err.message}`);
    });
  }, SWEEP_MS);

  const countdownTimer = setInterval(() => {
    refreshTicketCountdowns(client).catch((err) => {
      console.error(
        `${TAG} ⚠️ error al actualizar contadores: ${err.message}`
      );
    });
  }, COUNTDOWN_MS);

  timer.unref?.();
  countdownTimer.unref?.();
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
