/* Nova's story (apps/unified.jsx).

   The game begins in the store (Tienda), where it's the classic game on
   the shelf: play it at the counter, look over the five pieces in the
   catalog, and "Purchase and bring home". That rings it up and takes it
   home to the den (Standard), where the whole mail-order catalog of pieces,
   rules and boards is open, and where the TV leads into Singularity
   (Neon). Once bought it stays bought (localStorage STORY_KEY): the next
   visit opens at home, with the store a tap away and "Start the story
   over" to begin again from the shelf.

   This file holds the story's memory and its scene changes (StoryCut):
   the register and its receipt when the game is bought, and a fade
   through black with a line of text between any two places. The places
   themselves are the themes; apps/unified.jsx swaps them under the black. */

import React, { useEffect, useRef, useState } from "react";

export const STORY_KEY = "el-cabeza:story";

export function readOwned() {
  try {
    const s = JSON.parse(localStorage.getItem(STORY_KEY) || "null");
    return !!(s && s.owned);
  } catch (e) {
    return false;
  }
}

/* After the whole story (the Singularity seen), a trip back to the store
   ends with the clerk and the manager never having heard of the game, and
   "Go home, confused." From then until the story starts over, there's no
   way back to the store (storeGone). */
export function readStoreGone() {
  try {
    const s = JSON.parse(localStorage.getItem(STORY_KEY) || "null");
    return !!(s && s.storeGone);
  } catch (e) {
    return false;
  }
}
let storeGoneThisVisit = false;
export function saveStoreGone() {
  storeGoneThisVisit = true;
  try { localStorage.setItem(STORY_KEY, JSON.stringify({ owned: true, storeGone: true })); } catch (e) { /* this visit only */ }
}
export const storeGone = () => storeGoneThisVisit || readStoreGone();
export function forgetStoreGone() { storeGoneThisVisit = false; }

export function saveOwned(owned) {
  try {
    if (owned) localStorage.setItem(STORY_KEY, JSON.stringify({ owned: true }));
    else localStorage.removeItem(STORY_KEY);
  } catch (e) {
    /* storage blocked: the purchase lasts this visit only */
  }
}

/* The register tape, 30 columns. The date is today's, in 1975. */
function receiptLines() {
  const d = new Date();
  const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getMonth()];
  const row = (l, r) => l + " ".repeat(Math.max(1, 30 - l.length - r.length)) + r;
  const mid = (s) => " ".repeat(Math.max(0, Math.floor((30 - s.length) / 2))) + s;
  return [
    mid("GAMES & HOBBY DEPT."),
    row(`${String(d.getDate()).padStart(2, "0")} ${mon} 75`, "REG 3  CLERK 07"),
    "-".repeat(30),
    row("1  EL CABEZA No.4417", "7.97"),
    row("   SUBTOTAL", "7.97"),
    row("   TAX", ".48"),
    row("   TOTAL", "8.45"),
    row("   CASH", "10.00"),
    row("   CHANGE", "1.55"),
    "-".repeat(30),
    mid("THANK YOU  PLEASE COME AGAIN"),
  ];
}

// The register's timing, shared with its sound (unifiedTransition.jsx,
// sfx.register): the keys and the bell, then a line of tape every LINE_MS.
export const PRINT_AT_MS = 1450;
export const LINE_MS = 150;

/* A jagged paper edge as a clip-path: teeth along the top, and along the
   bottom too once the tape is torn off. */
function tapeClip(torn) {
  const teeth = 22, depth = 6;
  const pts = [];
  for (let i = 0; i <= teeth * 2; i++) pts.push(`${((i / (teeth * 2)) * 100).toFixed(2)}% ${i % 2 ? 0 : depth}px`);
  if (torn) {
    for (let i = teeth * 2; i >= 0; i--) pts.push(`${((i / (teeth * 2)) * 100).toFixed(2)}% calc(100% - ${i % 2 ? 0 : depth}px)`);
  } else {
    pts.push("100% 100%", "0% 100%");
  }
  return `polygon(${pts.join(", ")})`;
}

