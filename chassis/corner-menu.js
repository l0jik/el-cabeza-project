/* The corner menu (user: "a consistent upper-left corner hidden menu ...
   each should render in a thematically appropriate way for each world";
   from the mock-ups, "move forward with the corner menus as illustrated").
   One menu, the same contents and behaviour everywhere, each world's own
   look: closed, a tab at the top left with a line summing the game up;
   open, a card with the game's laws and their settings, each side's
   pieces (what isn't the standard set marked), the board, and a way into
   the rules (the user's choice of contents: "laws including their
   sub-settings, pieces, board").

   React-free: the game's rules as data (gameRules), and each look's
   markup and CSS (cornerMenuParts), drawn by chassis/CornerMenu.jsx. The
   Theme Lab's read-out shows the same data its own way (themes/lab/
   hud.js). The looks are the mock-ups' (scratch cornermenu/cm.js, the
   sheets the user approved). */

import { ACTIVE_LAWS, BOARD_ROWS, BOARD_COLS } from "../engine/constants.js";
import { PIECE_OPTIONS } from "../themes/rules-selections.js";
import { shoveFromLaws, shoveChosen } from "./shove-settings.js";

/* ------------------------------------------------------------ the data */

// The standard game's pieces, each side.
const STANDARD = { cabeza: 1, turrito: 1, flaco: 1, chato: 1, opa: 1 };
const ORDER = PIECE_OPTIONS.map((p) => p.key);
const NAMES = Object.fromEntries(PIECE_OPTIONS.map((p) => [p.key, p.name]));

/* The game as it's being played: the laws on (as the setup menus name
   them and their settings), each side's pieces, the board. Read from the
   engine (the laws, the board's size) and the board itself (the pieces,
   missing squares, black holes), so it's right however the game began:
   a menu, a replay, a carried game. Pieces are counted on the board, the
   most either side has of each kind (a crushed Cabeza doesn't make it
   one fewer). */
export function gameRules(pieces = [], missing = [], holes = []) {
  const A = ACTIVE_LAWS, laws = [];
  if (A.slide) laws.push({ key: "slide", name: "Orthogonal slide" });
  if (A.diagonalSlide) laws.push({ key: "diagonalSlide", name: "Diagonal slide" });
  // (Black hole squares: a law to the engine, but listed with the board
  // below, as the menus set them.)
  // (Shoving's settings, both, in the chassis's words: chassis/shove-settings.js.)
  if (A.shoving) laws.push({ key: "shoving", name: "Shoving", sets: shoveChosen(shoveFromLaws(A)) });
  if (A.cantileverPivot) laws.push({ key: "cantileverPivot", name: "Cantilever pivot" });
  if (A.splitMovement) laws.push({ key: A.splitThree ? "splitThree" : "splitMovement", name: "Split movement", sets: [["Pieces", A.splitThree ? "Up to 3" : "Up to 2"], ["Actions", A.splitThree || A.threeActions ? "3 a turn" : "2 a turn"]] });
  else if (A.threeActions) laws.push({ key: "threeActions", name: "3 actions per turn" });
  if (A.punto) laws.push({ key: "punto", name: "Punto (komi)" });

  const most = {};
  for (const owner of ["light", "dark"]) {
    const n = {};
    pieces.forEach((p) => { if (p.owner === owner) n[p.type] = (n[p.type] || 0) + 1; });
    Object.entries(n).forEach(([t, c]) => { most[t] = Math.max(most[t] || 0, c); });
  }
  const types = [...ORDER.filter((t) => most[t] || STANDARD[t]), ...Object.keys(most).filter((t) => !ORDER.includes(t))];
  const list = types.map((t) => ({ type: t, name: NAMES[t] || t.charAt(0).toUpperCase() + t.slice(1), count: most[t] || 0, std: STANDARD[t] || 0 }));
  const perSide = list.reduce((s, p) => s + p.count, 0);
  const rows = BOARD_ROWS, cols = BOARD_COLS, pairs = Math.floor((missing || []).length / 2), holePairs = Math.floor((holes || []).length / 2);
  const board = { rows, cols, label: `${cols} × ${rows}`, missing: missing || [], holes: holes || [], pairs, holePairs, anyExit: holePairs > 1 && !!A.holeAnyExit };
  const standard = !laws.length && list.every((p) => p.count === p.std) && rows === 10 && cols === 10 && !pairs && !holePairs;
  const r = { laws, pieces: list, perSide, board, standard };
  // (The line that sums it up, plainly: a theme's own read-out has it.)
  r.summary = sums.plain(r);
  return r;
}

/* ------------------------------------------------------------ the looks */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const word = (n) => WORDS[n] || String(n);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const two = (n) => String(n).padStart(2, "0");

// The line on the tab, in each look's way of putting it.
const sums = {
  plain: (r) => (r.standard ? `Standard game · ${r.board.label}` : `${r.laws.length ? plural(r.laws.length, "law") : "No laws"} · ${plural(r.perSide, "piece")} · ${r.board.label}`),
  short: (r) => (r.standard ? `Standard · ${r.board.cols}×${r.board.rows}` : `${r.laws.length ? plural(r.laws.length, "law") : "No laws"} · ${r.board.cols}×${r.board.rows}`),
};

// The card's insides, the same everywhere (each look's own labels and marks).
function card(r, L, extra) {
  const laws = r.laws.length
    ? r.laws.map((l) => `<li class="cm-law"><button type="button" class="cm-name" data-cm="law" data-law="${esc(l.key)}" data-testid="corner-menu-law-${esc(l.key)}">${esc(l.name)}</button>${(l.sets || []).map(([k, v]) => `<span class="cm-set"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></span>`).join("")}</li>`).join("")
    : `<li class="cm-law cm-none"><span class="cm-name">${esc(L.noLaws || "None: the standard rules")}</span></li>`;
  const pieces = r.pieces.map((p) => `<li class="cm-pc${p.count !== p.std ? " changed" : ""}"><span class="n">${esc(p.name)}</span><span class="c">${L.count ? L.count(p.count) : p.count}</span></li>`).join("");
  // (Two sets of black holes: where a piece that goes in may come out.)
  const rows = [["Size", r.board.label], ...(r.board.pairs ? [["Missing squares", plural(r.board.pairs, "pair")]] : []), ...(r.board.holePairs ? [["Singularities", plural(r.board.holePairs, "set")]] : []),
    ...(r.board.holePairs > 1 ? [["Singularity exits", r.board.anyExit ? "Any other singularity" : "The other half"]] : [])];
  const board = rows.map(([k, v]) => `<li class="cm-bd"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></li>`).join("");
  const go = extra ? `<button type="button" class="go cm-extra" data-cm="extra" data-testid="corner-menu-extra">${esc(extra.label)}</button>` : "";
  return `${L.head || ""}
    <section class="cm-sec cm-laws"><h4>${L.laws(r)}</h4><ul>${laws}</ul></section>
    <section class="cm-sec cm-pieces"><h4>${L.pieces(r)}</h4><ul>${pieces}</ul>${L.piecesExtra ? L.piecesExtra(r) : ""}</section>
    <section class="cm-sec cm-board"><h4>${L.board(r)}</h4><ul>${board}</ul>${L.boardExtra ? L.boardExtra(r) : ""}</section>
    ${go}${L.foot(r)}`;
}
const rulesLink = (label) => `<button type="button" class="go" data-cm="rules" data-testid="corner-menu-rules">${label}</button>`;

// Plano's plan of the board: missing squares crossed, black holes ringed.
function plan(r) {
  const { rows: R, cols: C } = r.board, key = ({ row, col }) => `${row},${col}`;
  const M = new Set(r.board.missing.map(key)), H = new Set(r.board.holes.map(key));
  let cells = "";
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const k = `${i},${j}`; cells += `<i class="${M.has(k) ? "x" : H.has(k) ? "o" : ""}"></i>`; }
  const legend = [`${C} across`, `${R} rows`, ...(M.size ? ["✕ missing"] : []), ...(H.size ? ["◯ singularity"] : [])].join(" · ");
  return `<div class="mini" aria-hidden="true" style="grid-template-columns: repeat(${C}, 9px)">${cells}</div><span class="dim">${legend}</span>`;
}

