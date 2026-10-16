/* Parts of Tienda's order form (tienda-overlay.js) that carry what
   Futuris's Singularity sphere offers, in the catalog's own manner:

   - SquarePicker: marking the board. The form's board diagram, large,
     where you mark the squares to cut out (X) or the black holes' place
     (O) by hand; each mark's 180° partner is filled in for you. Random,
     Done and Cancel, as the sphere's picker (the user's words).
   - OpponentSection: who's playing. A friend, or the store's
     demonstrator taking Dark or Light, and how hard it plays: the
     chassis's own opponent and difficulty, not a copy of them.
   - CarbonCopies: saved setups. File a carbon copy of the order under a
     name, use one again later, or throw it away (this browser only; the
     rules, never the opponent), as the sphere's CONFIGURATIONS. */

import React from "react";
import { initialPiecesFor } from "../engine/rules.js";
import {
  cloneSelections, normalizeSelections, fillSpots, randomizeSpots, spotProblem, mirrorCell,
  missingCellsOf, holeCellsOf, boardLabel, totalPieces, holeSetsOf, holeSpotsAfterTap, SPOT_PROBLEMS,
} from "./rules-selections.js";
import { sideSurface } from "./tienda.js";
import { sideNamesFor, sideLabel } from "./side-names.js";

const SIDE = sideNamesFor("tienda"); // Walnut / Ash, the set on the table

const h = React.createElement;
const INK = "#2E2118", RED = "#A33F33", PAPER = "#EFE6CD", PENCIL = "#1F3A6B";
const FRANKLIN = "'Libre Franklin', 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif";
const COURIER = "'Courier Prime', 'Courier New', Courier, monospace";