const CSS = `
  .ns-cut { position: fixed; inset: 0; z-index: 3000; pointer-events: auto; cursor: default; -webkit-tap-highlight-color: transparent; }
  @keyframes ns-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ns-out { from { opacity: 1; } to { opacity: 0; } }
  .ns-dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 70%, rgba(24,15,8,0.5), rgba(12,7,3,0.82)); animation: ns-in 0.5s ease both; }
  .ns-register { position: absolute; left: 50%; bottom: max(18dvh, 120px); transform: translateX(-50%); width: min(300px, calc(100vw - 48px)); }
  .ns-tape { filter: drop-shadow(0 12px 22px rgba(0,0,0,0.5)); transition: transform 0.7s cubic-bezier(.2,.7,.2,1); transform-origin: 50% 100%; }
  .ns-tape.torn { transform: translateY(-28px) rotate(-3deg); }
  .ns-paper { box-sizing: border-box; overflow: hidden; padding: 16px 0 10px; background: linear-gradient(90deg, #EDE5CF, #F6F0DF 30%, #F4EDDB 70%, #E9E0C8);
    color: #4A3F66; font: 700 12.5px/1.5 'Courier Prime', 'Courier New', monospace; white-space: pre; text-align: center; transition: height 0.12s linear; }
  .ns-paper div { display: block; margin: 0 auto; text-align: left; width: 30ch; text-shadow: 0 0 0.5px rgba(74,63,102,0.6); }
  .ns-slot { position: absolute; left: -16px; right: -16px; bottom: -12px; height: 14px; border-radius: 3px;
    background: linear-gradient(#17100a, #3b2c20); box-shadow: inset 0 1px 0 rgba(255,240,210,0.16), 0 8px 20px rgba(0,0,0,0.5); transition: opacity 0.5s ease; }
  .ns-tape.torn + .ns-slot { opacity: 0; }
  .ns-black { position: absolute; inset: 0; background: #000; opacity: 0; }
  .ns-black.on { animation: ns-in 0.95s ease both; }
  .ns-black.off { animation: ns-out 1.1s ease both; }
  .ns-caption { position: absolute; left: 16px; right: 16px; top: 50%; transform: translateY(-50%); text-align: center; color: #EFE4CB;
    font: 500 clamp(24px, 4.6vw, 44px)/1.2 'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif; letter-spacing: 0.02em; opacity: 0; text-wrap: balance; }
  .ns-caption.on { animation: ns-in 0.6s ease both; }
  .ns-sub { display: block; max-width: 30em; margin: 0.9em auto 0; font: italic 400 clamp(14px, 2.2vw, 19px)/1.45 'Bodoni Moda', 'Didot', Georgia, serif; color: #CDBF9E; letter-spacing: 0.01em; }
  .ns-caption.off { animation: ns-out 0.5s ease both; }
  /* (The second line comes up on its own, two seconds after the first, user.) */
  .ns-caption.on .ns-sub { animation: ns-in 0.8s ease 2s both; }
  @media (prefers-reduced-motion: reduce) {
    .ns-tape, .ns-paper, .ns-slot { transition-duration: 0.01s; }
    .ns-dim, .ns-black.on, .ns-black.off, .ns-caption.on, .ns-caption.off { animation-duration: 0.01s; }
    .ns-caption.on .ns-sub { animation-duration: 0.01s; animation-delay: 0s; }
  }
`;

/* A scene change. cut.kind "purchase": the dim, the register (sfx), the
   tape printing line by line over the store and torn off; then, as for any
   cut, the fade to black and cut.caption. Under full black it calls onSwap
   (the app changes the place there) and waits for cut.arrived: the app
   sets it once the new place has mounted and built its room. Two frames
   later (it has drawn) and a moment to read the caption, it fades up on it
   and calls onDone. A tap during the tape goes straight to the black. */