const BASE = `
  .cm { position: fixed; top: max(14px, env(safe-area-inset-top, 0px)); left: max(14px, env(safe-area-inset-left, 0px)); z-index: 40;
    display: flex; flex-direction: column; align-items: flex-start; gap: 10px; transition: opacity 0.6s ease; }
  html.ec-shell .cm { top: calc(var(--ec-shell-top, 60px) + 6px); left: 12px; }
  .cm * { box-sizing: border-box; }
  .cm button { all: unset; box-sizing: border-box; cursor: pointer; }
  /* The tab at 60% till it's wanted (user: "Dim the circled buttons ...
     a tap or hover before a click on a mouse will raise them 100% again";
     CornerMenu.jsx and raise-on-tap.js): a mouse over it, a first tap on a
     touch screen ([data-raised]), the card open or a key's focus raise it. */
  .cm .cm-tab { display: flex; align-items: center; opacity: 0.6; transition: opacity 0.18s ease; }
  .cm[data-raised="true"] .cm-tab, .cm[data-open="true"] .cm-tab, .cm .cm-tab:focus-visible { opacity: 1; }
  @media (hover: hover) { .cm .cm-tab:hover { opacity: 1; } }
  .cm button:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
  .cm .cm-card { width: 304px; max-width: calc(100vw - 28px); max-height: calc(100vh - 96px); overflow-y: auto; overscroll-behavior: contain; }
  html.ec-shell .cm .cm-card { max-height: calc(100vh - var(--ec-shell-top, 60px) - var(--ec-shell-bottom, 120px) - 70px); }
  .cm ul { list-style: none; margin: 0; padding: 0; }
  .cm h4 { margin: 0; }
  .cm .cm-law { display: flex; flex-direction: column; align-items: flex-start; }
  .cm .cm-law .cm-name:hover { text-decoration: underline dotted; text-underline-offset: 3px; }
  .cm .cm-set { display: flex; gap: 6px; align-items: baseline; }
  .cm .cm-pieces ul { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
  .cm .cm-pc, .cm .cm-bd { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .cm .cm-bd .v { text-align: right; } /* (a long one, "Any other singularity", wraps flush right) */
  .cm .cm-extra { display: block; margin-top: 10px; text-decoration: underline; }
  /* The den's lights down (focus mode): it dims with the room until it's opened. */
  html.ec-lights-down .cm:not([data-open="true"]):not([data-raised="true"]) { opacity: 0.3; }
  @media (hover: hover) { html.ec-lights-down .cm:not([data-open="true"]):hover { opacity: 0.9; } }
  /* The check alert (a Cabeza in danger) comes first: where its card, or
     the chip that calls it back, would sit over the tab, the tab steps
     aside until it's gone. */
  @media (max-width: 1000px) { body:has([data-testid="check-alert"]) .cm:not([data-open="true"]) { opacity: 0; pointer-events: none; } }
  @media (max-width: 680px) { body:has([data-testid="check-alert-recall"]) .cm:not([data-open="true"]) { opacity: 0; pointer-events: none; } }
  @media (prefers-reduced-motion: reduce) { .cm, .cm .cm-tab { transition: none; } }
`;

