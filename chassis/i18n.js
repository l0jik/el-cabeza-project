/* The game's languages: English, Spanish (Argentina) and Vietnamese (user:
   "Go ahead with the Argentine Spanish translation, sticking with the
   original plan to not include the videos or recorded voices ... I also
   want a Vietnamese translation included as well in the same fashion";
   the pick for choosing one: "For the language picker, go with 2 and 4",
   the device's language guessed, with an EN · ES · VI line under Begin
   on the title (apps/title-screen.js), and a language badge in the dock
   (chassis/LanguageBadge.jsx)). Text only: the videos and the recorded
   voices are as they were.

   The English is the key. Every line a player reads is looked up, by its
   English words, in the language's table (i18n/es.js, i18n/vi.js, each
   fetched only once its language is chosen); a line a table hasn't got
   shows in English. Most text needs nothing done for it: the pages' JSX
   runtime (chassis/i18n-jsx/jsx-runtime.js) passes every string an
   element shows through tr(), its text and its title, aria-label,
   placeholder and alt. A line made of parts (a number, a name in it) is
   written whole with its holes named, t("{side} to move", { side }), and
   is one line in the tables; text drawn into a canvas, or put in the page
   by hand, calls t() and is drawn again when the language changes
   (onLanguage).

   The language: ?lang= (en, es, vi; for that visit), else the one the
   player chose (kept), else the device's first one of these three
   (navigator.languages), else English. */
import { createElement, useEffect, useState } from "react";

export const LANGUAGES = [
  { code: "en", short: "EN", name: "English" },
  { code: "es", short: "ES", name: "Español", region: "Argentina" },
  { code: "vi", short: "VI", name: "Tiếng Việt" },
];
const CODES = LANGUAGES.map((l) => l.code);
const KEY = "el-cabeza:language";
const TABLES = { es: () => import("../i18n/es.js"), vi: () => import("../i18n/vi.js") };

// The device's language, if it's one of these (Spanish anywhere, any
// Vietnamese, else English).
export function deviceLanguage() {
  try {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const l of list) {
      const c = String(l).toLowerCase().split(/[-_]/)[0];
      if (CODES.includes(c)) return c;
    }
  } catch (e) { /* none said */ }
  return "en";
}

function firstChoice() {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (CODES.includes(q)) return q;
  } catch (e) { /* no address */ }
  try {
    const kept = window.localStorage.getItem(KEY);
    if (CODES.includes(kept)) return kept;
  } catch (e) { /* nothing kept */ }
  return deviceLanguage();
}

// A table's keys as the runtime meets them: runs of spaces and line breaks
// as one space (JSX text comes that way), no space at the ends.
const squeeze = (s) => s.replace(/\s+/g, " ").trim();
const loaded = {};
function load(code) {
  if (!TABLES[code]) return Promise.resolve(null);
  return (loaded[code] ||= TABLES[code]()
    .then((m) => new Map(Object.entries(m.default).map(([k, v]) => [squeeze(k), v])))
    .catch(() => { delete loaded[code]; return null; }));
}

let current = "en", table = null, wanted = "en";
const listeners = new Set();

export const language = () => current;
// (Nothing to look up in English: the runtime's quick way past.)
export const translating = () => table !== null;

/* A paragraph's sentences, each with the space after it: where a line
   that isn't in a table whole is looked up a sentence at a time (the
   rules join theirs). A sentence ends at . ! ? or … before a space. */
export function sentencesOf(s) {
  const out = [], re = /[.!?…]+["'’”)]*\s+/g;
  let from = 0, m;
  while ((m = re.exec(s))) { out.push(s.slice(from, m.index + m[0].length)); from = m.index + m[0].length; }
  if (from < s.length) out.push(s.slice(from));
  return out;
}

// One line or sentence: the table's words for it, the space at its ends
// kept (JSX text beside an element keeps it), or null.
function look(s) {
  const v = table.get(s);
  if (v !== undefined) return v;
  const k = squeeze(s);
  if (!k) return null;
  const w = k === s ? undefined : table.get(k);
  if (w === undefined) return null;
  return (/^\s/.test(s) ? " " : "") + w + (/\s$/.test(s) ? " " : "");
}

/* The line in the current language: the table's, else sentence by
   sentence, else the English as it came. */
let seen = new Map();
export function tr(s) {
  if (table === null || typeof s !== "string" || !s) return s;
  const whole = look(s);
  if (whole !== null) return whole;
  let v = seen.get(s);
  if (v !== undefined) return v;
  const parts = sentencesOf(s);
  v = s;
  if (parts.length > 1) {
    let any = false;
    v = parts.map((p) => { const w = look(p); if (w === null) return p; any = true; return /\s$/.test(w) || !/\s$/.test(p) ? w : w + p.match(/\s+$/)[0]; }).join("");
    if (!any) v = s;
  }
  if (seen.size > 5000) seen = new Map();
  seen.set(s, v);
  return v;
}

/* A word that reads two ways in English ("Play" a game, "Play" the music;
   a "Turn" of the game, "Turn" a piece round): the sense meant named for
   the tables, which have it as "Play [music]", else the word's own line.
   In English, just the word. */
export function trIn(s, sense) {
  if (table === null) return s;
  const v = look(`${s} [${sense}]`);
  return v !== null ? v : tr(s);
}

/* A whole line, its holes filled: t("{n} actions left", { n }). A hole's
   own words are looked up too (a side's name, a piece's). */
export function t(s, vars) {
  const line = tr(s);
  if (!vars) return line;
  return line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (typeof vars[k] === "string" ? tr(vars[k]) : String(vars[k])) : m));
}