export const ORDER_PARTS_CSS = `
  .td-picker-layer { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: center; justify-content: center; padding: 12px;
    background: rgba(26,18,11,0.55); }
  .td-picker { width: min(620px, 100%); max-height: calc(100dvh - 24px); overflow: auto; background-color: ${PAPER}; background-image: var(--tienda-paper);
    color: ${INK}; border-radius: 2px; box-shadow: 0 24px 60px rgba(10,6,3,0.55); padding: clamp(14px, 3vw, 24px); display: flex; flex-direction: column; gap: 10px; }
  .td-picker h3 { margin: 0; font: 900 clamp(20px, 3.4vw, 26px)/1 ${FRANKLIN}; letter-spacing: 0.02em; }
  .td-picker p { margin: 0; font: 400 13px/1.4 ${COURIER}; }
  .td-picker-side { font: 700 11px/1 ${FRANKLIN}; letter-spacing: 0.14em; text-transform: uppercase; color: #6E5D4A; text-align: center; }
  .td-grid { display: grid; margin: 0 auto; border: 5px solid #4E2F1A; box-sizing: content-box !important; background: #4E2F1A; gap: 0; touch-action: manipulation; }
  .td-cell { position: relative; padding: 0; border: none; margin: 0; cursor: pointer; font: 700 14px/1 ${COURIER}; color: ${PENCIL};
    display: flex; align-items: center; justify-content: center; }
  .td-cell.lt { background: #D8BD8E; } .td-cell.dk { background: #9C6B45; }
  .td-cell.home::after { content: ""; position: absolute; inset: 0; background: rgba(36,19,10,0.14); pointer-events: none; }
  .td-cell.piece::before { content: ""; position: absolute; width: 34%; height: 34%; border-radius: 50%; background: rgba(46,33,24,0.35); }
  .td-cell.banned { cursor: not-allowed; background-image: repeating-linear-gradient(45deg, rgba(46,33,24,0.28) 0 2px, transparent 2px 6px); }
  .td-cell.wall::after { content: "–"; position: absolute; color: ${RED}; font: 700 16px/1 ${COURIER}; }
  .td-cell .mk { position: relative; z-index: 1; font-size: 1.05em; }
  .td-cell .mk.mirror { opacity: 0.45; }
  .td-cell .mk.rolled { outline: 1.5px dashed ${PENCIL}; outline-offset: 1px; padding: 0 2px; }
  /* A black hole on the form (user: as an O they were "kind of hard to
     see"): the circle inked in, a paper ring round it and a pencil ring
     round that, red for the first set's pair, blue for the second's.
     (Whether one was placed at random isn't drawn: a dashed ring said so,
     and was more puzzle than help, user. With two sets the buttons over
     the board say which pair a mark moves, the other pair faded.) */
  .td-cell .mk.bh, .td-bh-key i, .td-bh-status i { --bh: ${RED}; border-radius: 50%;
    background: radial-gradient(circle closest-side, #17110C 0 55%, ${PAPER} 60% 71%, var(--bh) 75% 93%, transparent 97%); }
  .td-cell .mk.bh[data-set="2"], .td-bh-key i[data-set="2"], .td-bh-status i[data-set="2"] { --bh: ${PENCIL}; }
  .td-cell .mk.bh { width: 78%; height: 78%; opacity: 1; font-size: 0; box-shadow: 0 1px 2px rgba(23,17,12,0.45); outline: none; padding: 0; }
  .td-cell .mk.bh.idle { opacity: 0.4; }
  /* (The pair a mark places, user: "it's not clear which one you're
     selecting at any given time": its tab filled in its pencil, a line
     saying so, and its two holes pulsing.) */
  .td-cell .mk.bh.live { animation: tdBhLive 1.3s ease-in-out infinite; }
  @keyframes tdBhLive { 50% { box-shadow: 0 0 0 3px var(--bh), 0 1px 2px rgba(23,17,12,0.45); } }
  .td-bh-status { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 1.4em; text-align: center; font: 700 13px/1.35 ${COURIER}; color: ${INK}; }
  .td-bh-status i { display: inline-block; width: 16px; height: 16px; flex: none; }
  @media (prefers-reduced-motion: reduce) { .td-cell .mk.bh.live { animation: none; box-shadow: 0 0 0 3px var(--bh); } }
  .td-bh-key { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; font: 700 12px/1.2 ${COURIER}; color: ${INK}; }
  .td-bh-key button { --bh: ${RED}; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; cursor: pointer;
    border: 1.5px solid ${INK}; border-radius: 2px; background: transparent; color: ${INK}; font: 700 14px/1 ${COURIER}; }
  .td-bh-key button[data-set="2"] { --bh: ${PENCIL}; }
  .td-bh-key button[aria-pressed="true"] { border: 2.5px solid var(--bh); background: var(--bh); color: ${PAPER}; box-shadow: 2px 2px 0 ${INK}; }
  .td-bh-key button:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
  .td-bh-key i { display: inline-block; width: 16px; height: 16px; flex: none; }
  .td-cell:focus-visible { outline: 3px solid ${RED}; outline-offset: -3px; z-index: 2; }
  .td-picker-note { font: 700 12.5px/1.35 ${COURIER}; color: ${RED}; min-height: 1.35em; }
  .td-picker-note.pulse { animation: tdPulse 0.5s ease 2; }
  @keyframes tdPulse { 50% { opacity: 0.35; } }
  .td-picker-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .td-seg { display: inline-flex; flex-wrap: wrap; gap: 6px; }
  /* (Easy, Medium, Hard always on one row, user: sharing it evenly.) */
  .td-seg.td-one { display: flex; flex-wrap: nowrap; flex: 1 1 auto; justify-content: flex-end; }
  /* Each as wide as its word needs (user: "Medium" didn't fit its button
     on a phone); where the row can't hold the label and all three, they
     go under it (.td-opponent .td-dim wraps). */
  .td-seg.td-one button { flex: 1 0 auto; min-width: max-content; padding: 0 10px; white-space: nowrap; }
  .td-opponent .td-dim { flex-wrap: wrap; row-gap: 8px; }
  .td-seg button { min-height: 44px; padding: 0 12px; border: 1.5px solid ${INK}; background: transparent; color: ${INK}; font: 700 13px/1.15 ${COURIER}; cursor: pointer; border-radius: 2px; }
  .td-seg button[aria-pressed="true"] { background: ${INK}; color: ${PAPER}; }
  .td-seg button:disabled { opacity: 0.45; cursor: default; }
  /* A side's own wood, always at full strength (so it reads as that
     side); the one chosen gets a double ink ring. */
  .td-seg button.td-wood { border-color: rgba(46,33,24,0.55); }
  .td-seg button.td-wood[aria-pressed="true"] { border-color: ${INK}; box-shadow: 0 0 0 2px ${PAPER}, 0 0 0 3.5px ${INK}; }
  .td-copy { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 8px 10px; margin: 6px 0;
    background: #F4D7DC; color: #4A2A33; border: 1px dashed rgba(74,42,51,0.5); font: 400 12.5px/1.35 ${COURIER}; }
  .td-copy b { font: 700 13.5px/1.25 ${COURIER}; display: block; color: #3A1E26; }
  .td-copy .td-seg button { min-height: 40px; border-color: #4A2A33; color: #4A2A33; font-size: 12px; }
  .td-copy-new { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 4px; }
  .td-copy-new input { flex: 1 1 180px; min-height: 44px; padding: 0 10px; border: none; border-bottom: 1.5px solid ${INK}; background: rgba(255,255,255,0.35);
    font: 700 16px/1 ${COURIER}; color: ${PENCIL}; }
  .td-copy-new input:focus-visible { outline: 3px solid ${RED}; outline-offset: 2px; }
`;

