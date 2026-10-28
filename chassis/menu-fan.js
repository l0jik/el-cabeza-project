/* The menu lab's fans: five revisions of its fourth version (user,
   2026-10-27: "I want 4 Fan, but I want to be able to spin / rotate the
   menu to access all settings, ultimately, fully replacing the button
   dock. Give me 5 revisions of this one, but incorporating all settings
   into a arc, semicircle, fan, rotatable menu selection. It needs to be
   intuitive and explanatory, yet simple to understand, and svelte.").

   Each holds everything the dock's panel holds, before a game, in play
   and after one (readDock), and turns: drag it round (it follows the
   finger about the piece), flick it, use the mouse wheel or the ‹ › at
   its read-out; it settles with a setting at its point, and the read-out
   above names that setting, says what it's set to and what it does.

     4.1 Dial: every setting on one wheel; a tap turns to it and changes it.
     4.2 Rings: the four kinds (Game, Board, Hints, Settings) on an inner
         ring round the piece, their settings on the turning ring outside;
         a kind tapped turns to its settings.
     4.3 Rail: a thin arc of named stops; the one turned to the top shows
         its own control in the read-out (choose, switch, open).
     4.4 Pages: one kind at a time fills the fan; it turns a page at once.
     4.5 Corner: a quarter fan in the bottom right, under the thumb; in
         play the piece stays in its corner.

   As the lab's first ten (menu-lab.js), every control presses the panel's
   own button, so all of it works as from the panel; the panel itself
   never opens (Online's own page aside, which lives in it).

   Then (user, of the five: "I like rings", and asked what next: "Replace
   the dock everywhere"): Rings is the dock's menu in every world, out
   from the piece (in a game, the corner piece) in place of the panel
   (fanMenu below, the chassis's; RINGS). */
import { t, LANGUAGES, language, setLanguage } from "./i18n.js";