export const LOOKS = {
  /* The den, 1975: the house rules on one of the den's own cards (cream,
     the decade's four stripes, Caprasimo, a hard brown shadow, a little
     askance). */
  den: {
    fonts: "family=Caprasimo&family=Libre+Franklin:wght@500;600;700;800",
    tab: (r) => `<span class="stripes"><i></i><i></i><i></i><i></i></span><span class="t">House rules</span><span class="s">${esc(sums.plain(r))}</span>`,
    L: {
      head: `<span class="stripes"><i></i><i></i><i></i><i></i></span><div class="hd"><span class="kick">Tonight's game</span><h3>House Rules</h3></div>`,
      laws: () => "The laws", pieces: () => "Each side's pieces", board: () => "The board",
      noLaws: "None tonight: the standard game",
      foot: () => `<div class="ft"><span><span class="mark">●</span> not in the standard set</span>${rulesLink("The rules ›")}</div>`,
    },
    css: `
    .cm-den { --ink:#4A2A14; --rust:#B4451F; --mus:#E9B23A; --cream:#F3E6C4; --mut:#7A5B3F; color: var(--ink); }
    .cm-den .stripes { display:flex; height:8px; } .cm-den .stripes i { flex:1; } .cm-den .stripes i:nth-child(1){background:#6B3A1E} .cm-den .stripes i:nth-child(2){background:#B4451F} .cm-den .stripes i:nth-child(3){background:#E07B22} .cm-den .stripes i:nth-child(4){background:#E9B23A}
    .cm-den .cm-tab { flex-direction:column; align-items:flex-start; gap:4px; padding:0 14px 9px; background:var(--cream); border:2.5px solid var(--ink); border-radius:12px; box-shadow:4px 5px 0 var(--ink); transform:rotate(-2deg); overflow:hidden; }
    .cm-den .cm-tab .stripes { width:calc(100% + 28px); margin:0 -14px 5px; }
    .cm-den .cm-tab .t { font:400 18px/1 'Caprasimo', Georgia, serif; color:var(--ink); }
    .cm-den .cm-tab .s { font:700 9.5px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--rust); }
    .cm-den .cm-card { background:var(--cream); border:3px solid var(--ink); border-radius:16px; box-shadow:6px 7px 0 var(--ink), 0 14px 30px rgba(20,10,4,.45); color:var(--ink); padding:0 20px 14px; transform:rotate(-1deg); margin-left:4px; }
    .cm-den .cm-card > .stripes { height:12px; margin:0 -20px 12px; }
    .cm-den .kick { display:block; font:700 10px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.18em; text-transform:uppercase; color:var(--rust); }
    .cm-den h3 { margin:5px 0 8px; font:400 28px/1 'Caprasimo', Georgia, serif; color:var(--ink); }
    .cm-den h4 { font:400 16px/1.1 'Caprasimo', Georgia, serif; color:var(--rust); margin:12px 0 6px; padding-bottom:4px; border-bottom:2px dotted rgba(74,42,20,.35); }
    .cm-den .cm-name { font:700 14px/1.3 'Libre Franklin', Arial, sans-serif; }
    .cm-den .cm-law { padding:3px 0; }
    .cm-den .cm-set { font:500 12px/1.35 'Libre Franklin', Arial, sans-serif; color:var(--mut); padding-left:12px; }
    .cm-den .cm-set .k::after { content:":"; } .cm-den .cm-set .v { color:var(--rust); font-weight:700; }
    .cm-den .cm-pc, .cm-den .cm-bd { font:600 13px/1.65 'Libre Franklin', Arial, sans-serif; }
    .cm-den .cm-pc .c, .cm-den .cm-bd .v { font:400 15px/1 'Caprasimo', Georgia, serif; }
    .cm-den .cm-pc.changed .c { color:var(--rust); }
    .cm-den .cm-pc.changed .c::after { content:" ●"; font:400 9px/1 'Libre Franklin', Arial, sans-serif; color:var(--mus); vertical-align:2px; }
    .cm-den .cm-extra, .cm-den .ft .go { font:800 11px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--rust); white-space:nowrap; }
    .cm-den .ft { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:12px; font:600 10.5px/1.2 'Libre Franklin', Arial, sans-serif; color:var(--mut); }
    .cm-den .ft .mark { color:var(--mus); }
    `,
  },
  /* Futuris: a readout in the light, cut corners, cyan hairlines, a faint
     scan, the numbers in mono. */
  futuris: {
    fonts: "family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600",
    tab: (r) => `<span class="dia"></span><span class="tt"><span class="t">Ruleset</span><span class="s">${r.standard ? `STANDARD · ${r.board.cols}×${r.board.rows}` : `${r.laws.length} LAWS · ${r.perSide} PCS · ${r.board.cols}×${r.board.rows}`}</span></span>`,
    L: {
      head: `<div class="hd"><span class="kick">// active parameters</span><h3>RULESET</h3><span class="rule"></span></div>`,
      laws: (r) => `LAWS <b>${two(r.laws.length)}</b>`, pieces: (r) => `PIECES <small>per side</small> <b>${two(r.perSide)}</b>`, board: () => "BOARD",
      noLaws: "NONE · STANDARD RULES",
      count: (c) => two(c),
      foot: () => `<div class="ft"><span>Δ = not standard</span>${rulesLink("OPEN RULES ▸")}</div>`,
    },
    css: `
    .cm-futuris { --c:#22E4FF; --ink:#DDF6FF; --mut:#7FA3B8; --bg:rgba(7,11,17,.9); color: var(--ink); filter: drop-shadow(0 0 10px rgba(34,228,255,.35)); }
    .cm-futuris .cm-tab { gap:10px; padding:9px 16px 9px 12px; background:var(--bg); border:1px solid rgba(34,228,255,.55); clip-path:polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
    .cm-futuris .dia { width:12px; height:12px; border:1.5px solid var(--c); transform:rotate(45deg); box-shadow:0 0 8px var(--c), inset 0 0 4px var(--c); }
    .cm-futuris .tt { display:flex; flex-direction:column; gap:3px; }
    .cm-futuris .t { font:700 13px/1 'Chakra Petch', sans-serif; letter-spacing:.24em; text-transform:uppercase; color:var(--ink); text-shadow:0 0 8px rgba(34,228,255,.7); }
    .cm-futuris .s { font:500 10.5px/1 'IBM Plex Mono', monospace; letter-spacing:.06em; color:var(--mut); }
    .cm-futuris .cm-card { position:relative; padding:16px 18px 14px; background:var(--bg) repeating-linear-gradient(0deg, rgba(34,228,255,.035) 0 1px, transparent 1px 3px); border:1px solid rgba(34,228,255,.55); clip-path:polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px)); color:var(--ink); }
    .cm-futuris .kick { font:500 10px/1 'IBM Plex Mono', monospace; letter-spacing:.14em; color:var(--c); }
    .cm-futuris h3 { margin:6px 0 0; font:700 24px/1 'Chakra Petch', sans-serif; letter-spacing:.16em; color:#fff; text-shadow:0 0 12px rgba(34,228,255,.8); }
    .cm-futuris .rule { display:block; height:1px; margin:10px 0 2px; background:linear-gradient(90deg, var(--c), rgba(34,228,255,.1)); box-shadow:0 0 6px var(--c); }
    .cm-futuris h4 { display:flex; justify-content:space-between; align-items:baseline; margin:12px 0 5px; font:700 11px/1 'Chakra Petch', sans-serif; letter-spacing:.24em; color:var(--c); }
    .cm-futuris h4 small { font:500 9.5px/1 'IBM Plex Mono', monospace; letter-spacing:.08em; color:var(--mut); margin-left:6px; margin-right:auto; }
    .cm-futuris h4 b { font:600 11px/1 'IBM Plex Mono', monospace; color:var(--mut); }
    .cm-futuris .cm-law { padding:3px 0 3px 10px; border-left:1px solid rgba(34,228,255,.3); margin-bottom:3px; }
    .cm-futuris .cm-name { font:600 13px/1.3 'Chakra Petch', sans-serif; letter-spacing:.08em; text-transform:uppercase; }
    .cm-futuris .cm-set { font:500 10.5px/1.45 'IBM Plex Mono', monospace; color:var(--mut); }
    .cm-futuris .cm-set .k { text-transform:uppercase; } .cm-futuris .cm-set .k::after { content:" ▸"; color:var(--c); } .cm-futuris .cm-set .v { color:var(--ink); }
    .cm-futuris .cm-pc, .cm-futuris .cm-bd { font:500 11.5px/1.75 'IBM Plex Mono', monospace; color:var(--ink); }
    .cm-futuris .cm-pc .n, .cm-futuris .cm-bd .k { text-transform:uppercase; letter-spacing:.06em; color:var(--mut); }
    .cm-futuris .cm-pc.changed .c { color:#fff; text-shadow:0 0 8px var(--c); }
    .cm-futuris .cm-pc.changed .c::before { content:"Δ "; color:var(--c); }
    .cm-futuris .ft { display:flex; justify-content:space-between; gap:10px; margin-top:12px; padding-top:8px; border-top:1px solid rgba(34,228,255,.25); font:500 10px/1 'IBM Plex Mono', monospace; color:var(--mut); }
    .cm-futuris .ft .go, .cm-futuris .cm-extra { color:var(--c); letter-spacing:.12em; font:500 10px/1 'IBM Plex Mono', monospace; }
    `,
  },
  /* Big Glutts: the price tag ("Your order") and the typed sales slip it
     unfolds into. */
  store: {
    fonts: "family=Caprasimo&family=Libre+Franklin:wght@700;800;900&family=Courier+Prime:wght@400;700",
    tab: (r) => `<span class="hole"></span><span class="t">Your order</span><span class="s">${r.standard ? "standard" : `${r.laws.length ? plural(r.laws.length, "law") : "no laws"}, ${plural(r.perSide, "piece")}`}</span>`,
    L: {
      head: `<div class="hd"><b>Big Glutts</b><span>Games &amp; Hobby · Aisle 9</span><span class="no">SALES SLIP &nbsp;No. 0475</span></div>`,
      laws: () => "LAWS", pieces: () => "PIECES <small>(each side)</small>", board: () => "BOARD",
      noLaws: "Standard rules",
      count: (c) => `${c}`,
      // (Its thanks the mural's over the store's way out, user: "change both".)
      foot: () => `<div class="ft"><span>* not in the standard set</span><span class="ty">THANK YOU FOR SHOPPING AT<br>BIG GLUTTS!</span><div class="last"><span class="stamp">DEMO</span>${rulesLink("Rules ›")}</div></div>`,
    },
    css: `
    .cm-store { --ink:#2E2118; --red:#A33F33; --paper:#F6EFDE; color: var(--ink); }
    .cm-store .cm-tab { position:relative; gap:9px; padding:9px 14px 9px 26px; background:#F4ECD8; border:1px solid rgba(46,33,24,.45); border-radius:3px 12px 12px 3px; box-shadow:0 3px 8px rgba(20,12,6,.35); }
    .cm-store .hole { position:absolute; left:9px; top:50%; width:8px; height:8px; margin-top:-4px; border-radius:50%; background:#3a2a1d; box-shadow:inset 0 0 0 1.6px #c9a24a; }
    .cm-store .t { font:800 11.5px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--ink); }
    .cm-store .s { font:700 11.5px/1 'Courier Prime', 'Courier New', monospace; color:var(--red); }
    .cm-store .cm-card { position:relative; padding:18px 18px 14px; background:var(--paper); color:var(--ink); box-shadow:0 10px 26px rgba(20,12,6,.45); font:400 12.5px/1.5 'Courier Prime', 'Courier New', monospace;
      -webkit-mask: conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top / 12px 7px repeat-x, linear-gradient(#000 0 0) bottom / 100% calc(100% - 7px) no-repeat;
      mask: conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top / 12px 7px repeat-x, linear-gradient(#000 0 0) bottom / 100% calc(100% - 7px) no-repeat; }
    .cm-store .hd { text-align:center; padding-bottom:8px; border-bottom:1px dashed rgba(46,33,24,.5); }
    .cm-store .hd b { display:block; font:400 24px/1 'Caprasimo', Georgia, serif; color:#6B3A1E; text-shadow:2px 2px 0 #E9B23A; }
    .cm-store .hd span { display:block; margin-top:4px; font:800 9.5px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.16em; text-transform:uppercase; color:#B4451F; }
    .cm-store .hd .no { font:700 11px/1 'Courier Prime', monospace; letter-spacing:.06em; color:var(--ink); margin-top:8px; }
    .cm-store h4 { margin:10px 0 3px; font:700 11.5px/1.3 'Courier Prime', monospace; letter-spacing:.14em; border-bottom:1px dashed rgba(46,33,24,.5); }
    .cm-store h4 small { font-weight:400; letter-spacing:0; }
    .cm-store .cm-name { font:400 12.5px/1.5 'Courier Prime', 'Courier New', monospace; }
    .cm-store .cm-name::before { content:"· "; }
    .cm-store .cm-set { padding-left:14px; font-size:11.5px; color:#5a4636; } .cm-store .cm-set .k::after { content:":"; } .cm-store .cm-set .v { font-weight:700; }
    .cm-store .cm-pc, .cm-store .cm-bd { font-size:12px; line-height:1.6; }
    .cm-store .cm-pc .c { font-weight:700; }
    .cm-store .cm-pc.changed .n::after { content:" *"; color:var(--red); font-weight:700; }
    .cm-store .ft { margin-top:10px; padding-top:8px; border-top:1px dashed rgba(46,33,24,.5); display:flex; flex-direction:column; gap:5px; font-size:11px; }
    .cm-store .ft .ty { text-align:center; letter-spacing:.1em; }
    .cm-store .ft .last { display:flex; justify-content:space-between; align-items:center; margin-top:2px; }
    .cm-store .ft .go, .cm-store .cm-extra { color:var(--red); font:700 12px/1.4 'Courier Prime', monospace; text-decoration:underline; }
    .cm-store .stamp { display:inline-block; margin:2px 0 0 4px; padding:2px 10px; border:3px solid rgba(163,63,51,.75); border-radius:6px; color:rgba(163,63,51,.75); font:900 22px/1 'Libre Franklin', Arial, sans-serif; letter-spacing:.12em; transform:rotate(-14deg); mix-blend-mode:multiply; }
    `,
  },
  /* Lluvia: a neon sign in the rain (its Vietnamese over the English, as
     the street's own signs are). */
  lluvia: {
    fonts: "family=Saira+Condensed:wght@500;600;700&family=Saira+Extra+Condensed:wght@800",
    tab: (r) => `<span class="neon">LUẬT</span><span class="tt"><span class="t">Rules</span><span class="s">${esc(sums.short(r))}</span></span>`,
    L: {
      head: `<div class="hd"><span class="kick">Nueva Ciudad · 2091</span><h3>LUẬT CHƠI</h3><span class="sub">the rules of the game</span></div>`,
      laws: () => "<em>Luật</em> Laws", pieces: () => "<em>Quân cờ</em> Pieces · each side", board: () => "<em>Bàn cờ</em> Board",
      noLaws: "Standard rules",
      foot: () => `<div class="ft"><span>pink = not standard</span>${rulesLink("RULES ›")}</div>`,
    },
    css: `
    .cm-lluvia { --p:#FF3DBB; --ink:#F3ECFF; --mut:#B9B2C8; --bg:rgba(10,7,16,.92); color: var(--ink); }
    .cm-lluvia .cm-tab { gap:12px; padding:8px 14px 8px 12px; background:var(--bg); border:1.5px solid rgba(255,61,187,.6); border-radius:6px; box-shadow:0 0 18px rgba(255,61,187,.35), inset 0 0 12px rgba(255,61,187,.15); }
    .cm-lluvia .neon { font:800 24px/1 'Saira Extra Condensed', sans-serif; letter-spacing:.06em; color:#FFE6F6; text-shadow:0 0 2px #fff, 0 0 7px var(--p), 0 0 16px var(--p), 0 0 30px rgba(255,61,187,.6); }
    .cm-lluvia .tt { display:flex; flex-direction:column; gap:3px; }
    .cm-lluvia .t { font:700 12px/1 'Saira Condensed', sans-serif; letter-spacing:.2em; text-transform:uppercase; color:var(--ink); }
    .cm-lluvia .s { font:600 11.5px/1 'Saira Condensed', sans-serif; letter-spacing:.06em; color:var(--mut); }
    .cm-lluvia .cm-card { padding:16px 18px 14px; color:var(--ink); border:1.5px solid rgba(255,61,187,.55); border-radius:8px; box-shadow:0 0 30px rgba(255,61,187,.3), 0 20px 50px rgba(0,0,0,.6);
      background: repeating-linear-gradient(104deg, rgba(255,255,255,.04) 0 1px, transparent 1px 11px), linear-gradient(180deg, rgba(20,12,32,.95), rgba(8,6,14,.95)); }
    .cm-lluvia .kick { font:600 11px/1 'Saira Condensed', sans-serif; letter-spacing:.22em; text-transform:uppercase; color:var(--mut); }
    .cm-lluvia h3 { margin:6px 0 0; font:800 38px/.95 'Saira Extra Condensed', sans-serif; letter-spacing:.04em; color:#FFE6F6; text-shadow:0 0 2px #fff, 0 0 9px var(--p), 0 0 22px var(--p); }
    .cm-lluvia .sub { font:500 13px/1 'Saira Condensed', sans-serif; color:var(--mut); }
    .cm-lluvia h4 { margin:13px 0 5px; font:700 13px/1 'Saira Condensed', sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--p); text-shadow:0 0 8px rgba(255,61,187,.6); }
    .cm-lluvia h4 em { font-style:normal; font:800 15px/1 'Saira Extra Condensed', sans-serif; color:#FFE6F6; margin-right:6px; }
    .cm-lluvia .cm-name { font:600 16px/1.25 'Saira Condensed', sans-serif; }
    .cm-lluvia .cm-law { padding:2px 0; }
    .cm-lluvia .cm-set { font:500 13.5px/1.3 'Saira Condensed', sans-serif; color:var(--mut); padding-left:10px; } .cm-lluvia .cm-set .k::after { content:":"; } .cm-lluvia .cm-set .v { color:#FF9ADB; }
    .cm-lluvia .cm-pc, .cm-lluvia .cm-bd { font:600 14.5px/1.55 'Saira Condensed', sans-serif; }
    .cm-lluvia .cm-pc.changed .c, .cm-lluvia .cm-pc.changed .n { color:#FF9ADB; text-shadow:0 0 8px rgba(255,61,187,.7); }
    .cm-lluvia .ft { display:flex; justify-content:space-between; gap:10px; margin-top:12px; font:600 12px/1 'Saira Condensed', sans-serif; letter-spacing:.06em; color:var(--mut); }
    .cm-lluvia .ft .go, .cm-lluvia .cm-extra { color:var(--p); letter-spacing:.16em; font:600 12px/1 'Saira Condensed', sans-serif; }
    `,
  },
  /* Cromo: a brushed steel plate, engraved, screwed on. */
  cromo: {
    fonts: "family=Michroma&family=Barlow:wght@400;500",
    tab: (r) => `<span class="scr"></span><span class="tt"><span class="t">Parameters</span><span class="s">${esc(sums.plain(r))}</span></span><span class="scr"></span>`,
    L: {
      head: `<span class="scr a"></span><span class="scr b"></span><span class="scr c"></span><span class="scr d"></span><div class="hd"><h3>GAME PARAMETERS</h3></div>`,
      laws: () => "LAWS", pieces: () => "PIECES · EACH SIDE", board: () => "BOARD",
      noLaws: "Standard rules",
      foot: () => `<div class="ft"><span>▮ not standard</span>${rulesLink("RULES ›")}</div>`,
    },
    css: `
    .cm-cromo { --ink:#E9EAEC; --mut:#9A9DA3; --eng:#D4D8DE; color: var(--ink); }
    .cm-cromo .cm-tab, .cm-cromo .cm-card { background: repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), linear-gradient(180deg, #4C4E54, #2A2C30); border:1px solid rgba(233,234,236,.28); box-shadow: inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.6), 0 10px 26px rgba(0,0,0,.55); }
    .cm-cromo .cm-tab { gap:12px; padding:10px 12px; border-radius:3px; }
    .cm-cromo .scr { width:9px; height:9px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #d9dce0, #6c6f75 60%, #33353a); box-shadow: inset 0 0 0 .5px rgba(0,0,0,.6); position:relative; flex:none; }
    .cm-cromo .scr::after { content:""; position:absolute; left:1px; right:1px; top:4px; height:1px; background:rgba(0,0,0,.55); transform:rotate(35deg); }
    .cm-cromo .tt { display:flex; flex-direction:column; gap:4px; }
    .cm-cromo .t { font:400 10.5px/1 'Michroma', sans-serif; letter-spacing:.22em; text-transform:uppercase; color:var(--eng); text-shadow:0 -1px 0 rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.12); }
    .cm-cromo .s { font:500 11.5px/1 'Barlow', sans-serif; letter-spacing:.04em; color:var(--mut); }
    .cm-cromo .cm-card { position:relative; padding:20px 22px 16px; border-radius:4px; color:var(--ink); }
    .cm-cromo .cm-card .scr { position:absolute; } .cm-cromo .scr.a { left:8px; top:8px; } .cm-cromo .scr.b { right:8px; top:8px; } .cm-cromo .scr.c { left:8px; bottom:8px; } .cm-cromo .scr.d { right:8px; bottom:8px; }
    .cm-cromo h3 { margin:0; font:400 13px/1.2 'Michroma', sans-serif; letter-spacing:.16em; color:var(--eng); text-shadow:0 -1px 0 rgba(0,0,0,.75), 0 1px 0 rgba(255,255,255,.12); }
    .cm-cromo h4 { margin:14px 0 6px; padding-top:10px; font:400 9.5px/1 'Michroma', sans-serif; letter-spacing:.22em; color:var(--mut); border-top:1px solid rgba(0,0,0,.6); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
    .cm-cromo .cm-name { font:500 14.5px/1.3 'Barlow', sans-serif; }
    .cm-cromo .cm-law { padding:2px 0; }
    .cm-cromo .cm-set { font:400 12.5px/1.35 'Barlow', sans-serif; color:var(--mut); padding-left:12px; } .cm-cromo .cm-set .k::after { content:" —"; } .cm-cromo .cm-set .v { color:var(--eng); }
    .cm-cromo .cm-pc, .cm-cromo .cm-bd { font:500 13.5px/1.75 'Barlow', sans-serif; }
    .cm-cromo .cm-pc .c, .cm-cromo .cm-bd .v { font:400 10.5px/1 'Michroma', sans-serif; padding:3px 6px; border-radius:2px; background:rgba(0,0,0,.35); box-shadow: inset 0 1px 2px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06); }
    .cm-cromo .cm-pc.changed .c { color:#fff; box-shadow: inset 0 1px 2px rgba(0,0,0,.6), 0 0 0 1px rgba(233,234,236,.7); }
    .cm-cromo .ft { display:flex; justify-content:space-between; gap:10px; margin-top:14px; padding-top:10px; border-top:1px solid rgba(0,0,0,.6); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); font:500 10.5px/1 'Barlow', sans-serif; color:var(--mut); }
    .cm-cromo .ft .go, .cm-cromo .cm-extra { font:400 9.5px/1 'Michroma', sans-serif; letter-spacing:.2em; color:var(--eng); }
    `,
  },
  /* Plano: the drawing's own title block and schedules, set out in white
     on blue, the values in a draughtsman's hand; what's changed from the
     standard set marked with a revision triangle; a plan of the board. */
  plano: {
    fonts: "family=Architects+Daughter&family=IBM+Plex+Mono:wght@400;500;600",
    tab: (r) => `<span class="cell a"><span class="t">GAME SPEC</span><span class="s">${r.standard ? `standard · ${r.board.cols}×${r.board.rows}` : `${r.laws.length ? plural(r.laws.length, "law") : "no laws"} · ${r.perSide} pcs · ${r.board.cols}×${r.board.rows}`}</span></span><span class="cell b">A-1</span>`,
    L: {
      head: `<div class="hd"><span class="t">SCHEDULE OF RULES</span><span class="sh">SHEET A-1</span></div>`,
      laws: () => "LAWS", pieces: () => "PIECE SCHEDULE <small>each side</small>", board: () => "BOARD",
      noLaws: "Standard rules",
      count: (c) => `${c}`,
      // (The revision triangle's note, as a drawing's revisions have.)
      piecesExtra: (r) => (r.pieces.some((p) => p.count !== p.std) ? `<span class="dim"><i class="rev">1</i>revised from the standard set</span>` : ""),
      boardExtra: plan,
      foot: () => `<div class="tb"><span>EL CABEZA — GAME SPECIFICATION</span><span>SCALE 1:1</span><span>REV. A</span>${rulesLink("RULES ›")}</div>`,
    },
    css: `
    .cm-plano { --ink:#EEF6FF; --mut:#A9C6EC; --bg:#1D4C8A; color: var(--ink); }
    .cm-plano .cm-tab, .cm-plano .cm-card { background-color:var(--bg); background-image: linear-gradient(rgba(238,246,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(238,246,255,.07) 1px, transparent 1px); background-size: 14px 14px; color:var(--ink); }
    .cm-plano .cm-tab { border:1.5px solid var(--ink); box-shadow: 0 0 0 3px var(--bg), 0 0 0 4.5px rgba(238,246,255,.5), 0 10px 24px rgba(4,12,30,.5); align-items:stretch; }
    .cm-plano .cell { display:flex; flex-direction:column; justify-content:center; gap:4px; padding:7px 10px; }
    .cm-plano .cell.a { border-right:1.5px solid var(--ink); }
    .cm-plano .cell.b { font:400 22px/1 'Architects Daughter', cursive; padding:0 12px; }
    .cm-plano .t { font:600 10px/1 'IBM Plex Mono', monospace; letter-spacing:.16em; }
    .cm-plano .s { font:400 14px/1 'Architects Daughter', cursive; color:var(--ink); }
    .cm-plano .cm-card { padding:0; border:1.5px solid var(--ink); box-shadow: 0 0 0 3px var(--bg), 0 0 0 4.5px rgba(238,246,255,.5), 0 14px 30px rgba(4,12,30,.55); width:316px; }
    .cm-plano .hd { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1.5px solid var(--ink); }
    .cm-plano .hd .t { font-size:11px; } .cm-plano .hd .sh { font:400 15px/1 'Architects Daughter', cursive; }
    .cm-plano .cm-sec { padding:0 12px 6px; border-bottom:1px solid rgba(238,246,255,.55); }
    .cm-plano h4 { margin:8px 0 4px; font:600 10px/1 'IBM Plex Mono', monospace; letter-spacing:.16em; color:var(--mut); }
    .cm-plano h4 small { font-weight:400; letter-spacing:.04em; }
    .cm-plano .cm-law { padding:2px 0; border-bottom:1px dotted rgba(238,246,255,.25); align-self:stretch; }
    .cm-plano .cm-name { font:400 15px/1.3 'Architects Daughter', cursive; }
    .cm-plano .cm-set { font:400 10.5px/1.5 'IBM Plex Mono', monospace; color:var(--mut); padding-left:10px; } .cm-plano .cm-set .k { text-transform:uppercase; letter-spacing:.06em; } .cm-plano .cm-set .k::after { content:" :"; } .cm-plano .cm-set .v { font:400 13px/1.2 'Architects Daughter', cursive; color:var(--ink); }
    .cm-plano .cm-pc, .cm-plano .cm-bd { font:400 10.5px/1.9 'IBM Plex Mono', monospace; letter-spacing:.04em; text-transform:uppercase; color:var(--mut); }
    .cm-plano .cm-pc .c, .cm-plano .cm-bd .v { font:400 15px/1 'Architects Daughter', cursive; text-transform:none; color:var(--ink); }
    .cm-plano .cm-pc.changed .c::after { content:"1"; display:inline-block; margin-left:5px; width:14px; height:12px; font:600 7.5px/14px 'IBM Plex Mono', monospace; text-align:center; color:var(--bg); background:var(--ink); clip-path:polygon(50% 0, 100% 100%, 0 100%); vertical-align:1px; }
    .cm-plano .mini { display:grid; grid-auto-rows: 9px; margin:8px 0 3px; width:max-content; border:1px solid var(--ink); }
    .cm-plano .mini i { border-right:1px solid rgba(238,246,255,.35); border-bottom:1px solid rgba(238,246,255,.35); position:relative; }
    .cm-plano .mini i.x::after { content:"✕"; position:absolute; inset:0; font:400 8px/9px monospace; text-align:center; color:var(--ink); }
    .cm-plano .mini i.o::after { content:""; position:absolute; inset:1.5px; border:1px solid var(--ink); border-radius:50%; }
    .cm-plano .dim { display:block; font:400 9px/1.3 'IBM Plex Mono', monospace; letter-spacing:.04em; color:var(--mut); margin-bottom:4px; }
    .cm-plano .dim .rev { display:inline-block; width:14px; height:12px; margin-right:5px; font:600 7.5px/14px 'IBM Plex Mono', monospace; font-style:normal; text-align:center; color:var(--bg); background:var(--ink); clip-path:polygon(50% 0, 100% 100%, 0 100%); vertical-align:-1px; }
    .cm-plano .cm-extra { margin:8px 12px 0; font:400 14px/1.2 'Architects Daughter', cursive; }
    .cm-plano .tb { display:grid; grid-template-columns: 1fr auto auto; margin-top:8px; border-top:1px solid rgba(238,246,255,.55); font:500 8.5px/1.3 'IBM Plex Mono', monospace; letter-spacing:.08em; }
    .cm-plano .tb span { padding:6px 8px; border-right:1px solid rgba(238,246,255,.55); } .cm-plano .tb span:first-child { grid-row: span 2; } .cm-plano .tb .go { grid-column: 2 / 4; padding:6px 8px; border-top:1px solid rgba(238,246,255,.55); text-align:right; font:400 13px/1 'Architects Daughter', cursive; color:var(--ink); }
    `,
  },
  /* Luna: the mission patch, and the mission's checklist. */
  luna: {
    fonts: "family=Jost:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500",
    // (user: the tab "too long" on a phone: Rules under Mission, the board
    // under the rest of the summary, everything a size smaller; the
    // separator stays in the text, hidden, so the words read as before)
    tab: (r) => { const sum = sums.plain(r), at = sum.lastIndexOf(" · "); const top = at < 0 ? sum : sum.slice(0, at), bottom = at < 0 ? "" : sum.slice(at + 3); return `<span class="patch"><i class="moon"></i><i class="earth"></i></span><span class="tt"><span class="t"><span class="w">Mission</span> <span class="w">rules</span></span><span class="s"><span class="w">${esc(top)}</span>${bottom ? `<span class="sep"> · </span><span class="w">${esc(bottom)}</span>` : ""}</span></span>`; },
    L: {
      head: `<div class="hd"><span class="kick">MISSION PARAMETERS</span><h3>Base rules</h3></div>`,
      laws: () => "Laws", pieces: () => "Pieces · each side", board: () => "Board",
      noLaws: "Standard rules",
      foot: () => `<div class="ft"><span><i class="dot"></i> not standard</span>${rulesLink("Rules ›")}</div>`,
    },
    css: `
    .cm-luna { --o:#FF7A1A; --ink:#E8ECF2; --mut:#9AA6B6; --bg:rgba(13,17,24,.92); color: var(--ink); }
    .cm-luna .cm-tab { gap:9px; padding:6px 12px 6px 6px; background:var(--bg); border:1px solid rgba(232,236,242,.22); border-radius:16px; box-shadow:0 10px 24px rgba(0,0,0,.5); }
    .cm-luna .patch { position:relative; width:32px; height:32px; border-radius:31%; background:#0B0E14; border:2px solid var(--o); box-shadow: inset 0 0 0 2px #0B0E14, inset 0 0 0 3px rgba(255,122,26,.45); overflow:hidden; flex:none; }
    .cm-luna .moon { position:absolute; left:-6px; bottom:-13px; width:32px; height:22px; border-radius:50%; background: radial-gradient(circle at 40% 30%, #c9c6bf, #7d7a73); }
    .cm-luna .earth { position:absolute; right:5px; top:5px; width:8px; height:8px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #9fd0ff, #2b6cb0); box-shadow: 0 0 6px rgba(120,190,255,.7); }
    .cm-luna .tt { display:flex; flex-direction:column; gap:3px; }
    .cm-luna .t { font:600 10px/1.05 'Jost', sans-serif; letter-spacing:.18em; text-transform:uppercase; color:var(--ink); }
    .cm-luna .s { font:400 9.5px/1.15 'IBM Plex Mono', monospace; color:var(--mut); }
    .cm-luna .t .w, .cm-luna .s .w { display:block; }
    .cm-luna .s .sep { display:none; }
    .cm-luna .cm-card { padding:16px 18px 14px; background:var(--bg); border:1px solid rgba(232,236,242,.22); border-radius:16px; color:var(--ink); box-shadow: 0 0 0 1px rgba(255,122,26,.12), 0 20px 50px rgba(0,0,0,.65); }
    .cm-luna .kick { font:500 10px/1 'IBM Plex Mono', monospace; letter-spacing:.18em; color:var(--o); }
    .cm-luna h3 { margin:6px 0 2px; font:600 24px/1 'Jost', sans-serif; color:#fff; }
    .cm-luna h4 { margin:13px 0 6px; font:600 10.5px/1 'Jost', sans-serif; letter-spacing:.22em; text-transform:uppercase; color:var(--mut); }
    .cm-luna .cm-law { position:relative; padding:3px 0 4px 26px; }
    .cm-luna .cm-law::before { content:"✓"; position:absolute; left:0; top:4px; width:16px; height:16px; border-radius:31%; background:var(--o); color:#0B0D12; font:700 11px/16px 'Jost', sans-serif; text-align:center; }
    .cm-luna .cm-law.cm-none::before { content:"–"; }
    .cm-luna .cm-name { font:500 14.5px/1.3 'Jost', sans-serif; }
    .cm-luna .cm-set { font:400 11px/1.5 'IBM Plex Mono', monospace; color:var(--mut); } .cm-luna .cm-set .k { text-transform:uppercase; letter-spacing:.06em; } .cm-luna .cm-set .v { color:var(--ink); }
    .cm-luna .cm-pc, .cm-luna .cm-bd { font:500 13.5px/1.9 'Jost', sans-serif; }
    .cm-luna .cm-pc .c, .cm-luna .cm-bd .v { font:500 11px/1 'IBM Plex Mono', monospace; padding:3px 7px; border-radius:8px; background:rgba(232,236,242,.08); }
    .cm-luna .cm-pc.changed .c { color:var(--o); box-shadow: inset 0 0 0 1px var(--o); }
    .cm-luna .ft { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:12px; font:400 10.5px/1 'IBM Plex Mono', monospace; color:var(--mut); }
    .cm-luna .ft .dot { display:inline-block; width:8px; height:8px; border-radius:3px; box-shadow: inset 0 0 0 1px var(--o); vertical-align:-1px; }
    .cm-luna .ft .go, .cm-luna .cm-extra { font:600 11px/1 'Jost', sans-serif; letter-spacing:.18em; text-transform:uppercase; color:var(--o); }
    `,
  },
  /* Noir: a title card, white on black in a double rule, typed; the one
     red is the HOTEL sign's. */
  noir: {
    fonts: "family=Bebas+Neue&family=Courier+Prime:wght@400;700",
    tab: (r) => `<span class="t">RULES</span><span class="s">${r.standard ? `standard · ${r.board.label}` : `${r.laws.length ? plural(r.laws.length, "law") : "no laws"} · ${r.board.label}`}</span><span class="red"></span>`,
    L: {
      head: `<div class="hd"><span class="kick">— THIS GAME —</span><h3>THE RULES<br>OF THE GAME</h3></div>`,
      laws: () => "THE LAWS", pieces: () => "THE PIECES <small>(each side)</small>", board: () => "THE BOARD",
      noLaws: "The standard rules",
      foot: () => `<div class="ft"><span><b>*</b> not the standard set</span>${rulesLink("RULES ›")}</div>`,
    },
    css: `
    .cm-noir { --ink:#ECECEC; --mut:#A2A2A2; --red:#D7262E; color: var(--ink); }
    .cm-noir .cm-tab, .cm-noir .cm-card { background:#0B0B0C; border:1px solid var(--ink); box-shadow: inset 0 0 0 3px #0B0B0C, inset 0 0 0 4px rgba(236,236,236,.7), 0 14px 34px rgba(0,0,0,.8); }
    .cm-noir .cm-tab { gap:10px; padding:9px 14px; }
    .cm-noir .t { font:400 21px/1 'Bebas Neue', Impact, sans-serif; letter-spacing:.16em; color:var(--ink); }
    .cm-noir .s { font:400 11.5px/1 'Courier Prime', monospace; color:var(--mut); }
    .cm-noir .red { width:7px; height:7px; border-radius:50%; background:var(--red); box-shadow:0 0 6px var(--red), 0 0 14px rgba(215,38,46,.7); flex:none; }
    .cm-noir .cm-card { position:relative; padding:20px 22px 16px; color:var(--ink); background-image: radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.06), transparent 70%); }
    .cm-noir .hd { text-align:center; }
    .cm-noir .kick { font:400 10.5px/1 'Courier Prime', monospace; letter-spacing:.3em; color:var(--mut); }
    .cm-noir h3 { margin:8px 0 2px; font:400 32px/.92 'Bebas Neue', Impact, sans-serif; letter-spacing:.06em; color:#fff; }
    .cm-noir h4 { margin:14px 0 5px; font:400 17px/1 'Bebas Neue', Impact, sans-serif; letter-spacing:.14em; border-bottom:1px solid rgba(236,236,236,.35); padding-bottom:3px; }
    .cm-noir h4 small { font:400 11px/1 'Courier Prime', monospace; letter-spacing:0; color:var(--mut); }
    .cm-noir .cm-name { font:700 13.5px/1.35 'Courier Prime', monospace; }
    .cm-noir .cm-law { padding:2px 0; }
    .cm-noir .cm-set { font:italic 400 12.5px/1.35 'Courier Prime', monospace; color:var(--mut); padding-left:14px; } .cm-noir .cm-set .k::after { content:":"; } .cm-noir .cm-set .v { color:var(--ink); }
    .cm-noir .cm-pc, .cm-noir .cm-bd { font:400 13px/1.6 'Courier Prime', monospace; }
    .cm-noir .cm-pc .n { flex:1; display:flex; } .cm-noir .cm-pc .n::after { content:""; flex:1; margin:0 4px 4px; border-bottom:1px dotted rgba(236,236,236,.35); }
    .cm-noir .cm-pc.changed .c::after { content:"*"; color:var(--red); font-weight:700; margin-left:2px; }
    .cm-noir .ft { display:flex; justify-content:space-between; gap:10px; margin-top:14px; font:400 11.5px/1 'Courier Prime', monospace; color:var(--mut); } .cm-noir .ft b { color:var(--red); }
    .cm-noir .ft .go, .cm-noir .cm-extra { color:var(--ink); letter-spacing:.14em; font:400 11.5px/1 'Courier Prime', monospace; }
    `,
  },
  /* Ciudad: a street's name sign, white on the slate's blue, its thin white
     rule just inside the edge, set in Overpass (the road signs' own face);
     the card the city's white with the sign at its head, the pieces' counts
     in tags, anything not standard flagged in the cranes' yellow. */
  ciudad: {
    fonts: "family=Overpass:wght@400;600;700;800&family=Overpass+Mono:wght@400;600",
    tab: (r) => `<span class="t">Rules</span><span class="s">${esc(sums.short(r))}</span>`,
    L: {
      head: `<div class="hd"><span class="kick">This game · by order</span><h3>Rules</h3></div>`,
      laws: () => "Laws in force", pieces: () => "Pieces, each side", board: () => "The district",
      noLaws: "The standard rules",
      foot: () => `<div class="ft"><span><span class="mk"></span>not the standard set</span>${rulesLink("Full rules ›")}</div>`,
    },
    css: `
    .cm-ciudad { --ink:#24313D; --mut:#5E6E7E; --sign:#2F4458; --paper:#F4F4F0; --y:#E8B81B; color: var(--ink); }
    .cm-ciudad .cm-tab { gap:10px; padding:9px 14px 7px 13px; background:var(--sign); border-radius:7px; color:#fff; box-shadow: inset 0 0 0 2px var(--sign), inset 0 0 0 3.2px rgba(255,255,255,.9), 0 8px 20px rgba(16,24,34,.3); }
    .cm-ciudad .t { font:800 14px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing:.14em; text-transform:uppercase; }
    .cm-ciudad .s { font:400 11px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; color:rgba(255,255,255,.8); }
    .cm-ciudad .cm-card { padding:8px 0 14px; background:var(--paper); border-radius:12px; color:var(--ink); box-shadow: 0 0 0 1px rgba(36,49,61,.14), 0 18px 44px rgba(16,24,34,.32); }
    .cm-ciudad .hd { margin:0 8px 2px; padding:12px 16px 10px; border-radius:8px; background:var(--sign); color:#fff; box-shadow: inset 0 0 0 3px var(--sign), inset 0 0 0 4.2px rgba(255,255,255,.9); }
    .cm-ciudad .kick { display:block; font:600 10px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.78); }
    .cm-ciudad h3 { margin:6px 0 0; font:800 25px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing:.08em; text-transform:uppercase; }
    .cm-ciudad .cm-sec { padding:0 16px; }
    .cm-ciudad h4 { display:flex; align-items:center; gap:8px; margin:13px 0 6px; font:800 11px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing:.16em; text-transform:uppercase; color:var(--mut); }
    .cm-ciudad h4::after { content:""; flex:1; height:1px; background:rgba(36,49,61,.16); }
    .cm-ciudad .cm-law { position:relative; padding:3px 0 4px 18px; }
    .cm-ciudad .cm-law::before { content:""; position:absolute; left:0; top:7px; width:9px; height:9px; border-radius:2px; background:var(--sign); }
    .cm-ciudad .cm-law.cm-none::before { background:transparent; box-shadow: inset 0 0 0 1.5px var(--mut); }
    .cm-ciudad .cm-name { font:700 14.5px/1.3 'Overpass', 'Arial Narrow', Arial, sans-serif; }
    .cm-ciudad .cm-set { font:400 11.5px/1.5 'Overpass Mono', 'DejaVu Sans Mono', monospace; color:var(--mut); } .cm-ciudad .cm-set .k::after { content:":"; } .cm-ciudad .cm-set .v { color:var(--ink); }
    .cm-ciudad .cm-pc, .cm-ciudad .cm-bd { font:600 13.5px/1.9 'Overpass', 'Arial Narrow', Arial, sans-serif; }
    .cm-ciudad .cm-pc .c, .cm-ciudad .cm-bd .v { font:600 11.5px/1 'Overpass Mono', 'DejaVu Sans Mono', monospace; padding:3px 6px; border-radius:4px; background:rgba(47,68,88,.1); font-variant-numeric:tabular-nums; }
    .cm-ciudad .cm-pc.changed .c { background:var(--y); color:var(--ink); }
    .cm-ciudad .ft { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:13px 16px 0; font:400 10.5px/1.2 'Overpass Mono', 'DejaVu Sans Mono', monospace; color:var(--mut); }
    .cm-ciudad .ft .mk { display:inline-block; width:9px; height:9px; border-radius:2px; background:var(--y); vertical-align:-1px; margin-right:5px; }
    .cm-ciudad .ft .go, .cm-ciudad .cm-extra { font:800 11px/1 'Overpass', 'Arial Narrow', Arial, sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--sign); white-space:nowrap; }
    .cm-ciudad .cm-extra { margin:10px 16px 0; }
    `,
  },
  /* Tá muid beo: a painted cartouche, cream and cobalt, ruled in gold. */
  "parrish-orinoco": {
    fonts: "family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600",
    tab: (r) => `<span class="t">The Rules</span><span class="s">${r.standard ? `the standard game · ${word(r.board.cols)} by ${word(r.board.rows)}` : `${r.laws.length ? `${word(r.laws.length)} ${r.laws.length === 1 ? "law" : "laws"}` : "no laws"} · ${word(r.board.cols)} by ${word(r.board.rows)}`}</span>`,
    L: {
      head: (title) => `<div class="hd"><span class="kick">${title}</span><h3>The Rules of Play</h3><span class="orn">— ◆ —</span></div>`,
      laws: () => "THE LAWS", pieces: () => "THE PIECES · EACH SIDE", board: () => "THE BOARD",
      noLaws: "The standard rules",
      count: (c) => word(c),
      foot: () => `<div class="ft"><span><i>in gold:</i> not the standard set</span>${rulesLink("The rules ›")}</div>`,
    },
    css: `
    .cm-parrish-orinoco { --ink:#1D2C5E; --mut:#5A6A9A; --gold:#C9963B; --paper:#F6ECD6; color: var(--ink); }
    .cm-parrish-orinoco .cm-tab, .cm-parrish-orinoco .cm-card { background: radial-gradient(ellipse at 30% 20%, #FFF8E8, var(--paper) 60%, #EADDBE); border:1px solid var(--gold); box-shadow: inset 0 0 0 3px var(--paper), inset 0 0 0 4px var(--gold), 0 14px 30px rgba(8,14,38,.45); color:var(--ink); }
    .cm-parrish-orinoco .cm-tab { flex-direction:column; align-items:flex-start; gap:3px; padding:9px 18px; border-radius:22px; }
    .cm-parrish-orinoco .t { font:700 12px/1 'Cinzel', Georgia, serif; letter-spacing:.18em; text-transform:uppercase; }
    .cm-parrish-orinoco .s { font:italic 500 14px/1 'Cormorant Garamond', Georgia, serif; color:var(--mut); }
    .cm-parrish-orinoco .cm-card { position:relative; padding:22px 24px 18px; border-radius:4px; }
    .cm-parrish-orinoco .cm-card::before, .cm-parrish-orinoco .cm-card::after { content:"◆"; position:absolute; top:6px; font-size:9px; color:var(--gold); } .cm-parrish-orinoco .cm-card::before { left:8px; } .cm-parrish-orinoco .cm-card::after { right:8px; }
    .cm-parrish-orinoco .hd { text-align:center; }
    .cm-parrish-orinoco .kick { font:600 9.5px/1 'Cinzel', Georgia, serif; letter-spacing:.32em; color:var(--gold); }
    .cm-parrish-orinoco h3 { margin:6px 0 0; font:italic 600 28px/1 'Cormorant Garamond', Georgia, serif; }
    .cm-parrish-orinoco .orn { display:block; margin-top:4px; font-size:10px; color:var(--gold); letter-spacing:.3em; }
    .cm-parrish-orinoco h4 { margin:12px 0 5px; font:700 11px/1 'Cinzel', Georgia, serif; letter-spacing:.2em; text-align:center; }
    .cm-parrish-orinoco h4::after { content:""; display:block; width:40px; height:1px; margin:6px auto 0; background:var(--gold); }
    .cm-parrish-orinoco .cm-name { font:600 17px/1.2 'Cormorant Garamond', Georgia, serif; }
    .cm-parrish-orinoco .cm-law { padding:2px 0; }
    .cm-parrish-orinoco .cm-set { font:italic 500 15px/1.25 'Cormorant Garamond', Georgia, serif; color:var(--mut); padding-left:12px; } .cm-parrish-orinoco .cm-set .k::after { content:","; } .cm-parrish-orinoco .cm-set .v { color:var(--ink); }
    .cm-parrish-orinoco .cm-pc, .cm-parrish-orinoco .cm-bd { font:600 16px/1.45 'Cormorant Garamond', Georgia, serif; }
    .cm-parrish-orinoco .cm-pc .c, .cm-parrish-orinoco .cm-bd .v { font-style:italic; color:var(--mut); }
    .cm-parrish-orinoco .cm-pc.changed .c, .cm-parrish-orinoco .cm-pc.changed .n { color:var(--gold); }
    .cm-parrish-orinoco .ft { display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin-top:12px; font:500 14px/1 'Cormorant Garamond', Georgia, serif; color:var(--mut); }
    .cm-parrish-orinoco .ft .go, .cm-parrish-orinoco .cm-extra { font:700 10.5px/1 'Cinzel', Georgia, serif; letter-spacing:.18em; color:var(--ink); }
    /* Out of the way till it's wanted (user: "On Watermark & Orinoco, the
       new Corner menu needs to be minimized and set to 50% opaque with a
       tap or click raising it to its full size and opacity. It's currently
       too obstructive / distracting."): closed, the title alone, smaller,
       at half strength; a mouse over it brings it to full strength, and a
       tap raises it to full size and strength (raise-on-tap.js, as every
       world's tab now), a second opening it. */
    .cm-parrish-orinoco .cm-tab { transform-origin:0 0; transition: opacity .18s ease, transform .18s ease; }
    .cm-parrish-orinoco:not([data-open="true"]):not([data-raised="true"]) .cm-tab { opacity:.5; transform:scale(.8); padding:7px 14px; }
    .cm-parrish-orinoco:not([data-open="true"]):not([data-raised="true"]) .cm-tab .s { display:none; }
    @media (hover: hover) { .cm-parrish-orinoco:not([data-open="true"]):not([data-raised="true"]) .cm-tab:hover { opacity:1; } }
    `,
  },
};
/* Go deo na ndeor: the same card in wine, umber and old gold. */
LOOKS["parrish-watermark"] = {
  ...LOOKS["parrish-orinoco"],
  css: LOOKS["parrish-orinoco"].css.replace(/parrish-orinoco/g, "parrish-watermark")
    .replace("--ink:#1D2C5E; --mut:#5A6A9A; --gold:#C9963B; --paper:#F6ECD6;", "--ink:#EBDCC0; --mut:#C2A68A; --gold:#CC9E57; --paper:#2A0A0E;")
    .replace("radial-gradient(ellipse at 30% 20%, #FFF8E8, var(--paper) 60%, #EADDBE)", "radial-gradient(ellipse at 30% 20%, #4A1219, var(--paper) 60%, #1C0609)")
    .replace("0 14px 30px rgba(8,14,38,.45)", "0 14px 30px rgba(10,2,4,.6)"),
};
const PARRISH_TITLE = { "parrish-orinoco": "TÁ MUID BEO", "parrish-watermark": "GO DEO NA NDEOR" };

/* A look's tab and card (markup), and its CSS. `extra`: a further action
   on the card, { label } (the store's "Purchase and bring home"). */
export function cornerMenuParts(look, r, extra = null) {
  const L0 = LOOKS[look] || LOOKS.den;
  const L = typeof L0.L.head === "function" ? { ...L0.L, head: L0.L.head(PARRISH_TITLE[look] || "") } : L0.L;
  return { tab: L0.tab(r), card: card(r, L, extra), css: BASE + L0.css, fonts: L0.fonts };
}