/* ------------------------------------------------------------ the square picker */

/* Marks spots on a draft of the selection. kind "missing": up to
   missingCount pairs, tap to mark or unmark, a rolled spot tapped becomes
   yours; Done fills any open pairs at random. kind "hole": one pair, a tap
   marks it and it stays shown till Done (user: "press the square, see the
   one you've pressed, and then click done to confirm"): a tap elsewhere
   moves it; with two sets, one square for each, the buttons over the
   board saying which set a tap moves (a tap on a hole picks its set too).
   The grid is drawn from Dark's side (the side that moves first), as the
   board faces at the start. */
export function SquarePicker({ sel, kind, onDone, onCancel, audio }) {
  const [draft, setDraft] = React.useState(() => cloneSelections(sel));
  const [note, setNote] = React.useState({ text: "", n: 0 });
  // (Two sets: the set a mark moves, 1 or 2.)
  const [aim, setAim] = React.useState(1);
  const { rows, cols } = draft;
  const isHole = kind === "hole";
  const spots = isHole ? draft.holeSpots : draft.missingSpots;
  const setSpots = (d, list) => { if (isHole) d.holeSpots = list; else d.missingSpots = list; };
  const count = isHole ? holeSetsOf(draft) : draft.missingCount;
  const pieces = React.useMemo(() => initialPiecesFor(rows, cols), [rows, cols]);
  const pieceAt = (r, c) => pieces.some((p) => r >= p.row && r < p.row + p.h && c >= p.col && c < p.col + p.w);
  const other = isHole ? missingCellsOf(draft) : holeCellsOf(draft);
  const say = (text) => setNote((n) => ({ text, n: n.n + 1 }));
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // What's marked where: { r,c -> { spot, mirror, rolled } }.
  const marks = new Map();
  spots.forEach((p, i) => {
    marks.set(`${p.row},${p.col}`, { spot: p, mirror: false, set: i + 1 });
    const m = mirrorCell(p.row, p.col, rows, cols);
    marks.set(`${m.row},${m.col}`, { spot: p, mirror: true, set: i + 1 });
  });
  // (The other feature's squares; a black hole's with its set, the spots
  // and their partners coming in pairs.)
  const otherSet = new Map(other.map((q, i) => [`${q.row},${q.col}`, Math.floor(i / 2) + 1]));
  // A black hole's mark: drawn, not lettered (the CSS above); with two
  // sets, the pair a mark places pulsing, the other faded.
  const holeMk = (set, more = "") => h("span", { className: `mk bh${more}${isHole && count === 2 ? (set === aim ? " live" : " idle") : ""}`, "data-set": set });

  const tap = (r, c) => {
    const at = marks.get(`${r},${c}`);
    if (at) {
      if (isHole) {
        // (A hole: its set is the one marks move now.)
        if (count === 2 && at.set !== aim) { setAim(at.set); audio && audio.playMark && audio.playMark(); }
        say("");
        return;
      }
      // A rolled spot becomes yours; one of yours comes off.
      const d = cloneSelections(draft);
      const list = spots.map((p) => (p === at.spot ? (p.random ? { ...p, random: false } : null) : p)).filter(Boolean);
      setSpots(d, list);
      setDraft(d); audio && audio.playMark && audio.playMark(); say("");
      return;
    }
    if (otherSet.has(`${r},${c}`)) { say(isHole ? "That square is cut out." : "That square is a singularity."); return; }
    // (A black hole's square: where the hole, or one of two, moves to.)
    const moved = isHole ? holeSpotsAfterTap(draft, r, c, count === 2 ? aim : 1) : null;
    const problem = isHole ? moved.problem : spotProblem(draft, kind, r, c, spots.filter(Boolean));
    if (problem) { say(SPOT_PROBLEMS[problem] || "Pick another square."); return; }
    const d = cloneSelections(draft);
    let list = spots.slice();
    if (isHole) list = moved.spots;
    else {
      if (list.length >= count) {
        const i = list.findIndex((p) => p.random);
        if (i < 0) { say(`All ${count} ${count === 1 ? "pair is" : "pairs are"} marked. Unmark one, or order more pairs.`); return; }
        list.splice(i, 1);
      }
      list.push({ row: r, col: c, random: false });
    }
    setSpots(d, list);
    audio && audio.playMark && audio.playMark();
    setDraft(d); say("");
  };
  const random = () => {
    const d = randomizeSpots(cloneSelections(draft), kind);
    setDraft(d); audio && audio.playMark && audio.playMark(); say("");
  };
  const done = () => onDone(fillSpots(cloneSelections(draft), kind));

  const maxW = Math.min(window.innerWidth - 64, 560), maxH = Math.max(160, window.innerHeight * 0.52);
  const cell = Math.max(14, Math.floor(Math.min(maxW / cols, maxH / rows)));
  const cells = [];
  // Rows from the far side (Light) down to Dark's, columns right to left
  // from Dark's seat, as the board lies at the start.
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const at = marks.get(`${r},${c}`);
      const cls = ["td-cell", (r + c) % 2 ? "dk" : "lt"];
      if (r < 2 || r >= rows - 2) cls.push("home");
      if (pieceAt(r, c)) cls.push("piece");
      if (!at && isHole && spotProblem(draft, "hole", r, c) === "backRow") cls.push("banned");
      // (Two sets: the squares beside the other pair's holes, where the
      // pair being placed can't go, hatched too.)
      else if (!at && isHole && count === 2 && !otherSet.has(`${r},${c}`) && holeSpotsAfterTap(draft, r, c, aim).problem === "near") cls.push("banned", "near");
      if (!at && !isHole && spotProblem(draft, "missing", r, c, spots) === "wall") cls.push("wall");
      const how = at ? `${at.mirror ? " mirror" : ""}${at.spot.random && !isHole ? " rolled" : ""}` : "";
      const mark = at ? (isHole ? holeMk(at.set, how) : h("span", { className: `mk${how}` }, "X"))
        : otherSet.has(`${r},${c}`) ? (isHole ? h("span", { className: "mk mirror" }, "X") : holeMk(otherSet.get(`${r},${c}`), " mirror")) : null;
      cells.push(h("button", {
        key: `${r},${c}`, type: "button", className: cls.join(" "),
        "data-testid": `tienda-cell-${r}-${c}`, "data-row": r, "data-col": c, "data-mark": at ? (at.mirror ? "mirror" : at.spot.random ? "rolled" : "hand") : "",
        "aria-label": `Row ${r + 1}, column ${c + 1}${at ? (isHole ? `, singularity${count === 2 ? ` of set ${at.set}` : ""}` : ", cut out") : ""}`,
        style: { width: cell, height: cell, fontSize: Math.max(10, cell * 0.55) },
        onClick: () => tap(r, c),
      }, mark));
    }
  }
  const title = isHole ? "Place the singularities" : "Mark the squares to cut out";
  const help = isHole
    ? count === 2
      ? "Choose a set, then mark a square: that set's singularity moves there, and its partner, turned half round, follows in the same pencil. Mark a singularity to choose its set. Then Done. Not in either side's two back rows, nor beside the other set's singularities (those squares are hatched). Dots show where the pieces start; mark one and they set out round it."
      : "Mark one square for the singularity; its partner, turned half round, is marked for you. Mark another to move them, then Done. Not in either side's two back rows. Dots show where the pieces start; mark one and they set out round it."
    : `Mark up to ${count} ${count === 1 ? "square" : "squares"} with an X; each one's partner, turned half round, is marked for you. Dashed marks were rolled at random: tap one to keep it. Dots show where the pieces start.`;
  return h("div", { className: "td-picker-layer", "data-testid": "tienda-picker", "data-kind": kind, role: "dialog", "aria-modal": "true", "aria-label": title,
    onClick: (e) => { if (e.target === e.currentTarget) onCancel(); } },
    h("div", { className: "td-picker" },
      h("h3", null, title),
      h("p", null, help),
      // (Two sets: which set a mark moves, the buttons in its pencil.)
      isHole && count === 2 && h("div", { className: "td-bh-key", role: "group", "aria-label": "The set a mark places", "data-testid": "tienda-hole-key" },
        [1, 2].map((n) => h("button", { key: n, type: "button", "data-set": n, "aria-pressed": aim === n ? "true" : "false", "data-testid": `tienda-hole-aim-${n}`, onClick: () => { setAim(n); say(""); } },
          h("i", { "data-set": n }), `Set ${n}`))),
      isHole && count === 2 && h("div", { className: "td-bh-status", "data-testid": "tienda-hole-status", "data-set": aim },
        h("i", { "data-set": aim }), `Now placing Set ${aim} (${aim === 1 ? "red" : "blue"} pencil): mark a square for its singularity.`),
      h("div", { className: "td-picker-side" }, `Far side · ${SIDE.light}`),
      h("div", { className: "td-grid", role: "grid", "aria-label": `${boardLabel(draft)} board`, style: { gridTemplateColumns: `repeat(${cols}, ${cell}px)` } }, cells),
      h("div", { className: "td-picker-side" }, `Your side · ${SIDE.dark}`),
      h("div", { key: note.n, className: `td-picker-note${note.text ? " pulse" : ""}`, role: "status", "data-testid": "tienda-picker-note" }, note.text),
      h("div", { className: "td-picker-btns" },
        h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-picker-random", onClick: random }, "Random"),
        h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-picker-cancel", onClick: onCancel }, "Cancel"),
        h("button", { type: "button", className: "td-btn td-primary", "data-testid": "tienda-picker-done", onClick: done }, "Done"),
      ),
    ),
  );
}

