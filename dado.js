const { randomInt } = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const TAG = '🎲 [dado]';

const DICE = [3, 4, 6, 8, 10, 12, 20, 100];
const MAX_SIDES = 1_000_000;
const MAX_RANGE = 1_000_000_000_000;

function roll(sides) {
  return randomInt(sides) + 1;
}

function rollRange(min, max) {
  return randomInt(min, max + 1);
}

function parseSides(raw) {
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 2 || n > MAX_SIDES) return null;
  return n;
}

function parseRange(minRaw, maxRaw) {
  const min = Number(String(minRaw).trim());
  const max = Number(String(maxRaw).trim());
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (Math.abs(min) > MAX_RANGE || Math.abs(max) > MAX_RANGE) return null;
  if (min > max) return null;
  return { min, max };
}

function resultStandard(sides) {
  return {
    name: `d${sides}`,
    text: `un **d${sides}**`,
    value: roll(sides),
  };
}

function resultRange(min, max) {
  return {
    name: `${min}–${max}`,
    text: `un número al azar entre **${min}** y **${max}**`,
    value: rollRange(min, max),
  };
}

function rows() {
  const [first, second] = [new ActionRowBuilder(), new ActionRowBuilder()];
  DICE.forEach((sides, i) => {
    (i < 5 ? first : second).addComponents(
      new ButtonBuilder()
        .setCustomId(`dado:roll:${sides}`)
        .setLabel(`d${sides}`)
        .setStyle(ButtonStyle.Secondary),
    );
  });
  second.addComponents(
    new ButtonBuilder()
      .setCustomId('dado:custom')
      .setLabel('Personalizado dX')
      .setEmoji('🎲')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('dado:range')
      .setLabel('Rango al azar')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
  );
  return [first, second];
}

function buildView(userId, r) {
  if (!r) {
    return {
      content: '🎲 ¡A tirar! Elegí un dado, armá uno personalizado o pedí un rango — el resultado aparece acá mismo, visible para todos.',
      components: rows(),
    };
  }
  return {
    content: `🎲 <@${userId}> tiró ${r.text} → **${r.value}**`,
    components: rows(),
  };
}

function buildSidesModal() {
  return new ModalBuilder()
    .setCustomId('dado:modal:sides')
    .setTitle('Dado personalizado dX')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dado:lados')
          .setLabel('Cantidad de caras (2 a 1.000.000)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(7)
          .setPlaceholder('20'),
      ),
    );
}

function buildRangeModal() {
  return new ModalBuilder()
    .setCustomId('dado:modal:range')
    .setTitle('Número al azar en un rango')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dado:min')
          .setLabel('Mínimo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(16)
          .setPlaceholder('1'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('dado:max')
          .setLabel('Máximo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(16)
          .setPlaceholder('100'),
      ),
    );
}

module.exports = {
  roll,
  rollRange,
  parseSides,
  parseRange,
  resultStandard,
  resultRange,
  buildView,
  buildSidesModal,
  buildRangeModal,
  TAG,
};
