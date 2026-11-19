/* The Android app's own copy of the game's web fonts (user: "I want the APK
   to be able to run the game completely with everything without having
   access to the internet."). The website asks Google Fonts for them; the
   app can't count on a connection, so it carries what Google sends for
   each of those requests: the stylesheet (the same @font-face rules, each
   letter range its own file) and the font files, in assets/fonts/app/:

     q-<key>.css   one request's stylesheet, its fonts beside it
                   (key: chassis/font-links.js fontKey of the request)
     *.woff2       the fonts, named for their family
     fonts.json    each key's request
     LICENSES.txt  each family's copyright and licence, from its own font
                   file, and the SIL Open Font License

   The requests are found in the built site (dist/): every Google Fonts
   link in the pages and scripts, and the families the corner menu and the
   Lab ask for as they go (strings beginning "family=": fontsHref()). Run
   again whenever a page asks for a font it didn't (tools/app_www.mjs stops
   and says so); it needs the internet, and fetches with the browser here,
   so Google sends what it sends a Chrome (WOFF2, by letter ranges).

     npm run build && node tools/app_fonts.mjs
     node tools/app_fonts.mjs --notes   (LICENSES.txt again, from the files) */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { brotliDecompressSync } from "zlib";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { fontKey, GOOGLE_FONTS_CSS } from "../chassis/font-links.js";

export const FONTS_DIR = new URL("../assets/fonts/app/", import.meta.url).pathname;
const DIST = new URL("../dist/", import.meta.url).pathname;