/* ------------------------------------------------------------ geometry */

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
// Screen angles: 0 to the right, -90 straight up, clockwise as they grow.
const polar = (c, r, a) => ({ x: c.x + r * Math.cos(rad(a)), y: c.y + r * Math.sin(rad(a)) });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1d = (v) => Math.round(v * 10) / 10;
// v brought into [-T/2, T/2).
const wrap = (v, T) => ((((v + T / 2) % T) + T) % T) - T / 2;
const frames = (n = 2) => new Promise((done) => { const go = (k) => (k ? requestAnimationFrame(() => go(k - 1)) : done()); go(n); });
// A ring's slice from a0 to a1 degrees.
function sector(c, r0, r1, a0, a1) {
  const A = polar(c, r1, a0), B = polar(c, r1, a1), C = polar(c, r0, a1), D = polar(c, r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${r1d(A.x)} ${r1d(A.y)}A${r1} ${r1} 0 ${big} 1 ${r1d(B.x)} ${r1d(B.y)}L${r1d(C.x)} ${r1d(C.y)}A${r0} ${r0} 0 ${big} 0 ${r1d(D.x)} ${r1d(D.y)}Z`;
}
// A thin arc (the Rail's line, the place-marks).
function arcPath(c, r, a0, a1) {
  const A = polar(c, r, a0), B = polar(c, r, a1);
  return `M${r1d(A.x)} ${r1d(A.y)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${r1d(B.x)} ${r1d(B.y)}`;
}

/* --------------------------------------------------------------- the dom */

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "className") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids.filter((k) => k != null));
  return e;
}
function svgEl(tag, props = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(props)) if (v != null) e.setAttribute(k, v);
  return e;
}
function flash(node, cls, ms) {
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

/* --------------------------------------------------------------- icons */

const ICON = {
  play: '<path d="M8 5.2v13.6L18.6 12z" fill="currentColor" stroke="none"/>',
  first: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none"/>',
  human: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-4.1 3.8-6.3 7.2-6.3s6.3 2.2 7.2 6.3"/>',
  computer: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.8"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  online: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5M12 3.5C9.4 5.9 8.2 8.8 8.2 12s1.2 6.1 3.8 8.5"/>',
  check: '<path d="M12 3.5l7 2.6v5.2c0 4.3-3 7.6-7 9.2-4-1.6-7-4.9-7-9.2V6.1z"/><path d="M12 8.2v4.4M12 15.6v.1"/>',
  start: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M4 12h16M12 4v16"/>',
  half: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M4 12h16"/><path d="M5 13h14v6H5z" fill="currentColor" stroke="none" opacity=".35"/>',
  pieces: '<path d="M12 3.2l7.6 4.3v9L12 20.8l-7.6-4.3v-9z"/><path d="M4.4 7.5L12 11.8l7.6-4.3M12 11.8v9"/>',
  cart: '<path d="M2.8 4.5h2.4l2.2 10.3h10.1l2-7.4H6.3"/><circle cx="9.2" cy="18.6" r="1.4"/><circle cx="16.4" cy="18.6" r="1.4"/>',
  nova: '<path d="M12 3.8l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6l5.6-.6z"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  language: '<path d="M4 5h16v10H9.5L5 19v-4H4z"/><path d="M9.6 12.6L12 6.8l2.4 5.8M10.4 10.8h3.2"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4.2h4.2"/><path d="M10.6 9.3v5.4l4.2-2.7z" fill="currentColor" stroke="none"/>',
  saves: '<path d="M5 4h11.5L19 6.5V20H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  points: '<circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="2"/>',
  costs: '<path d="M4 12.5V5h7.5l8.5 8.5-7.5 7.5z"/><circle cx="8.3" cy="9.2" r="1.4"/>',
  guide: '<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M12 10.6v5M12 7.7v.1"/>',
  bar: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 15h17"/>',
  view: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  focus: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>',
  endturn: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  undo: '<path d="M9 6L4.5 10.5 9 15"/><path d="M5 10.5h9a5 5 0 0 1 0 10h-2"/>',
  endgame: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  movelog: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none"/>',
  plainrules: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M20 4.5v4.2h-4.2"/>',
  spark: '<path d="M12 3.5v4.5M12 16v4.5M3.5 12H8M16 12h4.5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
};
const bars = (n) => [[4.5, 13.5, 6], [10, 9.5, 10], [15.5, 5.5, 14]]
  .map(([x, y, h], i) => `<rect x="${x}" y="${y}" width="4" height="${h}" rx="1"${i < n ? ' fill="currentColor"' : ""}/>`).join("");
const iconOf = (name, level) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
  name === "level" ? bars(level || 1) : ICON[name] || ICON.spark}</svg>`;

/* ------------------------------------------------------- the dock, read */

// The four kinds, in their order round the fans.
export const KINDS = [
  { key: "game", name: "Game", tip: "Who you play, how hard, who starts." },
  { key: "board", name: "Board", tip: "The pieces, how they start, where you look from." },
  { key: "hints", name: "Hints", tip: "What the board shows to help you." },
  { key: "settings", name: "Settings", tip: "Sound, language, saves." },
];
const KIND_OF = {
  first: "game", opponent: "game", level: "game", endturn: "game", undomove: "game", undoturn: "game", endgame: "game", plainrules: "game",
  start: "board", half: "board", pieces: "board", nova: "board", cart: "board", view: "board", focus: "board", movelog: "board",
  check: "hints", points: "hints", costs: "hints", guide: "hints",
  sound: "settings", language: "settings", replay: "settings", saves: "settings", bar: "settings",
};
const NAMES = {
  first: "First move", opponent: "Opponent", level: "Level", check: "Check alert", start: "Start", half: "My half", cart: "Cart",
  sound: "Sound", language: "Language", replay: "Replay", saves: "Saves", points: "Actions left", costs: "Move costs",
  guide: "Piece guide", bar: "Control bar", view: "View", focus: "Focus", endturn: "End turn", undomove: "Undo move",
  undoturn: "Undo turn", endgame: "End game", movelog: "Move log", plainrules: "Plain rules",
};
// What each does, in a line.
const TIPS = {
  first: "Which side makes the first move. A tap switches it.",
  opponent: "Who you play: someone here with you, the computer, or someone online.",
  level: "How hard the computer plays.",
  check: "A warning when the computer could crush your Cabeza on its next turn.",
  start: "Standard: the set's own start. Manual: you place your pieces first.",
  half: "Your pieces may go anywhere up to the middle of the board.",
  cart: "Put a copy in your cart, then check out at the register.",
  sound: "The volume, and each kind of sound.",
  language: "The language the game speaks.",
  replay: "Replay a game from a copied move log.",
  saves: "Save your progress and settings to a file or the cloud, or bring them back.",
  points: "Dots that count the actions left in your turn.",
  costs: "Each move marker shows what the move costs.",
  guide: "A card that says what the chosen piece does.",
  bar: "Swap the floating piece for a bar of controls along the bottom.",
  view: "Where the camera looks from.",
  focus: "The room dims and the board stays lit.",
  endturn: "Finish your turn now, actions left or not.",
  undomove: "Take back your last move this turn.",
  undoturn: "Take back the last turn.",
  endgame: "Stop this game here.",
  movelog: "Every move of the game, in order.",
  plainrules: "The next game with the plain rules.",
};

/* Everything the dock's panel offers right now, as settings: { key, kind
   (of KINDS), name, value (what it's set to, in words), tip, icon, type
   (toggle: a tap flips it; choice: choose from choices; open: opens its
   own page; action: does a thing), disabled }, with the button each
   presses; and the line on top (whose move; after a game, how it ended)
   and the one big button (Begin, the store's Try a Game; New game). A
   button the panel holds back (a new player's first look, the computer
   thinking) is held back here. */
export function readDock(host, phase) {
  const panel = host.panel();
  if (!panel) return null;
  const one = (s) => panel.querySelector(s);
  const all = (s) => Array.from(panel.querySelectorAll(s));
  const words = (b) => (b ? b.textContent.replace(/[›▾▴]/g, "").replace(/\s+/g, " ").trim() : "");
  const off = (b) => !b || b.disabled || b.getAttribute("aria-disabled") === "true" || !!b.closest("[data-first-lock]");
  const lit = (b) => !!b && (b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true");
  const onOff = (v) => t(v ? "On" : "Off");
  const side = (s) => t(host.sideName(s));
  const items = [];
  const add = (key, it) => items.push({ key, kind: KIND_OF[key] || "board", name: t(NAMES[key] || key), tip: t(TIPS[key] || ""), value: "", ...it });

  const status = one('[data-testid="turn-status"]');
  let header = phase === "setup" ? "" : words(status);
  let primary = null;
  if (phase === "setup") {
    const begin = one('[data-dock-role="begin"]');
    // (The store's idle nudge lights its Try a Game, td-try-game:
    // tienda-overlay.js; this one lit the same.)
    if (begin) primary = { label: words(begin), disabled: off(begin), lit: begin.classList.contains("td-try-game"), press: () => begin.click() };
    if (status) {
      const s = status.getAttribute("data-side");
      add("first", { type: "toggle", value: side(s), alt: side(s === "dark" ? "light" : "dark"), icon: "first", disabled: status.getAttribute("role") !== "button", press: () => status.click() });
    }
  }
  if (phase === "over") {
    const cap = one('[data-testid="dock-caption"]');
    if (cap) header = words(cap);
    const ng = one('[data-testid="new-game"]');
    if (ng) primary = { label: words(ng), disabled: off(ng), press: () => ng.click() };
  }
  // The turn's own (in play End turn, Undo move; between turns Undo turn).
  for (const [key, id, icon] of [["endturn", "end-turn-dock", "endturn"], ["undomove", "undo-move-dock", "undo"], ["undoturn", "undo-turn", "undo"]]) {
    const b = one(`[data-testid="${id}"]`);
    if (b) add(key, { type: "action", name: words(b) || t(NAMES[key]), icon, disabled: off(b), press: () => b.click() });
  }

  // Who plays (the picker's buttons are out of the panel while Difficulty
  // has their place, or Online's own page: Back brings them first, from
  // Online's join page twice). A game hosted or joined online is left only
  // from its page (its Leave): the others held till then.
  const who = all("[data-opponent]"), back = one("[data-ec-diff-back]"), onlinePage = one('[data-testid="online-panel"]');
  if (who.length || back || onlinePage) {
    const ai = host.ai(), hosted = host.online(), onl = hosted || !!onlinePage;
    const cur = onl ? "online" : ai ? `ai-${ai}` : "human";
    const label = (k) => (k === "human" ? t("Human") : k === "online" ? t("Online") : `${t("AI")} · ${side(k === "ai-dark" ? "dark" : "light")}`);
    const choose = async (k) => {
      for (let i = 0; i < 3 && !panel.querySelector("[data-opponent]"); i++) {
        const b = panel.querySelector('[data-ec-diff-back], [data-testid="online-back"]');
        if (!b) break;
        b.click();
        await frames(2);
      }
      const b = panel.querySelector(`[data-opponent="${k}"]`);
      if (b && !off(b)) b.click();
    };
    add("opponent", {
      type: "choice", value: label(cur), icon: onl ? "online" : ai ? "computer" : "human", disabled: who.length ? who.every(off) : back ? off(back) : false,
      choices: ["human", "ai-dark", "ai-light", "online"].map((k) => ({ key: k, label: label(k), on: k === cur, disabled: hosted && k !== "online", pick: () => choose(k), opens: k === "online" })),
    });
  }
  const diffs = all("[data-ec-diff]");
  if (diffs.length) {
    const at = Math.max(0, diffs.findIndex(lit));
    add("level", {
      type: "choice", value: words(diffs[at]), icon: "level", level: at + 1, disabled: diffs.every(off),
      choices: diffs.map((b, i) => ({ key: b.getAttribute("data-ec-diff"), label: words(b), on: i === at, disabled: off(b), pick: () => b.click() })),
    });
  }
  const check = one('[data-testid="check-alert-setup"], [data-testid="check-alert-switch"]');
  if (check) add("check", { type: "toggle", value: onOff(lit(check)), on: lit(check), icon: "check", disabled: off(check), press: () => check.click() });

  // How the pieces start, the pieces themselves, the store's cart.
  const std = one('[data-testid="start-standard"]'), hand = one('[data-testid="start-by-hand"]');
  if (std && hand) {
    const now = lit(hand) ? hand : std;
    add("start", {
      type: "choice", value: words(now), icon: "start", disabled: off(std),
      choices: [std, hand].map((b) => ({ key: b.getAttribute("data-testid"), label: words(b), on: b === now, disabled: off(b), pick: () => b.click() })),
    });
  }
  const half = one('[data-testid="set-out-half-setup"]');
  if (half) add("half", { type: "toggle", value: onOff(lit(half)), on: lit(half), icon: "half", disabled: off(half), press: () => half.click() });
  const begin = one('[data-dock-role="begin"]');
  const beside = begin && begin.parentElement ? Array.from(begin.parentElement.children).filter((b) => b !== begin && b.tagName === "BUTTON") : [];
  for (const id of ["nova-again-setup", "nova-again"]) { const b = one(`[data-testid="${id}"]`); if (b) beside.push(b); }
  beside.forEach((b, i) => {
    const id = b.getAttribute("data-testid") || "";
    add(i ? `extra${i}` : "pieces", {
      kind: "board", type: "open", name: words(b), icon: id === "tienda-order-form" ? "pieces" : /nova/.test(id) ? "nova" : "spark",
      tip: b.getAttribute("title") ? t(b.getAttribute("title")) : "", disabled: off(b), press: () => b.click(),
    });
  });
  const buy = one('[data-testid="story-purchase"], [data-testid="story-go-home-confused"]');
  if (buy) {
    const [what, price] = words(buy).split(" · "), empty = buy.getAttribute("data-cart") === "empty";
    // (Into the cart the fan stays out, the button now Check out.)
    add("cart", { type: empty ? "action" : "open", value: empty ? price || what : what, icon: "cart", disabled: off(buy), keepOpen: empty, press: () => buy.click() });
  }

  // In play and after: where the camera looks from, Focus, ending it.
  const views = all('[data-dock-role="view"]');
  if (views.length) {
    const at = Math.max(0, views.findIndex(lit));
    add("view", {
      type: "choice", value: words(views[at]), icon: "view",
      choices: views.map((b, i) => ({ key: b.getAttribute("data-testid"), label: words(b), on: i === at, disabled: off(b), pick: () => b.click(), closes: true })),
    });
  }
  const focus = one('[data-testid="focus-switch"]');
  if (focus) add("focus", { type: "toggle", value: onOff(lit(focus)), on: lit(focus), icon: "focus", disabled: off(focus), press: () => focus.click() });
  const end = one('[data-testid="end-game"]');
  if (end) add("endgame", { type: "action", name: words(end), icon: "endgame", disabled: off(end), confirm: true, press: () => end.click() });
  for (const [key, id] of [["movelog", "move-log"], ["plainrules", "reset-rules"]]) {
    const b = one(`[data-testid="${id}"]`);
    if (b) add(key, { type: key === "movelog" ? "open" : "action", name: words(b), icon: key, disabled: off(b), keepOpen: key === "plainrules", press: () => b.click() });
  }

  // The panel's foot: sound, language, the links, the little switches.
  const sound = one('[data-testid="sound-button"]');
  if (sound) add("sound", { type: "open", icon: "sound", disabled: off(sound), press: () => sound.click() });
  const now = LANGUAGES.find((l) => l.code === language()) || LANGUAGES[0];
  add("language", {
    type: "choice", value: now.name, icon: "language",
    choices: LANGUAGES.map((l) => ({ key: l.code, label: l.name, on: l === now, pick: () => setLanguage(l.code) })),
  });
  for (const [key, id] of [["replay", "replay-link"], ["saves", "open-saves"]]) {
    const b = one(`[data-testid="${id}"]`);
    if (b) add(key, { type: "open", name: words(b), icon: key, disabled: off(b), press: () => b.click() });
  }
  for (const [key, id] of [["points", "points-toggle"], ["costs", "costs-toggle"], ["guide", "guide-toggle"]]) {
    const b = one(`[data-testid="${id}"]`);
    if (b) add(key, { type: "toggle", value: onOff(lit(b)), on: lit(b), icon: key, disabled: off(b), press: () => b.click() });
  }
  const bar = one('[data-testid="layout-toggle"]');
  if (bar) add("bar", { type: "action", icon: "bar", disabled: off(bar), press: () => bar.click() });

  const order = KINDS.map((k) => k.key);
  items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { phase, header, primary, items };
}

/* Before a fan reads the dock: after a game the next game's opponent is
   under the panel's Next game, opened; before one, with the computer
   picked, its Difficulty in place of the picker (the same pick again: no
   change). */
export async function prepareDock(host, phase) {
  const panel = host.panel();
  if (!panel) return;
  if (phase === "over") {
    const next = panel.querySelector('[data-testid="next-game"]');
    if (next && next.getAttribute("aria-expanded") !== "true") { next.click(); await frames(2); }
  }
  if (phase === "setup") {
    const ai = host.ai(), b = ai && panel.querySelector(`[data-opponent="ai-${ai}"]`);
    if (b && !b.disabled && !b.closest("[data-first-lock]")) { b.click(); await frames(2); }
  }
}

/* ------------------------------------------------------------ versions */

// The fan's outer edge: as wide as the screen allows, with the read-out's
// room above it.
const ringR1 = (vw, c) => clamp(Math.min(176, vw / 2 - 6, c.y - 214), 118, 176);
// Where the piece is while the fan's out: before a game where it is; in
// play and after, brought from its corner to the same place.
const centred = (scale = 0.84) => (phase, vw, vh, rest, home) => (phase === "setup"
  ? { shift: scale !== 1 ? { x: 0, y: 0, scale } : null, center: rest }
  : { shift: { centre: true, x: 0, y: 0, scale }, center: home });

export const FAN_VERSIONS = [
  {
    n: "4.1", id: "dial", name: "Dial", fan: true, form: "ring", tap: "turn",
    about: "Every setting on one wheel. Turn it; the read-out names the one at the top. A tap changes it.",
    place: centred(),
    geometry: (vw, vh, c) => { const r1 = ringR1(vw, c); return { r0: Math.round(r1 * 0.55), r1, win: [-180, 0], focus: -90, step: 36, layout: "uniform" }; },
  },
  {
    n: "4.2", id: "rings", name: "Rings", fan: true, form: "ring", tap: "turn", kinds: true,
    about: "The kinds on the inner ring, their settings on the turning ring outside. Tap a kind to turn to it.",
    place: centred(0.6),
    geometry: (vw, vh, c) => { const r1 = ringR1(vw, c); return { r0: 106, r1, inner: [62, 100], win: [-180, 0], focus: -90, step: 30, layout: "kinds" }; },
  },
  {
    n: "4.3", id: "rail", name: "Rail", fan: true, form: "rail", tap: "select",
    about: "A thin arc of settings. Slide them along; the one at the top shows its own control.",
    place: centred(),
    geometry: (vw, vh, c) => { const R = clamp(Math.min(150, vw / 2 - 48, c.y - 236), 96, 150); return { R, r0: R - 18, r1: R + 18, win: [-180, 0], focus: -90, step: 38, layout: "uniform" }; },
  },
  {
    n: "4.4", id: "pages", name: "Pages", fan: true, form: "ring", tap: "act", paged: true,
    about: "One kind of setting fills the fan at a time; it turns a page at once. A tap changes one.",
    place: centred(),
    geometry: (vw, vh, c) => { const r1 = ringR1(vw, c); return { r0: Math.round(r1 * 0.55), r1, win: [-180, 0], focus: -90, layout: "pages" }; },
  },
  {
    n: "4.5", id: "corner", name: "Corner", fan: true, form: "ring", tap: "turn", corner: true,
    about: "A quarter fan in the corner, under your thumb. Turn it; a tap changes the one you touch.",
    place: (phase, vw, vh, rest) => {
      if (phase !== "setup") return { shift: { raise: true }, center: rest };
      const at = { x: vw - 50, y: vh - 46 };
      return { shift: { x: Math.round(at.x - rest.x), y: Math.round(at.y - rest.y), scale: 0.5 }, center: at };
    },
    geometry: (vw, vh, c) => { const r1 = clamp(Math.min(178, vw - 120, c.y - 236), 120, 178); return { r0: 62, r1, win: [-180, -90], focus: -135, step: 28, layout: "uniform" }; },
  },
];

/* ---------------------------------------------------------------- style */

const CSS = `
.ml-back{position:fixed;inset:0;z-index:14;opacity:0;transition:opacity .32s ease;touch-action:none;-webkit-tap-highlight-color:transparent}
.ml-back.ml-on{opacity:1}
.ml-layer{position:fixed;inset:0;z-index:16;pointer-events:none;--ml-paper:#f4eedc;--ml-ink:#2a2018;--ml-line:#b8a68a;--ml-font:'IBM Plex Mono',ui-monospace,monospace;--ml-case:uppercase;font-family:var(--ml-font);color:var(--ml-ink)}
.ml-item{appearance:none;-webkit-appearance:none;box-sizing:border-box;border:0;margin:0;padding:0;font:inherit;color:var(--ml-ink);cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.ml-item:focus{outline:none}.ml-item:focus-visible{outline:2px solid var(--ml-ink);outline-offset:3px}
.ml-on .ml-item[aria-disabled="true"]{opacity:.4;cursor:default}
.ml-ico{display:flex;align-items:center;justify-content:center}.ml-ico svg{display:block;width:100%;height:100%}
.ml-item.ml-primary{background-color:var(--ml-pbg,var(--ml-ink));background-image:var(--ml-pimg,none);background-size:cover;background-position:center;color:var(--ml-pink,var(--ml-paper));text-shadow:var(--ml-pshadow,none)}
.ml-nudge{animation:mlNudge .36s ease}
@keyframes mlNudge{20%{translate:-4px 0}40%{translate:4px 0}60%{translate:-3px 0}80%{translate:2px 0}}
body.mf-quiet [data-testid="toggle-hint"]{display:none!important}
.mf-stage{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .28s ease;transform-origin:var(--hx) var(--hy)}
.ml-on .mf-stage{opacity:1}
.ml-off .mf-stage{opacity:0;transition-duration:.16s}
.mf-ring{position:fixed;left:0;top:0;overflow:visible;pointer-events:none}
.mf-labels{position:fixed;inset:0;pointer-events:none}
.mf-w{pointer-events:auto;cursor:grab;outline:none;touch-action:none;-webkit-tap-highlight-color:transparent}
.mf-w path{fill:color-mix(in srgb,var(--ml-paper) 93%,transparent);stroke:color-mix(in srgb,var(--ml-line) 80%,transparent);stroke-width:.9;transition:fill .18s ease,stroke .18s ease}
.mf-w.mf-focus path{fill:var(--ml-paper);stroke:var(--ml-ink);stroke-width:1.5}
.mf-w.mf-armed path{fill:color-mix(in srgb,#b3261e 22%,var(--ml-paper));stroke:#b3261e}
.mf-w:focus-visible path{stroke:var(--ml-ink);stroke-width:2.2}
.mf-kind{pointer-events:auto;cursor:pointer;touch-action:none}
.mf-kind path{fill:color-mix(in srgb,var(--ml-ink) 78%,transparent);stroke:color-mix(in srgb,var(--ml-paper) 30%,transparent);stroke-width:.8;transition:fill .2s ease}
.mf-kind.mf-on path{fill:var(--ml-ink)}
.mf-kind text{fill:var(--ml-paper);font-size:8.5px;letter-spacing:.12em;text-transform:var(--ml-case);font-family:var(--ml-font);text-anchor:middle;dominant-baseline:central;opacity:.72}
.mf-kind.mf-on text{opacity:1;font-weight:700}
.mf-track{fill:none;stroke:color-mix(in srgb,var(--ml-paper) 40%,transparent);stroke-width:1.5;stroke-linecap:round}
.mf-thumb{fill:none;stroke:var(--ml-paper);stroke-width:3;stroke-linecap:round}
.mf-railline{fill:none;stroke:color-mix(in srgb,var(--ml-paper) 70%,transparent);stroke-width:1.2;stroke-dasharray:2 5;stroke-linecap:round}
.mf-lab{position:fixed;left:0;top:0;width:var(--w,74px);display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;pointer-events:none;color:var(--ml-ink);font-family:var(--ml-font);font-size:9.5px;line-height:1.12;letter-spacing:.06em;text-transform:var(--ml-case);will-change:transform,opacity}
.mf-lab .mf-ico{width:17px;height:17px}.mf-lab .mf-ico svg{display:block;width:100%;height:100%}
.mf-lab .mf-name{max-width:100%;overflow-wrap:anywhere}
.mf-lab .mf-val{font-size:8.5px;opacity:.7;letter-spacing:.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0 2px;margin:-3px 0 -2px}
.mf-lab .mf-val.mf-yes,.mf-lab .mf-val.mf-no{display:inline-flex;align-items:center;gap:4px;opacity:.85}
.mf-lab .mf-val.mf-yes::before,.mf-lab .mf-val.mf-no::before{content:"";width:6px;height:6px;border-radius:50%;border:1.2px solid currentColor;box-sizing:border-box}
.mf-lab .mf-val.mf-yes::before{background:currentColor}
.mf-lab.mf-focus .mf-name{font-weight:700}
.mf-lab.mf-held{opacity:.4}
.mf-bead{position:fixed;left:0;top:0;width:80px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;border:0;background:none;font-family:var(--ml-font);pointer-events:auto;cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent;will-change:transform,opacity}
.mf-bead .mf-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ml-ink);background:color-mix(in srgb,var(--ml-paper) 94%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ml-line) 75%,transparent),0 5px 14px rgba(0,0,0,.28);transition:background .18s ease,color .18s ease,transform .22s ease}
.mf-bead .mf-ico{width:17px;height:17px}.mf-bead .mf-ico svg{display:block;width:100%;height:100%}
.mf-bead .mf-bn{max-width:80px;font-size:8.5px;line-height:1.15;letter-spacing:.08em;text-transform:var(--ml-case);text-align:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.5);overflow-wrap:anywhere}
.mf-bead.mf-focus .mf-dot{background:var(--ml-ink);color:var(--ml-paper);transform:scale(1.14)}
.mf-bead.mf-focus .mf-bn{font-weight:700}
.mf-bead[aria-disabled="true"] .mf-dot{opacity:.5}
.mf-bead:focus{outline:none}.mf-bead:focus-visible .mf-dot{outline:2px solid #fff;outline-offset:2px}
.mf-grip{fill:transparent;pointer-events:all;cursor:grab;touch-action:none}
.mf-stack{position:fixed;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;font-family:var(--ml-font);transform:translateY(10px);transition:transform .38s cubic-bezier(.34,1.4,.64,1) .1s}
.ml-on .mf-stack{transform:none}
.mf-stack.mf-right{align-items:flex-end}
.mf-head{font-size:10px;letter-spacing:.14em;text-transform:var(--ml-case);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.75);text-align:center;max-width:100%}
.mf-primary{pointer-events:auto;height:44px;padding:0 22px 0 8px;border-radius:999px;display:inline-flex;align-items:center;gap:10px;font-size:11.5px;letter-spacing:.14em;text-transform:var(--ml-case);box-shadow:0 0 0 1px rgba(0,0,0,.18),0 8px 22px rgba(0,0,0,.3)}
.mf-primary .mf-ico{width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center}
.mf-primary .mf-ico svg{width:15px;height:15px}
.mf-read{pointer-events:auto;box-sizing:border-box;max-width:100%;min-width:220px;display:grid;grid-template-columns:32px 1fr 32px;align-items:center;gap:2px;padding:6px 4px;border-radius:16px;color:var(--ml-ink);background:color-mix(in srgb,var(--ml-paper) 93%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ml-line) 70%,transparent),0 10px 26px rgba(0,0,0,.26)}
.mf-step{width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:system-ui,sans-serif}
.mf-step:hover{background:color-mix(in srgb,var(--ml-ink) 8%,transparent)}
.mf-step:focus{outline:none}.mf-step:focus-visible{outline:2px solid var(--ml-ink)}
.mf-mid{min-width:0;text-align:center;padding:2px 2px 3px}
.mf-title{font-size:10.5px;letter-spacing:.12em;text-transform:var(--ml-case);display:flex;gap:7px;justify-content:center;align-items:baseline;flex-wrap:wrap}
.mf-title b{font-weight:700}
.mf-title .mf-v{opacity:.75}
.mf-tip{font-family:'IBM Plex Sans',system-ui,sans-serif;font-style:italic;font-size:12.5px;line-height:1.3;margin-top:3px;opacity:.88;text-transform:none;letter-spacing:0}
.mf-tip.mf-warn{color:#9b1c14;opacity:1;font-style:normal;font-weight:600}
.mf-hint{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.5;margin-top:4px}
.mf-dots{display:flex;gap:5px;justify-content:center;margin-bottom:3px}
.mf-dots i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.25}.mf-dots i.mf-on{opacity:.9}
.mf-ctl{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}
.mf-chip{height:34px;min-width:44px;padding:0 13px;border-radius:999px;border:1px solid color-mix(in srgb,var(--ml-line) 95%,transparent);background:transparent;color:inherit;font-family:var(--ml-font);font-size:10.5px;letter-spacing:.08em;text-transform:var(--ml-case);cursor:pointer;white-space:nowrap}
.mf-chip[aria-pressed="true"],.mf-chip.mf-go{background:var(--ml-ink);color:var(--ml-paper);border-color:var(--ml-ink)}
.mf-chip[aria-disabled="true"]{opacity:.4;cursor:default}
.mf-chip:focus{outline:none}.mf-chip:focus-visible{outline:2px solid var(--ml-ink);outline-offset:2px}
.mf-pulse{animation:mfPulse .42s ease}
@keyframes mfPulse{35%{opacity:.55}}
@media (prefers-reduced-motion: reduce){.mf-stack{transition:none}}
`;
function addStyle() {
  if (document.getElementById("mf-style")) return;
  const s = document.createElement("style");
  s.id = "mf-style";
  s.textContent = CSS;
  document.head.append(s);
}

/* ------------------------------------------------------------- the fan */

/* A fan out round the piece, on the lab's layer. env: host (the lab's),
   layer, back (the lab's dimmed backdrop), center (the hub), vw, vh,
   phase, still (no spinning in: laid out again in place), lead (ms the
   piece takes to get there), close (the lab's, the fan away), keep (the
   turn to come back to, after a re-lay). Gives back key(e) (the lab's
   keys first to it), refresh(), turnNow() and dispose(). */
export function mountFan(v, env) {
  addStyle();
  const { host, layer, back, phase } = env;
  const c = env.center, vw = env.vw, vh = env.vh;
  const geo = v.geometry(vw, vh, c);
  const W = geo.win[1] - geo.win[0];
  const rail = v.form === "rail";
  // (where a wedge's label sits: a little out from its middle, more room)
  const labR = rail ? 0 : geo.r0 + (geo.r1 - geo.r0) * 0.53;
  let data = readDock(host, phase) || { header: "", primary: null, items: [] };
  let slots = [], snaps = [], T = 360, cyclic = false;
  let turn = 0, anim = 0, settleTimer = 0, sticky = null, armed = null, choosing = null, spun = false;
  let focusKey = null, focusPage = 0, gone = false;

  layer.style.setProperty("--hx", `${c.x}px`);
  layer.style.setProperty("--hy", `${c.y}px`);
  back.style.background = v.corner
    ? `radial-gradient(circle at ${c.x}px ${c.y}px, rgba(12,9,6,.34) 0, rgba(12,9,6,.5) ${geo.r1 + 40}px, rgba(12,9,6,.26) ${geo.r1 + 260}px)`
    : `radial-gradient(circle at ${c.x}px ${c.y}px, rgba(12,9,6,.14) 0, rgba(12,9,6,.14) ${geo.r0}px, rgba(12,9,6,.5) ${geo.r1 + 50}px, rgba(12,9,6,.58) ${geo.r1 + 300}px)`;

  const stage = el("div", { className: `mf-stage mf-${v.id}`, "data-testid": "menu-fan", "data-fan": v.id });
  const svg = svgEl("svg", { class: "mf-ring", width: vw, height: vh, viewBox: `0 0 ${vw} ${vh}` });
  const clipId = `mf-clip-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svgEl("defs"), clip = svgEl("clipPath", { id: clipId });
  clip.append(svgEl("rect", v.corner ? { x: 0, y: 0, width: c.x + 1, height: c.y + 1 } : { x: 0, y: 0, width: vw, height: c.y + 1 }));
  defs.append(clip);
  svg.append(defs);
  const gRing = svgEl("g", { "clip-path": `url(#${clipId})` });
  const gKinds = svgEl("g");
  const gMarks = svgEl("g");
  svg.append(gMarks, gRing, gKinds);
  const labels = el("div", { className: "mf-labels" });
  if (!rail) labels.style.clipPath = v.corner ? `inset(0 ${vw - c.x - 1}px ${vh - c.y - 1}px 0)` : `inset(0 0 ${vh - c.y - 1}px 0)`;
  stage.append(svg, labels);

  /* ---- the read-out, and above it the line and the big button ---- */
  const stack = el("div", { className: `mf-stack${v.corner ? " mf-right" : ""}`, "data-testid": "menu-fan-stack" });
  const head = el("div", { className: "mf-head", "data-testid": "menu-fan-head" });
  const primary = el("button", { type: "button", className: "ml-item ml-primary mf-primary", "data-testid": "menu-fan-primary" });
  const prev = el("button", { type: "button", className: "mf-step", "aria-label": t("Previous setting"), "data-testid": "menu-fan-prev" }, "‹");
  const next = el("button", { type: "button", className: "mf-step", "aria-label": t("Next setting"), "data-testid": "menu-fan-next" }, "›");
  const mid = el("div", { className: "mf-mid", "aria-live": "polite" });
  const read = el("div", { className: "mf-read", "data-testid": "menu-fan-read" }, prev, mid, next);
  stack.append(head, primary, read);
  stage.append(stack);
  layer.append(stage);
  const stackBottom = rail ? c.y - geo.R - 30 : c.y - geo.r1 - 14;
  const width = Math.min(vw - 20, v.corner ? 320 : 360);
  Object.assign(stack.style, v.corner
    ? { right: "10px", bottom: `${Math.round(vh - stackBottom)}px`, width: `${width}px` }
    : { left: `${Math.round(clamp(c.x - width / 2, 10, vw - 10 - width))}px`, bottom: `${Math.round(vh - stackBottom)}px`, width: `${width}px` });
  primary.addEventListener("click", () => {
    const p = data.primary;
    if (!p || p.disabled) { flash(primary, "ml-nudge", 380); return; }
    env.close();
    p.press();
  });
  prev.addEventListener("click", () => stepBy(-1));
  next.addEventListener("click", () => stepBy(1));

  function paintTop() {
    head.textContent = data.header || "";
    head.style.display = data.header ? "" : "none";
    const p = data.primary;
    primary.style.display = p ? "" : "none";
    primary.classList.toggle("td-try-game", !!(p && p.lit));
    if (p) {
      primary.innerHTML = `<span class="mf-ico">${iconOf("play")}</span><span>${escapeHtml(p.label)}</span>`;
      primary.setAttribute("aria-disabled", p.disabled ? "true" : "false");
    }
  }

  /* ---- the ring's slots ---- */
  function layout() {
    const items = data.items;
    slots = [];
    snaps = [];
    if (geo.layout === "pages") {
      const kinds = KINDS.filter((k) => items.some((i) => i.kind === k.key));
      kinds.forEach((k, g) => {
        const list = items.filter((i) => i.kind === k.key);
        list.forEach((it, j) => slots.push({ it, ra: g * W + ((j + 0.5) * W) / list.length, span: W / list.length, page: g }));
        snaps.push({ at: g * W + W / 2, page: g, kind: k });
      });
      T = Math.max(W, kinds.length * W);
    } else {
      let cursor = 0, was = null;
      for (const it of items) {
        if (geo.layout === "kinds" && was && it.kind !== was) cursor += geo.step * 0.45;
        slots.push({ it, ra: cursor + geo.step / 2, span: geo.step });
        snaps.push({ at: cursor + geo.step / 2, key: it.key });
        cursor += geo.step;
        was = it.kind;
      }
      if (geo.layout === "kinds" && cursor) cursor += geo.step * 0.45;
      T = Math.max(cursor, geo.step);
    }
    const span = Math.max(0, ...slots.map((s) => s.span));
    cyclic = T >= W + span - 0.01;
  }

  function build() {
    gRing.replaceChildren();
    labels.replaceChildren();
    gKinds.replaceChildren();
    gMarks.replaceChildren();
    const grip = rail ? [geo.R - 30, geo.R + 30] : [geo.r0, geo.r1];
    const g0 = svgEl("path", { class: "mf-grip", "data-mf-grip": "", d: sector(c, grip[0], grip[1], geo.win[0], geo.win[1]) });
    g0.addEventListener("pointerdown", (e) => startDrag(e, {}));
    gMarks.append(g0);
    for (const s of slots) {
      const it = s.it;
      if (rail) {
        const node = el("button", { type: "button", className: "mf-bead", "data-mf-key": it.key, "data-ml-item": it.key });
        node.innerHTML = `<span class="mf-dot"><span class="mf-ico">${iconOf(it.icon, it.level)}</span></span><span class="mf-bn">${escapeHtml(it.name)}</span>`;
        hold(node, s);
        labels.append(node);
        s.node = node;
      } else {
        const g = svgEl("g", { class: "mf-w", role: "button", tabindex: "-1", "data-mf-key": it.key, "data-ml-item": it.key });
        const gap = geo.layout === "pages" ? 1.6 : 2;
        g.append(svgEl("path", { d: sector(c, geo.r0, geo.r1, -s.span / 2 + gap / 2, s.span / 2 - gap / 2) }));
        hold(g, s);
        gRing.append(g);
        const lab = el("div", { className: "mf-lab", "data-ml-label": it.key }, el("span", { className: "mf-ico" }), el("span", { className: "mf-name" }), el("span", { className: "mf-val" }));
        const room = Math.min(geo.r1 - geo.r0 + 4, rad(s.span) * labR * 1.12 - 6);
        lab.style.setProperty("--w", `${Math.round(clamp(room, 54, 110))}px`);
        labels.append(lab);
        s.node = g;
        s.lab = lab;
      }
      paintSlot(s);
    }
    // The place-marks: where in the whole round the fan is (the Rail and
    // Pages say it their own ways).
    if (!rail && geo.layout !== "pages" && cyclic) {
      const rr = geo.r1 + 7;
      gMarks.append(svgEl("path", { class: "mf-track", d: arcPath(c, rr, geo.win[0] + 2, geo.win[1] - 2) }));
      gMarks.append(svgEl("path", { class: "mf-thumb", "data-mf-thumb": "" }));
    }
    if (rail) gMarks.append(svgEl("path", { class: "mf-railline", d: arcPath(c, geo.R, geo.win[0], geo.win[1]) }));
    // Rings: the four kinds round the piece; a kind tapped turns the outer
    // ring to its first setting.
    if (v.kinds) {
      const present = KINDS.filter((k) => slots.some((s) => s.it.kind === k.key));
      const span = W / Math.max(1, present.length);
      // (Its name's room: the chord across its piece of the ring.)
      const room = 2 * ((geo.inner[0] + geo.inner[1]) / 2) * Math.sin(rad(span / 2)) - 10;
      present.forEach((k, i) => {
        const a0 = geo.win[0] + i * span, a1 = a0 + span;
        const g = svgEl("g", { class: "mf-kind", role: "button", tabindex: "-1", "data-mf-kind": k.key });
        g.append(svgEl("path", { d: sector(c, geo.inner[0], geo.inner[1], a0 + 1, a1 - 1) }));
        const p = polar(c, (geo.inner[0] + geo.inner[1]) / 2, (a0 + a1) / 2);
        const txt = svgEl("text", { x: r1d(p.x), y: r1d(p.y), "data-room": r1d(room) });
        g.append(txt);
        g.addEventListener("pointerdown", (e) => startDrag(e, { kind: k.key }));
        gKinds.append(g);
        nameKind(g);
      });
    }
  }

  // A kind's name on the inner ring, in the language now; one longer than
  // its piece of the ring (CONFIGURACIÓN) closes its letters up, then
  // shrinks, to fit.
  function nameKind(g) {
    const k = KINDS.find((x) => x.key === g.getAttribute("data-mf-kind"));
    const txt = g.querySelector("text");
    if (!k || !txt) return;
    g.setAttribute("aria-label", t(k.name));
    txt.textContent = t(k.name);
    txt.style.letterSpacing = "";
    txt.style.fontSize = "";
    const room = +txt.getAttribute("data-room");
    const n = txt.textContent.length;
    const len = (guess) => { let w = 0; try { w = txt.getComputedTextLength(); } catch (e) { /* not drawn */ } return w || guess; };
    const w = len(n * 8.5 * 0.62 + (n - 1) * 8.5 * 0.12);
    if (w <= room) return;
    txt.style.letterSpacing = ".02em";
    const w2 = len(n * 8.5 * 0.62 + (n - 1) * 8.5 * 0.02);
    if (w2 > room) txt.style.fontSize = `${Math.max(6.5, (8.5 * room) / w2).toFixed(2)}px`;
  }

  function paintSlot(s) {
    const it = s.it;
    const held = !!it.disabled;
    if (rail) {
      s.node.setAttribute("aria-label", `${it.name}${it.value ? `: ${it.value}` : ""}`);
      s.node.setAttribute("aria-disabled", held ? "true" : "false");
      s.node.querySelector(".mf-ico").innerHTML = iconOf(it.icon, it.level);
      s.node.querySelector(".mf-bn").textContent = it.name;
      return;
    }
    s.node.setAttribute("aria-label", `${it.name}${it.value ? `: ${it.value}` : ""}`);
    s.node.setAttribute("aria-disabled", held ? "true" : "false");
    const [ico, name, val] = s.lab.children;
    ico.innerHTML = iconOf(it.icon, it.level);
    name.textContent = it.name;
    val.textContent = it.value || "";
    val.className = `mf-val${it.type === "toggle" && it.on !== undefined ? (it.on ? " mf-yes" : " mf-no") : ""}`;
    s.lab.classList.toggle("mf-held", held);
  }

  /* ---- where each slot is, for the turn now ---- */
  function screenOf(s) {
    const d = cyclic ? wrap(s.ra - turn, T) : s.ra - turn;
    return geo.focus + d;
  }
  function render() {
    const [a0, a1] = geo.win;
    let best = null, bestD = Infinity;
    for (const s of slots) {
      const a = screenOf(s);
      const inner = Math.min(a - a0, a1 - a);
      const vis = clamp((inner + s.span * 0.5) / (s.span * 0.75), 0, 1);
      s.angle = a;
      s.vis = vis;
      const live = vis > 0.55;
      const d = Math.abs(a - geo.focus);
      if (live && d < bestD) { bestD = d; best = s; }
      if (rail) {
        const p = polar(c, geo.R, a);
        s.node.style.transform = `translate(${r1d(p.x - 40)}px, ${r1d(p.y - 18)}px)`;
        s.node.style.opacity = vis.toFixed(3);
        s.node.style.pointerEvents = live ? "auto" : "none";
        s.node.style.visibility = vis < 0.02 ? "hidden" : "";
      } else {
        s.node.setAttribute("transform", `rotate(${r1d(a)} ${r1d(c.x)} ${r1d(c.y)})`);
        s.node.setAttribute("opacity", vis.toFixed(3));
        s.node.style.pointerEvents = live ? "auto" : "none";
        s.node.style.visibility = vis < 0.02 ? "hidden" : "";
        const p = polar(c, labR, a);
        s.lab.style.transform = `translate(${r1d(p.x)}px, ${r1d(p.y)}px) translate(-50%, -50%)`;
        s.lab.style.opacity = (vis * (s.it.disabled ? 0.45 : 1)).toFixed(3);
        s.lab.style.visibility = vis < 0.02 ? "hidden" : "";
      }
    }
    // The place-marks' thumb: this window's share of the whole round.
    const thumb = gMarks.querySelector("[data-mf-thumb]");
    if (thumb && snaps.length) {
      const share = clamp(W / T, 0.08, 1), len = W * share;
      const frac = ((((turn - snaps[0].at) % T) + T) % T) / T;
      const mid = geo.win[0] + len / 2 + (W - len) * frac;
      thumb.setAttribute("d", arcPath(c, geo.r1 + 7, mid - len / 2, mid + len / 2));
    }
    // The focus: the setting at the fan's point (Pages: the page).
    if (geo.layout === "pages") {
      const page = nearestSnap(turn).page;
      if (page !== focusPage) { focusPage = page; if (!sticky) say(); }
    } else {
      const key = best ? best.it.key : null;
      if (key !== focusKey) {
        focusKey = key;
        for (const s of slots) { s.node.classList.toggle("mf-focus", s.it.key === key); if (s.lab) s.lab.classList.toggle("mf-focus", s.it.key === key); }
        if (!sticky) say();
        if (spun && navigator.vibrate) { try { navigator.vibrate(4); } catch (e) { /* none */ } }
      }
    }
    if (v.kinds) {
      const k = focusKey && (slots.find((s) => s.it.key === focusKey) || {}).it;
      gKinds.querySelectorAll(".mf-kind").forEach((g) => g.classList.toggle("mf-on", !!k && g.getAttribute("data-mf-kind") === k.kind));
    }
  }

  /* ---- turning ---- */
  function nearestSnap(at) {
    let best = snaps[0], bestD = Infinity;
    for (const s of snaps) {
      const d = cyclic ? Math.abs(wrap(s.at - at, T)) : Math.abs(s.at - at);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best || { at: 0 };
  }
  // A snap's turn nearest the turn now (round the wheel the short way).
  const near = (target) => (cyclic ? turn + wrap(target - turn, T) : target);
  function bounds(v2) {
    if (cyclic || !snaps.length) return v2;
    const lo = snaps[0].at, hi = snaps[snaps.length - 1].at;
    return v2 < lo ? lo - Math.min(30, (lo - v2) * 0.35) : v2 > hi ? hi + Math.min(30, (v2 - hi) * 0.35) : v2;
  }
  function stop() { cancelAnimationFrame(anim); anim = 0; clearTimeout(settleTimer); }
  const turning = (on) => stage.setAttribute("data-turning", on ? "true" : "false");
  function turnTo(target, { dur, back: overshoot = false } = {}) {
    stop();
    const from = turn, to = near(target);
    const ms = dur || clamp(Math.abs(to - from) * 5, 200, 620);
    const t0 = performance.now();
    turning(true);
    const ease = overshoot
      ? (x) => { const s = 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); }
      : (x) => 1 - Math.pow(1 - x, 3);
    const tick = (now) => {
      const x = clamp((now - t0) / ms, 0, 1);
      turn = from + (to - from) * ease(x);
      render();
      if (x < 1) anim = requestAnimationFrame(tick);
      else { anim = 0; turn = cyclic ? ((to % T) + T) % T : to; render(); turning(false); }
    };
    anim = requestAnimationFrame(tick);
  }
  function settle(velocity = 0) {
    if (!snaps.length) return;
    const ahead = turn + velocity * 200;
    let target = nearestSnap(ahead).at;
    // (a flick goes on to the next stop at least)
    if (Math.abs(velocity) > 0.22) {
      const here = nearestSnap(turn).at;
      if (Math.abs(near(target) - near(here)) < 0.5) target = stepFrom(here, Math.sign(velocity));
    }
    turnTo(target);
  }
  function stepFrom(at, dir) {
    if (!snaps.length) return at;
    const i = snaps.findIndex((s) => Math.abs(s.at - at) < 0.5);
    const j = cyclic ? (((i + dir) % snaps.length) + snaps.length) % snaps.length : clamp(i + dir, 0, snaps.length - 1);
    return snaps[j].at;
  }
  function stepBy(dir) {
    spun = true;
    sticky = null;
    closeChoice();
    turnTo(stepFrom(nearestSnap(turn).at, dir));
  }

  /* ---- a finger (or mouse) on the fan: a drag turns it, a tap acts ---- */
  let drag = null;
  function hold(node, s) {
    node.addEventListener("pointerdown", (e) => startDrag(e, { slot: s }));
    node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapSlot(s); } });
  }
  const angleAt = (e) => deg(Math.atan2(e.clientY - c.y, e.clientX - c.x));
  function startDrag(e, what) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stop();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: angleAt(e), turn0: turn, moved: false, what, log: [[performance.now(), turn]] };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
    if (!drag.moved) { drag.moved = true; spun = true; sticky = null; closeChoice(); disarm(); turning(true); }
    const a = angleAt(e);
    const da = wrap(a - drag.a, 360);
    drag.a = a;
    // (the fan's settings go round with the finger)
    turn = bounds(turn - da);
    const now = performance.now();
    drag.log.push([now, turn]);
    while (drag.log.length > 2 && now - drag.log[0][0] > 90) drag.log.shift();
    render();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
    const d = drag;
    drag = null;
    if (!d.moved) {
      if (snaps.length && Math.abs(near(nearestSnap(turn).at) - turn) > 0.5) settle(0);
      else turning(false);
      if (d.what.slot) tapSlot(d.what.slot);
      else if (d.what.kind) tapKind(d.what.kind);
      return;
    }
    const [t0, v0] = d.log[0], [t1, v1] = d.log[d.log.length - 1];
    const vel = t1 > t0 ? (v1 - v0) / (t1 - t0) : 0;
    settle(clamp(vel, -1.2, 1.2));
  }
  function onWheel(e) {
    e.preventDefault();
    stop();
    spun = true;
    sticky = null;
    closeChoice();
    turn = bounds(turn + clamp(e.deltaY || e.deltaX, -80, 80) * 0.35);
    turning(true);
    render();
    settleTimer = setTimeout(() => settle(0), 160);
  }
  window.addEventListener("wheel", onWheel, { passive: false });
  // A finger on the fan turns it, never the page: the browser's own pan is
  // stopped as the touch starts (touch-action alone isn't kept on an SVG
  // shape everywhere, and a pan begun cancels the drag after one move).
  const onTouch = (e) => {
    const tg = e.target;
    if (tg && tg.closest && stage.contains(tg) && tg.closest(".mf-w, .mf-grip, .mf-bead, .mf-kind")) e.preventDefault();
  };
  document.addEventListener("touchstart", onTouch, { passive: false });
  // A language chosen (its words load after the pick): read again in it.
  const onLanguage = () => frames(2).then(() => {
    prev.setAttribute("aria-label", t("Previous setting"));
    next.setAttribute("aria-label", t("Next setting"));
    refresh();
  });
  window.addEventListener("el-cabeza:language-changed", onLanguage);

  function tapKind(kind) {
    const s = snaps.find((x) => slots.find((y) => y.it.key === x.key && y.it.kind === kind));
    if (s) { spun = true; sticky = null; closeChoice(); turnTo(s.at); }
  }

  /* ---- a setting tapped ---- */
  function tapSlot(s) {
    const it = s.it;
    // Rail: a tap brings it to the top, where its own control is.
    if (v.tap === "select") { spun = true; sticky = null; closeChoice(); turnTo(nearestFor(it.key)); return; }
    if (v.tap === "turn" && it.type !== "open") turnTo(nearestFor(it.key));
    act(it, s);
  }
  const nearestFor = (key) => { const sn = snaps.find((x) => x.key === key); return sn ? sn.at : turn; };

  function act(it, s) {
    if (it.disabled) {
      if (s) flash(s.lab || s.node, "mf-pulse", 420);
      tell(it, t("Not available right now."), true);
      return;
    }
    if (it.type === "choice") { openChoice(it); return; }
    if (it.confirm && armed !== it.key) {
      disarm();
      armed = it.key;
      if (s) s.node.classList.add("mf-armed");
      tell(it, t("Tap it again to be sure."), true);
      setTimeout(() => { if (armed === it.key) disarm(); }, 3200);
      return;
    }
    disarm();
    if (it.type === "open" || (it.type === "action" && !it.keepOpen)) {
      env.close();
      it.press();
      return;
    }
    it.press();
    if (s) flash(s.lab || s.node, "mf-pulse", 420);
    frames(2).then(() => { refresh(); tell(find(it.key) || it); });
  }
  function disarm() {
    if (!armed) return;
    const s = slots.find((x) => x.it.key === armed);
    if (s) s.node.classList.remove("mf-armed");
    armed = null;
  }
  const find = (key) => (data.items.find((i) => i.key === key) || null);

  /* ---- the read-out ---- */
  // What's at the point (Pages: what's on the page), unless something's
  // just been tapped (sticky: it says what happened, a few seconds).
  function say() {
    if (choosing) return;
    if (geo.layout === "pages") {
      const sn = snaps.find((x) => x.page === focusPage);
      const kind = sn ? sn.kind : KINDS[0];
      const dots = `<div class="mf-dots">${snaps.map((x) => `<i class="${x.page === focusPage ? "mf-on" : ""}"></i>`).join("")}</div>`;
      mid.innerHTML = `${dots}<div class="mf-title"><b>${escapeHtml(t(kind.name))}</b></div><div class="mf-tip">${escapeHtml(t(kind.tip))}</div>${spun ? "" : `<div class="mf-hint">${escapeHtml(t("Turn the page ‹ ›"))}</div>`}`;
      return;
    }
    const it = find(focusKey);
    if (!it) { mid.innerHTML = ""; return; }
    mid.innerHTML = title(it) + `<div class="mf-tip">${escapeHtml(it.tip || "")}</div>`;
    if (rail) mid.append(control(it));
    if (!spun) mid.insertAdjacentHTML("beforeend", `<div class="mf-hint">${escapeHtml(t(rail ? "Slide it along" : "Turn it for more"))}</div>`);
  }
  const title = (it) => `<div class="mf-title"><b>${escapeHtml(it.name)}</b>${it.value ? `<span class="mf-v">${escapeHtml(it.value)}</span>` : ""}</div>`;
  // Something tapped: its name, now, and what it does (or why not).
  function tell(it, note, warn = false) {
    clearTimeout(sticky);
    choosing = null;
    mid.innerHTML = title(it) + `<div class="mf-tip${warn ? " mf-warn" : ""}">${escapeHtml(note || it.tip || "")}</div>`;
    if (rail) mid.append(control(it));
    sticky = setTimeout(() => { sticky = null; say(); }, 2600);
  }
  // The choices of a setting, in the read-out.
  function openChoice(it) {
    clearTimeout(sticky);
    sticky = null;
    choosing = it.key;
    mid.innerHTML = title(it) + `<div class="mf-tip">${escapeHtml(it.tip || "")}</div>`;
    mid.append(control(it));
  }
  function closeChoice() {
    if (!choosing) return;
    choosing = null;
    say();
  }
  // A setting's own control: its choices, its switch, or its button.
  function control(it) {
    const box = el("div", { className: "mf-ctl", role: "group", "aria-label": it.name, "data-testid": "menu-fan-ctl" });
    const chip = (label, on, fn, extra = {}) => {
      const b = el("button", { type: "button", className: `mf-chip${extra.go ? " mf-go" : ""}`, "aria-pressed": on == null ? null : String(!!on), "data-mf-choice": extra.key || null }, label);
      if (extra.held || it.disabled) b.setAttribute("aria-disabled", "true");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (extra.held || it.disabled) { flash(b, "ml-nudge", 380); return; }
        fn(b);
      });
      box.append(b);
      return b;
    };
    if (it.type === "choice") {
      for (const ch of it.choices) {
        chip(ch.label, ch.on, async (b) => {
          box.querySelectorAll(".mf-chip").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
          await ch.pick();
          if (ch.opens) { env.close(); host.openPanel(); return; }
          if (ch.closes) { env.close(); return; }
          await frames(2);
          refresh();
          if (!rail) { choosing = null; tell(find(it.key) || it); }
        }, { key: ch.key, held: ch.disabled });
      }
    } else if (it.type === "toggle") {
      const ways = it.alt ? [[it.value, true], [it.alt, false]] : [[t("On"), !!it.on], [t("Off"), !it.on]];
      for (const [label, now] of ways) {
        chip(label, now, (b) => {
          if (now) { flash(b, "mf-pulse", 420); return; }
          act(it, slots.find((s) => s.it.key === it.key));
        }, { key: now ? "toggle-now" : "toggle" });
      }
    } else {
      chip(it.type === "open" ? `${t("Open")} ›` : it.name, null, () => act(it, slots.find((s) => s.it.key === it.key)), { key: "go", go: true });
    }
    return box;
  }

  /* ---- the dock read again (after a tap; a language changed) ---- */
  function refresh() {
    if (gone) return;
    const fresh = readDock(host, phase);
    if (!fresh) return;
    const same = fresh.items.map((i) => i.key).join() === data.items.map((i) => i.key).join();
    data = fresh;
    paintTop();
    if (same) {
      slots.forEach((s, i) => { s.it = data.items[i]; paintSlot(s); });
      gKinds.querySelectorAll(".mf-kind").forEach(nameKind);
    } else {
      const keep = focusKey;
      layout();
      build();
      const sn = snaps.find((x) => x.key === keep);
      turn = sn ? sn.at : snaps.length ? snaps[0].at : 0;
      focusKey = null;
    }
    render();
    if (!sticky && !choosing) say();
  }

  /* ---- opening: it turns into place ---- */
  paintTop();
  layout();
  build();
  const start = env.keep != null ? env.keep : snaps.length ? snaps[0].at : 0;
  if (env.still) { turn = start; render(); say(); turning(false); }
  else {
    turning(true);
    turn = start + (geo.layout === "pages" ? W * 0.32 : (geo.step || 30) * 1.6);
    render();
    say();
    settleTimer = setTimeout(() => turnTo(start, { dur: 720, back: true }), Math.max(0, env.lead || 0) + 60);
  }

  return {
    key(e) {
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowUp") { stepBy(-1); return true; }
      if (k === "ArrowRight" || k === "ArrowDown") { stepBy(1); return true; }
      if ((k === "Enter" || k === " ") && geo.layout !== "pages") { const s = slots.find((x) => x.it.key === focusKey); if (s) { if (rail) act(s.it, s); else tapSlot(s); } return true; }
      if (k === "Escape" && choosing) { closeChoice(); return true; }
      return false;
    },
    refresh,
    turnNow: () => (snaps.length ? nearestSnap(turn).at : null),
    dispose() {
      gone = true;
      stop();
      clearTimeout(sticky);
      window.removeEventListener("wheel", onWheel, { passive: false });
      document.removeEventListener("touchstart", onTouch, { passive: false });
      window.removeEventListener("el-cabeza:language-changed", onLanguage);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    },
  };
}