/* ------------------------------------------------------------ who's playing */

export function OpponentSection({ x, audio }) {
  const { aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY, busy, aiThinking } = x || {};
  if (!selectOpponent || !AI_DIFFICULTY) return null;
  const locked = !!(busy || aiThinking);
  const pick = (v) => { if (locked) return; audio && audio.playSelect && audio.playSelect(); selectOpponent(v); };
  // The demonstrator's side is shown in that side's wood (see sideSurface).
  const opt = (v, label, testid) => {
    const wood = v && sideSurface(v);
    return h("button", {
      type: "button", "aria-pressed": aiPlayer === v ? "true" : "false", "data-testid": testid, disabled: locked, onClick: () => pick(v),
      className: wood ? "td-wood" : undefined, "data-side": v || undefined,
      style: wood ? { background: wood.background, color: wood.color, textShadow: wood.textShadow } : undefined,
    }, label);
  };
  return h("div", { className: "td-opponent" },
    h("div", { className: "td-dim" },
      h("span", { className: "td-desc" }, "Opponent", h("span", null, "a friend at the table, or the store's demonstrator")),
    ),
    h("div", { className: "td-seg", role: "group", "aria-label": "Opponent", style: { padding: "10px 4px" } },
      opt(null, "Human", "tienda-opponent-human"),
      // (Each button is its side's wood already, so no dot; the word says
      // which is which, user.)
      opt("dark", `The demonstrator plays ${sideLabel(SIDE, "dark")}`, "tienda-opponent-dark"),
      opt("light", `The demonstrator plays ${sideLabel(SIDE, "light")}`, "tienda-opponent-light"),
    ),
    aiPlayer != null && h("div", { className: "td-dim" },
      h("span", { className: "td-desc" }, "How well it plays"),
      h("div", { className: "td-seg td-one", role: "group", "aria-label": "How well the demonstrator plays" },
        ...Object.entries(AI_DIFFICULTY).map(([key, cfg]) => h("button", {
          key, type: "button", "aria-pressed": aiDifficulty === key ? "true" : "false", "data-testid": `tienda-skill-${key}`, disabled: locked,
          onClick: () => { audio && audio.playSelect && audio.playSelect(); setAiDifficulty(key); },
        }, cfg.label)),
      ),
    ),
  );
}