// Google Fonts links as they stand in a page or a script (not the ones a
// script makes from parts: those are fontsHref's).
export const GOOGLE_LINK = /https:\/\/fonts\.googleapis\.com\/css2\?([^"'`\s<>()\\]+)/g;
// The families asked for as the game goes, as strings of their own.
const FAMILIES = /["'`](family=[A-Z][^"'`\s<>()\\]*)["'`]/g;
const unescapeHtml = (s) => s.replace(/&amp;/g, "&");

/* Every request a file makes: [{ query, raw }], raw as it's written there
   (in a page, &amp;), query as it goes to Google. */
export function linkQueries(text, html) {
  const out = [];
  for (const m of text.matchAll(GOOGLE_LINK)) {
    if (m[1].startsWith("${")) continue;
    out.push({ raw: m[1], query: html ? unescapeHtml(m[1]) : m[1], at: m.index, length: m[0].length });
  }
  return out;
}
export function familyQueries(text) {
  return [...text.matchAll(FAMILIES)].map((m) => `${m[1]}&display=swap`);
}
// All the requests the site's (or the app's) files make.
export function siteQueries(dir) {
  const qs = new Set();
  for (const f of readdirSync(dir)) {
    if (!/\.(html|js|css)$/.test(f)) continue;
    const text = readFileSync(dir + f, "utf8"), html = f.endsWith(".html");
    for (const { query } of linkQueries(text, html)) qs.add(query);
    if (!html) for (const q of familyQueries(text)) qs.add(q);
  }
  return [...qs].sort();
}

/* A WOFF2 font's naming table: { 0: copyright, 1: family, 13: licence,
   14: licence URL, 16: typographic family }. */
const KNOWN_TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];
export function woff2Names(buf) {
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a WOFF2 font");
  const numTables = buf.readUInt16BE(12), compressed = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; } throw new Error("bad UIntBase128"); };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++], idx = flags & 0x3f, version = flags >> 6;
    let tag;
    if (idx === 63) { tag = buf.toString("latin1", p, p + 4); p += 4; } else tag = KNOWN_TAGS[idx];
    const orig = base128();
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : orig });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + compressed));
  let off = 0, name = null;
  for (const t of tables) { if (t.tag === "name") name = data.subarray(off, off + t.length); off += t.length; }
  if (!name) return {};
  const count = name.readUInt16BE(2), strings = name.readUInt16BE(4), names = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12, platform = name.readUInt16BE(r), id = name.readUInt16BE(r + 6), len = name.readUInt16BE(r + 8), at = strings + name.readUInt16BE(r + 10);
    const raw = name.subarray(at, at + len);
    let s;
    if (platform === 3 || platform === 0) { s = ""; for (let j = 0; j + 1 < raw.length; j += 2) s += String.fromCharCode(raw.readUInt16BE(j)); } else s = raw.toString("latin1");
    if (platform === 3 || !(id in names)) names[id] = s;
  }
  return names;
}

/* LICENSES.txt: each family's copyright and licence, as its font files
   give them (the naming table: copyright, licence, its address), and the
   licences' own text: the SIL Open Font License, the Apache License 2.0
   (Special Elite). */
export function writeNotes() {
  const families = new Map(); // family -> its font files
  for (const f of readdirSync(FONTS_DIR)) {
    if (!/^q-.*\.css$/.test(f)) continue;
    for (const b of readFileSync(FONTS_DIR + f, "utf8").match(/@font-face\s*\{[^}]*\}/g) || []) {
      const fam = (b.match(/font-family:\s*'([^']+)'/) || [])[1], file = (b.match(/url\(([^)]+\.woff2)\)/) || [])[1];
      if (fam && file) { if (!families.has(fam)) families.set(fam, new Set()); families.get(fam).add(file); }
    }
  }
  const one = (s) => (s || "").replace(/\s+/g, " ").trim();
  let notes = "The fonts in this folder are from Google Fonts (fonts.google.com), as\nGoogle sends them to a browser, kept here so the El Cabeza app shows its\nown type with no connection (tools/app_fonts.mjs). Each family's\ncopyright and licence, as its font files state them:\n\n";
  let apache = false;
  for (const [fam, set] of [...families].sort((a, b) => a[0].localeCompare(b[0]))) {
    const names = {};
    for (const file of set) { const n = woff2Names(readFileSync(FONTS_DIR + file)); for (const k of [0, 13, 14]) if (!names[k] && one(n[k])) names[k] = one(n[k]); }
    const url = names[14] || "", isApache = /apache/i.test(url + names[13] + names[0]);
    apache = apache || isApache;
    const licence = isApache ? "Apache License, Version 2.0 (below)" : /OFL|Open Font License/i.test(url + names[13]) ? "SIL Open Font License, Version 1.1 (below)" : names[13] || url;
    notes += `${fam}\n  ${names[0] || "(no copyright line in its files)"}\n  ${licence}${url ? ` ${url}` : ""}\n\n`;
  }
  const ofl = readFileSync(new URL("../assets/fonts/OFL-Fraunces.txt", import.meta.url), "utf8");
  notes += "-".repeat(72) + "\n\n" + ofl.slice(ofl.indexOf("SIL OPEN FONT LICENSE Version 1.1"));
  if (apache) {
    // (its text as Playwright, Apache-licensed too, carries it)
    const lic = readFileSync(new URL("../node_modules/playwright/LICENSE", import.meta.url), "utf8");
    notes += "\n" + "-".repeat(72) + "\n\n" + lic.slice(lic.indexOf("Apache License"), lic.indexOf("END OF TERMS AND CONDITIONS") + "END OF TERMS AND CONDITIONS".length).replace(/^ +/gm, (m) => m.slice(Math.min(m.length, 3))) + "\n";
  }
  writeFileSync(FONTS_DIR + "LICENSES.txt", notes);
  return families.size;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const queries = siteQueries(DIST);
  const keys = new Map();
  for (const q of queries) { const k = fontKey(q); if (keys.has(k) && keys.get(k) !== q) throw new Error(`two requests share the name q-${k}: ${q} / ${keys.get(k)}`); keys.set(k, q); }
  console.log(`${queries.length} requests for fonts in dist/`);

  const require = createRequire(new URL("../package.json", import.meta.url).pathname);
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: process.env.EC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  rmSync(FONTS_DIR, { recursive: true, force: true });
  mkdirSync(FONTS_DIR, { recursive: true });
  const files = new Map(); // font URL -> its name here
  const index = {};
  for (const [key, query] of [...keys].sort((a, b) => a[1].localeCompare(b[1]))) {
    const res = await page.goto(GOOGLE_FONTS_CSS + query);
    if (!res || !res.ok()) throw new Error(`Google Fonts said ${res ? res.status() : "nothing"} to ${query}`);
    let css = await res.text();
    if (!/format\('woff2'\)/.test(css)) throw new Error(`no WOFF2 for ${query}`);
    const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
    for (const b of blocks) {
      const fam = (b.match(/font-family:\s*'([^']+)'/) || [])[1] || "font";
      const url = (b.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/) || [])[1];
      if (!url || files.has(url)) continue;
      const name = `${slug(fam)}-${fontKey(url)}.woff2`;
      const r = await ctx.request.get(url);
      if (!r.ok()) throw new Error(`${r.status()} for ${url}`);
      const buf = Buffer.from(await r.body());
      writeFileSync(FONTS_DIR + name, buf);
      files.set(url, name);
    }
    css = css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (m, url) => `url(${files.get(url)})`);
    writeFileSync(FONTS_DIR + `q-${key}.css`, `/* ${query} (Google Fonts, for the app: tools/app_fonts.mjs) */\n${css}`);
    index[key] = query;
  }
  await browser.close();
  writeFileSync(FONTS_DIR + "fonts.json", JSON.stringify(index, null, 1) + "\n");

  writeNotes();
  let bytes = 0;
  for (const f of readdirSync(FONTS_DIR)) bytes += readFileSync(FONTS_DIR + f).length;
  console.log(`assets/fonts/app/: ${keys.size} stylesheets, ${files.size} fonts, ${(bytes / 1048576).toFixed(2)} MB`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--notes")) console.log(`LICENSES.txt: ${writeNotes()} families`);
  else {
    if (!existsSync(DIST + "el-cabeza-nova.html")) throw new Error("dist/ has no el-cabeza-nova.html: npm run build first");
    await main();
  }
}
