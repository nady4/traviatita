const config = require("./config");
const { create } = require("./store");

const TAG = "🐦 [tweets]";
const HANDLE = "traviatitatan";
const PROFILE_URL = `https://x.com/${HANDLE}`;
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;
const MAX_SEEN = 100;
const DROP_CODES = new Set([10003, 10008, 50001, 50013]);
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const STORE = create("tweets.json", TAG);
let state = loadState();
let running = false;

function loadState() {
  const raw = STORE.load({});
  return {
    pending: Array.isArray(raw.pending) ? raw.pending : [],
    seen: Array.isArray(raw.seen) ? raw.seen : []
  };
}

function saveState() {
  STORE.save(state);
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "’",
  rsquo: "’",
  ldquo: "”",
  rdquo: "”"
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const num = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return match;
      return String.fromCodePoint(num);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function normalize(text) {
  return decodeEntities(text)
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html) {
  return normalize(
    html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  );
}

function extractTweets(html) {
  const marker = `data-href="/${HANDLE}/status/`;
  const positions = [];
  for (let i = html.indexOf(marker); i !== -1; i = html.indexOf(marker, i + 1)) {
    positions.push(i);
  }

  const found = new Set();
  const tweets = [];

  for (let i = 0; i < positions.length; i++) {
    const chunk = html.slice(positions[i], positions[i + 1] ?? html.length);
    const id = chunk.match(/status\/(\d+)/)?.[1];
    if (!id || found.has(id)) continue;
    found.add(id);

    const timestamp = chunk.match(/"timestamp":(\d{13})/)?.[1];
    const textHtml = chunk.match(
      /<div[^>]*class="[^"]*whitespace-pre-wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/
    )?.[1];

    tweets.push({
      id,
      createdAt: timestamp ? Number(timestamp) : null,
      text: textHtml ? htmlToText(textHtml) : null
    });
  }

  return tweets;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "es-AR,es;q=0.9,en;q=0.8",
        "cache-control": "no-cache"
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTweet(id) {
  const html = await fetchHtml(`${PROFILE_URL}/status/${id}`);
  const tag = html.match(
    /<meta[^>]+property="og:description"[^>]*>/i
  )?.[0];
  const content = tag?.match(/content="([^"]*)"/i)?.[1];
  const timestamp = html.match(/"timestamp":(\d{13})/)?.[1];

  return {
    text: content ? normalize(content) : null,
    createdAt: timestamp ? Number(timestamp) : null
  };
}

function markSeen(id) {
  if (!state.seen.includes(id)) state.seen.push(id);
  if (state.seen.length > MAX_SEEN) {
    state.seen.splice(0, state.seen.length - MAX_SEEN);
  }
}

function cleanupPending() {
  const cutoff = Date.now() - PENDING_TTL_MS;
  const before = state.pending.length;
  state.pending = state.pending.filter((entry) => entry.createdAt >= cutoff);
  const removed = before - state.pending.length;
  if (removed > 0) {
    console.log(`${TAG} 🧹 ${removed} pendientes vencidos`);
  }
  return removed > 0;
}

function track({ messageId, channelId, authorId, text }) {
  state.pending.push({
    messageId,
    channelId,
    authorId,
    text,
    createdAt: Date.now()
  });
  cleanupPending();
  saveState();
}

function findPending(text, createdAt) {
  if (!text || createdAt == null) return null;
  const normalized = normalize(text);
  return state.pending.find(
    (entry) =>
      normalize(entry.text) === normalized &&
      createdAt >= entry.createdAt - CLOCK_SKEW_MS
  );
}

async function sendReply(client, pending, tweetId) {
  const url = `${PROFILE_URL}/status/${tweetId}`;
  try {
    const channel = await client.channels.fetch(pending.channelId);
    if (!channel?.isTextBased()) {
      throw Object.assign(new Error("canal inválido"), { code: 10003 });
    }
    const message = await channel.messages.fetch(pending.messageId);
    await message.reply({
      content: `<@${pending.authorId}> 🐦 Ya se publicó: ${url}`,
      allowedMentions: { users: [pending.authorId] }
    });
    console.log(`${TAG} ✅ ${url}`);
    return "sent";
  } catch (err) {
    console.error(
      `${TAG} ⚠️ no pude responder al mensaje ${pending.messageId}:`,
      err.message
    );
    return DROP_CODES.has(err.code) ? "drop" : "retry";
  }
}

async function check(client) {
  if (running) return;

  const cleaned = cleanupPending();
  if (state.pending.length === 0) {
    if (cleaned) saveState();
    return;
  }

  running = true;
  try {
    const html = await fetchHtml(PROFILE_URL);
    const tweets = extractTweets(html);
    if (tweets.length === 0) {
      throw new Error("no encontré tweets en el perfil");
    }

    const oldestPending = Math.min(
      ...state.pending.map((entry) => entry.createdAt)
    );
    const candidates = tweets
      .filter((tweet) => !state.seen.includes(tweet.id))
      .filter(
        (tweet) =>
          tweet.createdAt == null ||
          tweet.createdAt >= oldestPending - CLOCK_SKEW_MS
      )
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    let changed = cleaned;

    for (const tweet of candidates) {
      let text = tweet.text;
      let createdAt = tweet.createdAt;
      let fetched = false;

      if (!text) {
        const details = await fetchTweet(tweet.id).catch(() => null);
        fetched = true;
        if (!details) continue;
        text = details.text;
        createdAt = createdAt ?? details.createdAt;
      }
      if (!text) continue;

      let pending = findPending(text, createdAt);

      if (!pending && !fetched) {
        const details = await fetchTweet(tweet.id).catch(() => null);
        if (details) {
          pending = findPending(details.text, createdAt ?? details.createdAt);
        }
      }

      if (!pending) {
        markSeen(tweet.id);
        changed = true;
        continue;
      }

      const result = await sendReply(client, pending, tweet.id);
      if (result === "retry") continue;

      markSeen(tweet.id);
      state.pending = state.pending.filter((entry) => entry !== pending);
      changed = true;
    }

    if (changed) saveState();
  } finally {
    running = false;
  }
}

function start(client) {
  const minutes = config.tweetCheckMinutes;
  const run = () =>
    check(client).catch((err) => console.error(`${TAG} ⚠️`, err.message));

  setTimeout(run, 30_000);
  setInterval(run, minutes * 60_000);

  console.log(
    `${TAG} ✅ chequeo de @${HANDLE} cada ${minutes} min (solo con mensajes pendientes)`
  );
}

module.exports = { check, extractTweets, normalize, start, track };
