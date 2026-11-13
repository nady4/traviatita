const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '’',
  rsquo: '’',
  ldquo: '”',
  rdquo: '”',
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x';
      const num = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return match;
      return String.fromCodePoint(num);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function normalize(text) {
  return decodeEntities(text)
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToText(html) {
  return normalize(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
}

module.exports = { decodeEntities, normalize, htmlToText };