/* ------------------------------------------------ the fan, on the page */

// The one the dock opens (the user's pick of the five: 4.2 Rings).
export const RINGS = FAN_VERSIONS.find((v) => v.id === "rings");

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

/* The world's colours and face on a menu's layer: the panel's paper and
   ink (host.colors), and the face, case and colours of its Begin (the
   store's Try a Game wears the wood). */
export function dress(layer, host) {
  const c = host.colors || {};
  const set = (k, v) => { if (v) layer.style.setProperty(k, v); };
  set("--ml-paper", c.paper); set("--ml-ink", c.ink); set("--ml-line", c.line);
  const panel = host.panel(), begin = panel && panel.querySelector('[data-dock-role="begin"]');
  if (!begin) return;
  const cs = getComputedStyle(begin);
  set("--ml-font", cs.fontFamily); set("--ml-case", cs.textTransform);
  const clear = /^transparent$|rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor);
  const img = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : null;
  if (clear && !img) return;
  set("--ml-pbg", cs.backgroundColor); set("--ml-pimg", img); set("--ml-pink", cs.color);
  set("--ml-pshadow", cs.textShadow && cs.textShadow !== "none" ? cs.textShadow : null);
}

/* A fan out from the dock's piece, and away again (the dock's own menu,
   ElCabeza3D; the menu lab's fans): a backdrop over the game (a tap on it
   puts the fan away), the fan on a layer above the piece, the piece where
   the version wants it, its keys, laid out again on a resize; told the
   game's phase and whether it may open (update). host: panel() the dock's
   panel, piece() the piece's box, openPanel(), shift(s) to move the piece
   ({ x, y, scale }; centre: from its corner to where it waits before a
   game; raise: up in its corner; null: back), home() (that waiting
   place's middle), sideName(side), ai(), online(), markSeen() (the corner
   piece's call after a game answered), colors, sounds { open, close },
   and onOpen(open) (told as it opens and as it closes). testid: the
   layer's. Gives back open(v), close(), toggle(v) (false when it isn't for
   now: the piece not showing, the control bar), update({ ready, shell,
   phase }), isOpen(), version(), setShift(s) and restAt() (the piece's
   place, for the lab's own menus), dispose(). */
