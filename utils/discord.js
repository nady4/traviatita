const { EmbedBuilder } = require('discord.js');

function timestamp(value, style = 'R') {
  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:${style}>`;
}

function stableDayTimestamp(date) {
  const noon = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12,
  );
  return `<t:${Math.floor(noon / 1000)}:D>`;
}

async function getTextChannel(client, channelId) {
  if (!client || !channelId) throw new Error('canal de anuncios inválido');
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error('canal de anuncios inválido');
  return channel;
}

async function sendToChannel(client, channelId, payload) {
  const channel = await getTextChannel(client, channelId);
  return channel.send(payload);
}

async function announceStockChange({
  client,
  channelId,
  roleId,
  title,
  url,
  label,
  wasInStock,
  inStock,
  tag = '',
}) {
  if (!channelId || !client) return;
  try {
    const channel = await getTextChannel(client, channelId);
    const embed = new EmbedBuilder()
      .setColor(inStock ? 0x2ecc71 : 0xe74c3c)
      .setTitle(title)
      .setURL(url)
      .setDescription(
        `**${label}**: ${wasInStock ? '🟢 en stock' : '🔴 agotado'} → ${inStock ? '🟢 **en stock**' : '🔴 **agotado**'}`,
      );
    await channel.send({
      content: `<@&${roleId}>`,
      embeds: [embed],
      allowedMentions: { roles: [roleId] },
    });
  } catch (err) {
    console.error(`${tag} ⚠️ no pude anunciar:`, err.message);
  }
}

module.exports = {
  timestamp,
  stableDayTimestamp,
  getTextChannel,
  sendToChannel,
  announceStockChange,
};