export function StoryCut({ cut, onSwap, onDone, sfx }) {
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const purchase = cut.kind === "purchase";
  const lines = useRef(receiptLines()).current;
  const [printed, setPrinted] = useState(0);
  const [torn, setTorn] = useState(false);
  const [stage, setStage] = useState(purchase ? "tape" : "start"); // (start | tape) -> dark -> reveal
  const [caption, setCaption] = useState(null); // null | "on" | "off"
  const [swapped, setSwapped] = useState(false);
  const timers = useRef([]);
  const after = (ms, fn) => { timers.current.push(setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const darkened = useRef(false);
  const captionAt = useRef(0);

  // The fade to black and the swap under it.
  const toDark = () => {
    if (darkened.current) return;
    darkened.current = true;
    clear();
    setStage("dark");
    const fade = reduced ? 50 : 950;
    after(fade, () => { setCaption("on"); captionAt.current = performance.now(); });
    after(fade + 250, () => { setSwapped(true); onSwap(); });
  };

  useEffect(() => {
    if (!purchase) { toDark(); return clear; }
    if (sfx && sfx.register) sfx.register({ printAt: PRINT_AT_MS / 1000, lines: lines.length, lineGap: LINE_MS / 1000 });
    if (reduced) {
      setPrinted(lines.length);
      after(1400, () => setTorn(true));
      after(2000, toDark);
      return clear;
    }
    lines.forEach((_, i) => after(PRINT_AT_MS + i * LINE_MS, () => setPrinted(i + 1)));
    const tearAt = PRINT_AT_MS + lines.length * LINE_MS + 250;
    after(tearAt, () => setTorn(true));
    after(tearAt + 900, toDark);
    return clear;
  }, []);

  // The fade up, once the new place is there and has drawn.
  useEffect(() => {
    if (!cut.arrived) return undefined;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        // (A second line takes longer to read, and comes up 2 s after the
        // first: 2 s, its fade, and about four seconds on it.)
        const read = Math.max(0, (reduced ? 400 : cut.sub ? 6800 : 1700) - (performance.now() - captionAt.current));
        after(read, () => setCaption("off"));
        after(read + (reduced ? 50 : 500), () => setStage("reveal"));
        after(read + (reduced ? 100 : 1650), () => onDone());
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [cut.arrived]);

  useEffect(() => clear, []);

  const lineH = 12.5 * 1.5;
  const clip = tapeClip(torn);
  return (
    <div
      className="ns-cut"
      data-testid="story-cut"
      data-stage={stage}
      data-kind={cut.kind}
      onClick={() => { if (stage === "tape") toDark(); }}
    >
      <style>{CSS}</style>
      {purchase && !swapped && (
        <>
          <div className="ns-dim on" />
          <div className="ns-register" aria-hidden={stage !== "tape"}>
            <div className={"ns-tape" + (torn ? " torn" : "")}>
              <div
                className="ns-paper"
                data-testid="story-receipt"
                data-lines={printed}
                role="img"
                aria-label="Receipt: El Cabeza, 7.97, tax .48, total 8.45"
                style={{ height: printed ? `${printed * lineH + 26}px` : "0px", paddingTop: printed ? 16 : 0, clipPath: clip, WebkitClipPath: clip }}
              >
                {lines.slice(0, printed).map((l, i) => (
                  <div key={i} style={{ opacity: 0.82 + ((i * 37) % 17) / 100 }}>{l}</div>
                ))}
              </div>
            </div>
            <div className="ns-slot" />
          </div>
        </>
      )}
      <div className={"ns-black" + (stage === "dark" ? " on" : stage === "reveal" ? " off" : "")} />
      <div className={"ns-caption" + (caption ? " " + caption : "")} data-testid="story-caption" role="status" aria-live="polite">
        {caption ? cut.caption : ""}
        {caption && cut.sub ? <span className="ns-sub">{cut.sub}</span> : null}
      </div>
    </div>
  );
}