export function fanMenu(host, { testid = "dock-menu" } = {}) {
  addStyle();
  let ready = false, shell = false, phase = "setup";
  let menu = null, rest = null, shifted = null, shiftedAt = 0, size = null, relayout = 0, quiet = 0, silent = false;
  const sound = (which) => { if (silent) return; try { if (host.sounds && host.sounds[which]) host.sounds[which](); } catch (e) { /* audio not started */ } };
  const told = (open) => { if (!silent && host.onOpen) host.onOpen(open); };

  function setShift(sh) {
    if (JSON.stringify(sh) === JSON.stringify(shifted)) return;
    shifted = sh;
    shiftedAt = performance.now();
    host.shift(sh);
  }
  // Where the piece rests (its middle): measured while it's there (before
  // a game the big piece; in play, the corner one).
  function restAt() {
    if (!shifted && performance.now() - shiftedAt > 600) {
      const p = host.piece(), r = p && p.getBoundingClientRect();
      if (r && r.width > 0) rest = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return rest || { x: window.innerWidth / 2, y: window.innerHeight - 118 };
  }

  /* Out: the piece where the version has it (in play and after, brought
     out of its corner, or raised in it), the dock read (after a game the
     next game's opponent opened in it first), then the fan. */
  function open(v, { still = false, keep = null } = {}) {
    if (menu) close({ now: true });
    const vw = window.innerWidth, vh = window.innerHeight;
    size = { vw, vh };
    const home = host.home ? host.home() : { x: vw / 2, y: vh - 118 };
    const { shift, center } = v.place(phase, vw, vh, restAt(), home);
    setShift(shift);
    const layer = el("div", { className: `ml-layer ml-v-${v.id}`, "data-testid": testid, "data-version": v.n, "data-phase": phase, "data-open": "true" });
    const back = el("div", { className: "ml-back", "data-testid": `${testid}-back` });
    dress(layer, host);
    back.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    document.body.append(back, layer);
    const m = { v, layer, back, fan: null };
    menu = m;
    if (still || reduced()) layer.classList.add("ml-still");
    requestAnimationFrame(() => { if (menu === m) back.classList.add("ml-on"); });
    if (phase === "over" && host.markSeen) host.markSeen();
    const lead = shift && !shift.raise && !still ? 300 : 0;
    prepareDock(host, phase).then(() => {
      if (menu !== m) return;
      m.fan = mountFan(v, { host, layer, back, center, vw, vh, phase, still, keep, lead, close: () => close() });
      void layer.offsetWidth;
      requestAnimationFrame(() => { if (menu === m) layer.classList.add("ml-on"); });
    });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    // (The panel's switch notes point at the panel: not while it's this.)
    clearTimeout(quiet);
    document.body.classList.add("mf-quiet");
    if (!still) sound("open");
    told(true);
    return true;
  }

  function close({ now = false } = {}) {
    const m = menu;
    if (!m) return;
    menu = null;
    if (m.fan) m.fan.dispose();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    setShift(null);
    m.layer.setAttribute("data-open", "false");
    if (now || reduced()) { m.layer.remove(); m.back.remove(); }
    else {
      m.layer.classList.remove("ml-on");
      m.layer.classList.add("ml-off");
      m.back.classList.remove("ml-on");
      setTimeout(() => { m.layer.remove(); m.back.remove(); }, 260);
    }
    clearTimeout(quiet);
    quiet = setTimeout(() => document.body.classList.remove("mf-quiet"), 4600);
    if (!now) sound("close");
    told(false);
  }

  function onKey(e) {
    if (!menu) return;
    if (menu.fan && menu.fan.key(e)) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }
  /* The page resized under it (on a phone, the first tap's full screen):
     laid out again where it is, turned as it was. The piece rests
     centred, its foot on the bottom, so where it rests moves with the
     page. */
  function onResize() {
    cancelAnimationFrame(relayout);
    relayout = requestAnimationFrame(() => {
      if (!menu || !size) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw === size.vw && vh === size.vh) return;
      if (rest) rest = { x: rest.x + (vw - size.vw) / 2, y: rest.y + (vh - size.vh) };
      const v = menu.v, keep = menu.fan ? menu.fan.turnNow() : null;
      silent = true;
      try { close({ now: true }); open(v, { still: true, keep }); } finally { silent = false; }
    });
  }

  return {
    open,
    close: (o) => close(o),
    // A tap on the piece: out, or away again. False when it's not for now.
    toggle(v) {
      if (menu) { close(); return true; }
      if (!ready || shell) return false;
      return open(v);
    },
    update(st) {
      ready = !!st.ready;
      shell = !!st.shell;
      const was = phase;
      phase = st.phase || "setup";
      if (menu && (!ready || phase !== was)) close();
    },
    isOpen: () => !!menu,
    version: () => (menu ? menu.v : null),
    setShift,
    restAt,
    // (The page resized under a menu of the lab's own: its rest moves too.)
    moveRest(dx, dy) { if (rest) rest = { x: rest.x + dx, y: rest.y + dy }; },
    dispose() {
      close({ now: true });
      clearTimeout(quiet);
      document.body.classList.remove("mf-quiet");
    },
  };
}

const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