/* ------------------------------------------------------------ carbon copies */

export const COPIES_KEY = "el-cabeza:tienda-orders";
function readCopies() {
  try { const v = JSON.parse(window.localStorage.getItem(COPIES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function writeCopies(list) {
  try { window.localStorage.setItem(COPIES_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
const when = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (e) { return ""; } };
const copySummary = (s) => {
  const laws = Object.values(s.laws || {}).filter(Boolean).length;
  return `${totalPieces(s)} pieces a side · ${laws} ${laws === 1 ? "rule" : "rules"} · ${boardLabel(s)}${s.missing ? ` · ${s.missingCount} cut` : ""}`;
};

export function CarbonCopies({ sel, onLoad, audio }) {
  const [copies, setCopies] = React.useState(readCopies);
  const [name, setName] = React.useState("");
  const [confirm, setConfirm] = React.useState(null);
  const [said, setSaid] = React.useState("");
  const file = () => {
    const nm = name.trim().slice(0, 40);
    if (!nm) { setSaid("Write a name on the copy first."); return; }
    const list = readCopies().filter((c) => c.name.toLowerCase() !== nm.toLowerCase());
    const n = Math.max(0, ...readCopies().map((c) => c.no || 0)) + 1;
    list.unshift({ id: `c${Date.now().toString(36)}`, no: n, name: nm, savedAt: Date.now(), selections: cloneSelections(sel) });
    if (!writeCopies(list)) { setSaid("This browser won't keep copies."); return; }
    setCopies(list); setName(""); setSaid(`Filed: "${nm}".`);
    audio && audio.playMenu && audio.playMenu();
  };
  const load = (c) => { onLoad(normalizeSelections(c.selections)); setSaid(`Copied from "${c.name}".`); audio && audio.playMenu && audio.playMenu(); };
  const toss = (c) => { const list = readCopies().filter((x) => x.id !== c.id); writeCopies(list); setCopies(list); setConfirm(null); setSaid(`"${c.name}" thrown away.`); };
  return h("div", { "data-testid": "tienda-copies" },
    h("div", { className: "td-copy-new" },
      h("label", { htmlFor: "tienda-copy-name", style: { font: `700 13px/1.2 ${FRANKLIN}` } }, "Name this order"),
      h("input", { id: "tienda-copy-name", "data-testid": "tienda-copy-name", value: name, maxLength: 40, placeholder: "e.g. Big board, singularities",
        onChange: (e) => setName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") file(); } }),
      h("button", { type: "button", className: "td-btn td-plain", "data-testid": "tienda-copy-save", onClick: file }, "File a copy"),
    ),
    said && h("div", { className: "td-form-note", role: "status", "data-testid": "tienda-copy-said", style: { padding: "0 4px 6px" } }, said),
    copies.length === 0
      ? h("div", { className: "td-form-note", style: { padding: "2px 4px 8px", color: "#6E5D4A" } }, "No copies on file yet.")
      : copies.map((c) => h("div", { key: c.id, className: "td-copy", "data-testid": `tienda-copy-${c.id}`, "data-name": c.name },
        h("div", null, h("b", null, `No. ${c.no || "—"} · ${c.name}`), `${copySummary(normalizeSelections(c.selections))} · filed ${when(c.savedAt)}`),
        confirm === c.id
          ? h("div", { className: "td-seg" },
            h("button", { type: "button", "data-testid": "tienda-copy-toss-yes", onClick: () => toss(c) }, "Throw away"),
            h("button", { type: "button", "data-testid": "tienda-copy-toss-no", onClick: () => setConfirm(null) }, "Keep"))
          : h("div", { className: "td-seg" },
            h("button", { type: "button", "data-testid": `tienda-copy-use-${c.id}`, onClick: () => load(c) }, "Use"),
            h("button", { type: "button", "data-testid": `tienda-copy-toss-${c.id}`, onClick: () => setConfirm(c.id) }, "Throw away")),
      )),
  );
}