/* A line with words set off in it, <b>…</b> (or <i>, <em>, <strong>):
   t()'s line as React's children, the marked words in their element. The
   tables keep the marks round the words their language sets off. */
export function rich(s, vars) {
  const line = t(s, vars), out = [], re = /<(b|i|em|strong)>([\s\S]*?)<\/\1>/g;
  let from = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > from) out.push(line.slice(from, m.index));
    out.push(createElement(m[1], { key: out.length }, m[2]));
    from = m.index + m[0].length;
  }
  if (from < line.length) out.push(line.slice(from));
  return out;
}

// "A, B and C" in the language: its own "and" and commas (each one's words
// looked up too; the English as the game always had it).
export function listOf(items) {
  const xs = items.filter(Boolean).map((x) => (typeof x === "string" ? tr(x) : String(x)));
  if (current !== "en") {
    try { return new Intl.ListFormat(current === "es" ? "es-AR" : current, { type: "conjunction" }).format(xs); } catch (e) { /* an older browser */ }
  }
  return xs.length < 2 ? xs[0] || "" : `${xs.slice(0, -1).join(", ")} ${tr("and")} ${xs[xs.length - 1]}`;
}

// Told each time the language changes (and given it).
export function onLanguage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let pending = Promise.resolve("en");
/* Chosen: its table fetched (if it's not English), then everything told.
   Kept for the next visit unless { keep: false }. A table that can't be
   had leaves the language as it was. */
export function setLanguage(code, { keep = true } = {}) {
  if (!CODES.includes(code)) return pending;
  if (keep) { try { window.localStorage.setItem(KEY, code); } catch (e) { /* this visit only */ } }
  wanted = code;
  pending = load(code).then((m) => {
    if (wanted !== code) return pending; // (a later choice wins)
    if (code !== "en" && !m) return current;
    const changed = code !== current;
    current = code;
    table = m;
    seen = new Map();
    try { document.documentElement.lang = code === "es" ? "es-AR" : code; } catch (e) { /* no page */ }
    if (changed) {
      listeners.forEach((fn) => { try { fn(code); } catch (e) { /* the others still told */ } });
      try { window.dispatchEvent(new CustomEvent("el-cabeza:language-changed", { detail: code })); } catch (e) { /* no page */ }
    }
    return code;
  });
  return pending;
}

// Settled: the language chosen and its table in (the pages mount after it,
// so no English shows first).
export const languageReady = () => pending;

// A component drawn again when the language changes; the language.
export function useLanguage() {
  const [code, setCode] = useState(current);
  useEffect(() => {
    if (code !== current) setCode(current);
    return onLanguage(setCode);
  }, []);
  return code;
}

/* The words the page is given by hand, not by React (the story's cards,
   the store's and the sphere's overlays, the corner menu's HTML): every
   text node and title, aria-label, placeholder and alt that React didn't
   make, in the language, as each comes and when the language changes.
   React's own are the JSX runtime's (chassis/i18n-jsx/jsx-runtime.js),
   so they're left to it. Each one's English is kept, to go back to. */
const ATTRS = ["title", "aria-label", "placeholder", "alt"];
const english = new WeakMap(); // node -> { en, out }, or element -> { [attr]: { en, out } }
const reacts = (el) => Object.keys(el).some((k) => k.startsWith("__reactFiber$"));
// (data-said: words a page put in the language itself, a word at a time
// as the ending reveals its lines; looked up again, they'd be looked up
// word by word.)
const leaveBe = (el) => !el || el.closest("script, style, textarea, input, [data-lang], [data-said], [contenteditable]") || reacts(el);

function sayText(n) {
  if (leaveBe(n.parentElement)) return;
  const v = n.nodeValue, kept = english.get(n);
  const en = kept && v === kept.out ? kept.en : v;
  const out = tr(en);
  english.set(n, { en, out });
  if (out !== v) n.nodeValue = out;
}
function sayAttrs(el) {
  if (leaveBe(el)) return;
  const kept = english.get(el) || {};
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v == null) continue;
    const en = kept[a] && v === kept[a].out ? kept[a].en : v;
    const out = tr(en);
    kept[a] = { en, out };
    if (out !== v) el.setAttribute(a, out);
  }
  english.set(el, kept);
}
function sayAll(root) {
  if (!root) return;
  if (root.nodeType === 3) { sayText(root); return; }
  if (root.nodeType !== 1) return;
  sayAttrs(root);
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) (n.nodeType === 3 ? sayText : sayAttrs)(n);
}
let watcher = null;
function watchPage() {
  if (typeof MutationObserver === "undefined" || !document.body) return;
  sayAll(document.body);
  if (table === null) { if (watcher) { watcher.disconnect(); watcher = null; } return; }
  if (watcher) return;
  watcher = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") sayText(m.target);
      else if (m.type === "attributes") sayAttrs(m.target);
      else m.addedNodes.forEach(sayAll);
    }
  });
  watcher.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

if (typeof window !== "undefined") {
  // (The pages' scripts are modules, run once the page is read: the body's
  // there to watch by the time the first language comes in.)
  onLanguage(() => watchPage());
  setLanguage(firstChoice(), { keep: false });
  // The title's line (apps/title-screen.js, not a module, so it says so).
  window.addEventListener("el-cabeza:language", (e) => { if (e && e.detail) setLanguage(e.detail); });
}
