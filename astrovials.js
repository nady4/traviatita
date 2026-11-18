const { createStockTracker } = require("./stockTracker");
const { roles } = require("./config");
const produccion = require("./produccion");
const { USER_AGENT, fetchText } = require("./utils/http");

const BASE = "https://astrovials.com";
const NOTIFY_ROLE_ID = roles.astrovials;
const TAG = "🚀 [astrovials]";

const PRODUCTS = [
  { slug: "estradiol-valerate-mct", label: "Valerato de estradiol (MCT)" },
  { slug: "estradiol-enanthate-mct", label: "Enantato de estradiol (MCT)" },
  { slug: "estradiol-enanthate-castor-oil", label: "Enantato de estradiol (Castor)" },
  { slug: "estradiol-undecylate-mct", label: "Undecilato de estradiol (MCT)" }
];

function priceStr(p) {
  return `${p.priceCents / 100} ${p.currency}`;
}

async function fetchProductPage(slug) {
  const url = `${BASE}/en/shop/${slug}`;
  const body = (
    await fetchText(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" }
    })
  ).replace(/\\"/g, '"');
  const re =
    /"productId":"[\da-f-]+","slug":"([\w-]+)","name":"([^"]+)","priceCents":(\d+),"currency":"([A-Z]+)","stock":(-?\d+)/g;

  for (const m of body.matchAll(re)) {
    if (m[1] === slug) {
      return {
        name: m[2],
        priceCents: Number(m[3]),
        currency: m[4],
        stock: Number(m[5])
      };
    }
  }

  throw new Error("payload de producto no encontrado");
}

const tracker = createStockTracker({
  tag: TAG,
  base: BASE,
  storeKey: "astrovials",
  storeFile: "astro.json",
  roleId: NOTIFY_ROLE_ID,
  products: PRODUCTS,
  title: "Astrovials",
  url: `${BASE}/en/shop`,
  productUrl: (p) => `${BASE}/en/shop/${p.slug}`,
  initialDelay: 45_000,
  fetchProduct: fetchProductPage,
  migrate: (raw) => {
    if (raw?.daily?.date) {
      produccion.mergeMax("astrovials", raw.daily.date, raw.daily.counts ?? {});
      produccion.flush();
      console.log(
        `${TAG} 📦 histórico diario migrado a produccion.json (${raw.daily.date})`
      );
    }
  },
  extraState: ({ prod }) => ({
    name: prod.name,
    price: priceStr(prod)
  }),
  changeLog: ({ tag, product, prod, prev }) =>
    `${tag} 🔔 ${product.label}: ${prev.inStock ? "🟢 → 🔴" : "🔴 → 🟢"} (${priceStr(prod)} · ${prod.stock} u.)`,
  firstLog: ({ tag, product, prod, inStock }) =>
    `${tag} ➕ ${product.label}: ${inStock ? "🟢" : "🔴"} (primera lectura) · ${priceStr(prod)}`
});

module.exports = {
  PRODUCTS,
  checkAll: tracker.checkAll,
  ensureData: tracker.ensureData,
  buildEmbed: tracker.buildEmbed,
  getProductState: tracker.getProductState,
  start: tracker.start
};
