import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/* A new player's first game, walked through (user, 2026-10-17: "They
   click begin a game, and then a little pop-up will say, "Welcome to your
   first game of El Cabeza." Copyright 1975 ... You are the light / ash
   colored pieces, and you're trying to get your disc to the other
   player's back row or use your blocks to crush their disc ... this needs
   to be a walkthrough basically as to how to play the game ... it'll
   say, you get to move first ... you have two action points ... the board
   is fully rotatable and zoomable. They click on a piece and it'll say
   what it is. And then it'll show what the movements are. And it'll kind
   of zoom in on it a little bit ... We need to create a first-time player
   walkthrough tutorial"; then, 2026-10-18: "Highlight the pieces as
   they're explained. Arrows to indicate stuff will be helpful. Make it
   perfectly transparent how the game is played. Hand-holding is
   encouraged here"; and: "when says "or crush the opponent's Cabeza", it
   should cut to a zoomed-in example of this happening to illustrate.
   Before the win conditions are shown, it should be mentioned that there
   are 2 ways to win, and then show them").

   The chassis runs it (ElCabeza3D.jsx, tourStep) and hands this the
   moment as `tour`. As the game begins, a card at the top for each thing
   to know, one after another (TOUR_CARDS): who you are, that there are
   two ways to win, the first (your Cabeza across), the second (a crush,
   shown up close: the camera cuts to a block of yours rolling onto the
   other side's Cabeza, ElCabeza3D.jsx's tourCrush), your blocks, your
   turn, the board; the computer
   waits until they're through. Each lights up what it speaks of, the
   board turned to show it all: the pieces ringed on the board (the
   chassis's tourGroup), the words and the arrows over the screen
   (TourMarks, below). Then your first turn: your pieces that can move
   glow, named; tap one and the card says what it is, how far it moves
   and how many times a turn, the camera comes a little closer, and an
   arrow runs to every square it can reach. Once your turn's done, a
   card for the other side's turn, which shows what it moved (an arrow
   from where it was) and stays until it's put away or a piece is picked
   on your next; then it's over. Any card can skip it. Kept as done on the
   device (TOUR_KEY), so it comes once; ?fresh forgets it. A world offers
   it with theme.firstGameTour (the store, before the game's bought:
   tienda.js). */

export const TOUR_KEY = "el-cabeza:first-game-tour";
export function tourDone() {
  try { return window.localStorage.getItem(TOUR_KEY) === "done"; } catch (e) { return false; }
}
export function markTourDone() {
  try { window.localStorage.setItem(TOUR_KEY, "done"); } catch (e) { /* storage unavailable */ }
}

// The cards before you play, in order; then "pieces" (your first turn)
// and "foe" (the other side's turn after it).
export const TOUR_CARDS = ["welcome", "ways", "goal", "crush", "blocks", "turn", "board"];

/* The marks' colours, bright against the board and its pieces, each with
   the name the cards call it by: yours, the other side's, the row you
   win on, and a piece that can't move yet. */
export const TOUR_TONES = { mine: "#FFD23F", foe: "#FF5470", goal: "#3FDB7C", dim: "#D9D0C1" };
const TONE_NAMES = { mine: "yellow", foe: "red", goal: "green" };

const WORDS = ["no", "one", "two", "three", "four", "five"];
const word = (n) => WORDS[n] || String(n);
const mono = "'IBM Plex Mono', monospace";
const sans = "'IBM Plex Sans', sans-serif";
// "the Turrito, the Flaco and the Opa"
const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// What a card says: { title, sub, body: [...], rows: [[label, text]], note }.
function cardText(t) {
  const tap = t.touch ? "tap" : "click";
  const foe = t.foe;
  switch (t.step) {
    case "welcome":
      return {
        title: (t.copy && t.copy.title) || "Welcome to your first game of El Cabeza.",
        sub: (t.copy && t.copy.fine) || null,
        body: [
          `You play ${t.mine}: the ${t.mineHint || "near"} pieces on your side, ringed in ${TONE_NAMES.mine}.`,
          `The computer plays ${foe}: the ${t.foeHint ? `${t.foeHint} pieces` : "pieces"} across the board, ringed in ${TONE_NAMES.foe}.`,
          "This short tour shows you how to play. The computer waits until you're ready.",
        ],
      };
    case "ways":
      return {
        title: "There are two ways to win.",
        body: [
          `1. Get your Cabeza across the board to ${foe}'s back row.`,
          `2. Crush ${foe}'s Cabeza with one of your blocks.`,
          "Here's each one.",
        ],
      };
    case "goal":
      return {
        title: "1. Get your Cabeza across.",
        body: [
          `This disc is your Cabeza. Bring it all the way to ${foe}'s back row, the far edge lit ${TONE_NAMES.goal}, and you win.`,
          "It steps one square at a time, any way, corners too.",
        ],
      };
    case "crush":
      return {
        title: `2. Crush ${foe}'s Cabeza.`,
        body: [
          `Roll one of your blocks onto ${foe}'s Cabeza and it's crushed: you win. Here it is, up close.`,
          `${foe} wins the same two ways, so keep your own Cabeza out from under ${foe}'s blocks.`,
        ],
      };
    case "blocks":
      return {
        title: t.blocks.length === 4 ? "Your four blocks." : "Your blocks.",
        body: [
          t.blocks.length ? `${cap(list(t.blocks.map((n) => `the ${n}`)))}, named on the board.` : null,
          "A block moves by rolling: it tips over one of its edges into the next squares, never corner to corner.",
          "Only a block can crush. A Cabeza can't.",
        ],
      };
    case "turn":
      return {
        title: t.youFirst ? "You move first." : `${foe} moves first.`,
        body: [
          `Each turn you get ${word(t.budget)} actions${t.split ? `, shared by up to ${word(t.split)} pieces` : ", all for one piece"}. A roll or a step costs one${t.hasOpa ? "; the Opa's roll costs two" : ""}.`,
          // (The Punto law cuts the opening turn by one: said where it's on.)
          t.punto ? `${t.youFirst ? "Your" : `${foe}'s`} very first turn has one action fewer: this game plays the Punto law.` : null,
          t.dots || null,
          `When they're used up, your turn ends and ${foe} moves.`,
        ],
      };
    case "board":
      return {
        title: "Turn the board any way you like.",
        body: [
          t.touch ? "Drag a finger across it to turn it all the way around. Pinch to zoom in or out." : "Drag across it to turn it all the way around. Scroll to zoom in or out.",
          "It doesn't change the game: look from wherever helps.",
        ],
      };
    case "pieces": {
      if (t.waiting) return { title: `${foe} is moving.`, body: ["Your turn's next."] };
      const l = t.lesson;
      if (!l) {
        return {
          title: `Your move: ${tap} a glowing piece.`,
          body: [
            "Each one moves its own way. Pick one to see its name, how it moves, and an arrow to every square it can reach.",
            t.boxed.length ? `${cap(list(t.boxed))} ${t.boxed.length === 1 ? "is" : "are"} boxed in for now: move another piece out of the way first.` : null,
          ],
        };
      }
      const rows = [["Moves", l.moves], ["A turn", l.turn]];
      if (l.aim) rows.push(["Aim", l.aim]);
      (l.extra || []).forEach((x) => rows.push(["Also", x]));
      return { title: l.name, sub: l.what || null, rows, note: t.status || null };
    }
    case "foe":
      if (t.waiting) return { title: `${foe}'s turn.`, body: ["Watch the board: the computer moves one of its pieces."] };
      return t.moved.length
        ? { title: `${foe} moved its ${list(t.moved)}.`, body: [`The ${TONE_NAMES.foe} arrow shows where from.`, `Your turn again: ${tap} any of your pieces to see what it does. Good luck!`] }
        : { title: "Your turn again.", body: [`${cap(tap)} any of your pieces to see what it does. Good luck!`] };
    default:
      return null;
  }
}

export default function FirstGameTour({ tour, cardRef }) {
  const { step, C, display } = tour;
  const card = TOUR_CARDS.includes(step);
  // A card before you play: Escape skips the tour, as its link does.
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === "Escape") tour.skip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, tour.skip]);
  /* The card keeps below what a world fixes at the top over it where the
     two would meet: the corner menu's tab, and whatever the world names
     (copy.clear; a phone: the store's price tag lay over the card's
     head). */
  const clear = ['[data-testid="corner-menu-tab"]', tour.copy && tour.copy.clear].filter(Boolean).join(", ");
  const [below, setBelow] = useState(0);
  useLayoutEffect(() => {
    const place = () => {
      const el = cardRef && cardRef.current;
      if (!el) return;
      const a = el.getBoundingClientRect();
      let low = 0;
      document.querySelectorAll(clear).forEach((x) => {
        const b = x.getBoundingClientRect();
        if (b.width && b.height && b.right > a.left && b.left < a.right && b.top < window.innerHeight / 3) low = Math.max(low, b.bottom);
      });
      setBelow(low ? Math.round(low + 8) : 0);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [step, cardRef, clear]);
  const narrow = typeof window !== "undefined" && window.innerWidth < 520;
  // On a wide screen the card keeps to the left, so the board has the
  // room beside it (the tour's camera frames it there).
  const side = typeof window !== "undefined" && window.innerWidth >= 900;
  const text = cardText(tour);
  if (!text) return null;
  const index = TOUR_CARDS.indexOf(step);
  const of = TOUR_CARDS.length + 1;
  const band = `${(tour.copy && tour.copy.band) || "First game"}${card ? ` · ${index + 1} of ${of}` : step === "pieces" ? ` · ${of} of ${of}` : ""}`;
  const primary = card
    ? { label: index < TOUR_CARDS.length - 1 ? "Next ›" : "Let's play ›", onClick: tour.next, testid: "tour-next" }
    : step === "foe" && !tour.waiting ? { label: "Got it", onClick: tour.finish, testid: "tour-done" } : null;
  const link = card
    ? { label: "Skip the tour", onClick: tour.skip, testid: "tour-skip" }
    : { label: "End the tour", onClick: tour.finish, testid: "tour-end" };
  const css = "@keyframes ecTourIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes ecTourDrop{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion: reduce){[data-testid=\"tour-card\"]{animation:none!important}}";
  return (
    <>
      <style>{css}</style>
      <div
        ref={cardRef}
        key={step}
        data-testid="tour-card"
        data-step={step}
        role={card ? "dialog" : "status"}
        aria-live={card ? undefined : "polite"}
        aria-labelledby="ec-tour-title"
        style={{
          position: "fixed",
          top: below ? below : "calc(var(--ec-shell-top, env(safe-area-inset-top, 0px)) + 12px)",
          left: side ? "max(16px, env(safe-area-inset-left, 0px))" : "50%",
          transform: side ? "none" : "translateX(-50%)",
          zIndex: 13,
          width: side ? 360 : "min(calc(100vw - 32px), 440px)",
          // (A phone on its side: the card scrolls rather than runs off.)
          maxHeight: `calc(100vh - ${below ? below + 12 : 24}px)`,
          overflowY: "auto",
          animation: side ? "ecTourIn 0.3s ease both" : "ecTourDrop 0.3s ease both",
          boxSizing: "border-box",
          padding: narrow ? "10px 13px 9px" : "13px 16px 12px",
          borderRadius: 10,
          background: C.cream,
          border: `1px solid ${C.slateSoft}`,
          boxShadow: "0 14px 40px rgba(0,0,0,0.32)",
          color: C.charcoal,
          fontFamily: sans,
          fontSize: narrow ? 13 : 14,
          lineHeight: 1.45,
          pointerEvents: "auto",
        }}
      >
        <div data-testid="tour-band" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.slate, marginBottom: 6 }}>
          {band}
        </div>
        <h2 id="ec-tour-title" data-testid="tour-title" style={{ margin: 0, fontFamily: display, fontWeight: 600, fontSize: step === "welcome" ? (narrow ? 19 : 21) : narrow ? 16.5 : 18.5, lineHeight: 1.2, textWrap: "balance" }}>
          {text.title}
        </h2>
        {text.sub && (
          <div data-testid="tour-sub" style={{ marginTop: 3, fontFamily: step === "welcome" ? mono : sans, fontSize: step === "welcome" ? 11 : 13, letterSpacing: step === "welcome" ? "0.14em" : 0, color: C.slate }}>
            {text.sub}
          </div>
        )}
        {text.body && (
          <div data-testid="tour-body" style={{ marginTop: narrow ? 6 : 8, display: "flex", flexDirection: "column", gap: narrow ? 5 : 7 }}>
            {text.body.filter(Boolean).map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}
          </div>
        )}
        {text.rows && (
          <div data-testid="tour-rows" style={{ marginTop: narrow ? 6 : 8, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 10, rowGap: narrow ? 3 : 5, alignItems: "baseline" }}>
            {text.rows.map(([k, v], i) => (
              <React.Fragment key={k + i}>
                <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.slate, whiteSpace: "nowrap" }}>{k}</span>
                <span data-testid={`tour-row-${k.toLowerCase().replace(/\s+/g, "-")}`}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {text.note && (
          <div data-testid="tour-note" style={{ marginTop: narrow ? 6 : 8, paddingTop: narrow ? 5 : 7, borderTop: `1px solid ${C.slateSoft}`, fontWeight: 600 }}>
            {text.note}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: primary ? "space-between" : "flex-end", gap: 12, marginTop: narrow ? 6 : 10 }}>
          <button type="button" data-testid={link.testid} onClick={link.onClick} style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", color: C.slate, fontFamily: sans, fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {link.label}
          </button>
          {primary && (
            <button
              type="button"
              className="ec-btn"
              data-testid={primary.testid}
              onClick={primary.onClick}
              autoFocus={card}
              style={{ background: C.charcoal, color: C.cream, border: `1px solid ${C.charcoal}`, borderRadius: 6, padding: narrow ? "8px 15px" : "9px 17px", cursor: "pointer", fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}
            >
              {primary.label}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* The tour's words and arrows over the screen, kept on what they point at
   as the board turns: a label by each thing named (a piece, a group of
   them, a row, a button), with an arrow to it; a ring round a button it
   points out; arrows round the board, and a fingertip along them, where
   it says the board turns; an arrow for a move. `marks` says what
   ({ tags, arrows, boxes, orbit, avoid }); `geo` finds where it is on the
   screen (the chassis's camera:
   rect(at), center(), corners()); `subscribe` runs a function at each
   frame the board's drawn (before it's drawn: the camera placed). The
   labels keep off one another, off the card and off what `avoid` names;
   the arrows run from a label's edge to the edge of what it names. */
const HALO = "rgba(22,14,6,0.62)";
export function TourMarks({ marks, geo, subscribe, cardRef }) {
  const tagEls = useRef({});
  const lineEls = useRef({});
  const boxEls = useRef({});
  const orbitEls = useRef({});
  useEffect(() => {
    if (!marks || !subscribe || !geo) return undefined;
    const tags = marks.tags || [];
    const sizes = {};
    tags.forEach((g) => { const e = tagEls.current[g.key]; if (e) sizes[g.key] = { w: e.offsetWidth, h: e.offsetHeight }; });
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noLine = (l) => { l.halo.setAttribute("d", ""); l.line.setAttribute("d", ""); l.head.setAttribute("d", ""); };
    const hide = (k) => {
      const e = tagEls.current[k]; if (e) e.style.transform = "translate(-300vw, 0)";
      const l = lineEls.current[k]; if (l) noLine(l);
    };
    const head = (x, y, ux, uy, s) => {
      const bx = x - ux * s, by = y - uy * s, px = -uy * s * 0.55, py = ux * s * 0.55;
      return `M${x.toFixed(1)},${y.toFixed(1)}L${(bx + px).toFixed(1)},${(by + py).toFixed(1)}L${(bx - px).toFixed(1)},${(by - py).toFixed(1)}Z`;
    };
    const pad = (r, p) => ({ l: r.l - p, t: r.t - p, r: r.r + p, b: r.b + p });
    const frame = (now) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const obstacles = [];
      const cardEl = cardRef && cardRef.current;
      if (cardEl) { const c = cardEl.getBoundingClientRect(); if (c.width) obstacles.push(pad({ l: c.left, t: c.top, r: c.right, b: c.bottom }, 8)); }
      (marks.avoid || []).forEach((sel) => document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.height) obstacles.push(pad({ l: r.left, t: r.top, r: r.right, b: r.bottom }, 6)); }));

      // Rings round the buttons it points out.
      (marks.boxes || []).forEach((bx) => {
        const els = boxEls.current[bx.key];
        if (!els) return;
        const r = geo.rect({ el: bx.sel });
        [els.halo, els.ring].forEach((e) => {
          if (!r) { e.setAttribute("width", 0); return; }
          e.setAttribute("x", r.l - 7); e.setAttribute("y", r.t - 7);
          e.setAttribute("width", r.r - r.l + 14); e.setAttribute("height", r.b - r.t + 14);
        });
      });

      // Round the board: an arrow along its near edge and one along its
      // far edge, the same way round, and a fingertip along the near one.
      const anchors = {};
      if (marks.orbit && orbitEls.current.near) {
        const q = geo.corners();
        const o = orbitEls.current;
        if (q) {
          const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
          const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
          const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 18, ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 18;
          const P = (deg) => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];
          /* The way round a drag turns it: a finger's drag right along the
             near edge carries that edge right (the far one goes left); a
             mouse's, wherever it begins, carries the far edge right (the
             near one goes left). The fingertip shows the drag. */
          const mouse = !!marks.orbit.mouse;
          const arcD = (a0, a1) => { const [x0, y0] = P(a0), [x1, y1] = P(a1); return `M${x0.toFixed(1)},${y0.toFixed(1)}A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 ${a1 > a0 ? 1 : 0} ${x1.toFixed(1)},${y1.toFixed(1)}`; };
          const tip = (deg, rising) => { const [x, y] = P(deg); const a = (deg * Math.PI) / 180; let ux = (rising ? -1 : 1) * rx * Math.sin(a), uy = (rising ? 1 : -1) * ry * Math.cos(a); const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n; return head(x + ux * 6, y + uy * 6, ux, uy, 15); };
          (mouse ? [["near", 38, 140], ["far", -142, -40]] : [["near", 140, 38], ["far", -40, -142]]).forEach(([k, a0, a1]) => {
            o[k].halo.setAttribute("d", arcD(a0, a1)); o[k].line.setAttribute("d", arcD(a0, a1)); o[k].head.setAttribute("d", tip(a1, a1 > a0));
          });
          const s = still ? 0.5 : (now % 2000) / 2000;
          const e = s * s * (3 - 2 * s);
          const [fx, fy] = P(mouse ? -142 + 102 * e : 140 - 102 * e);
          o.finger.setAttribute("cx", fx.toFixed(1)); o.finger.setAttribute("cy", fy.toFixed(1));
          o.finger.setAttribute("opacity", still ? 0.9 : Math.max(0, Math.min(1, s / 0.12, (1 - s) / 0.12)).toFixed(2));
          const [bx, by] = P(90);
          anchors.orbit = { l: bx - 30, t: by - 4, r: bx + 30, b: by + 4, dir: [0, 1] };
        } else ["near", "far"].forEach((k) => noLine(o[k]));
      }

      // A move's arrow: from the middle of one thing to the middle of the
      // other (or short of it, trimEnd: to its edge), bowed to the left of
      // its way, so several from one piece fan out.
      (marks.arrows || []).forEach((ar) => {
        const l = lineEls.current[`arrow-${ar.key}`];
        if (!l) return;
        const a = geo.rect(ar.from), b = geo.rect(ar.to);
        if (!a || !b) { noLine(l); return; }
        const P0 = [(a.l + a.r) / 2, (a.t + a.b) / 2];
        let P2 = [(b.l + b.r) / 2, (b.t + b.b) / 2];
        const len = Math.hypot(P2[0] - P0[0], P2[1] - P0[1]);
        if (len < 12) { noLine(l); return; }
        const bend = ar.bend == null ? 0.2 : ar.bend;
        const P1 = [(P0[0] + P2[0]) / 2 + ((P2[1] - P0[1]) / len) * len * bend, (P0[1] + P2[1]) / 2 - ((P2[0] - P0[0]) / len) * len * bend];
        if (ar.trimEnd) {
          const rx = Math.max(6, ((b.r - b.l) / 2) * 0.9), ry = Math.max(6, ((b.b - b.t) / 2) * 0.9);
          let ux = P1[0] - P2[0], uy = P1[1] - P2[1];
          const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
          const q = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2) + 3;
          if (q < len * 0.6) P2 = [P2[0] + ux * q, P2[1] + uy * q];
        }
        let ex = P2[0] - P1[0], ey = P2[1] - P1[1];
        const en = Math.hypot(ex, ey) || 1; ex /= en; ey /= en;
        const hs = Math.min(15, len * 0.3);
        const f = (v) => v.toFixed(1);
        const d = `M${f(P0[0])},${f(P0[1])}Q${f(P1[0])},${f(P1[1])} ${f(P2[0] - ex * hs * 0.8)},${f(P2[1] - ey * hs * 0.8)}`;
        l.halo.setAttribute("d", d); l.line.setAttribute("d", d); l.head.setAttribute("d", head(P2[0], P2[1], ex, ey, hs));
      });

      // The labels: each set off what it names, away from the middle of
      // the group named (or the board's), then kept apart.
      const items = [];
      tags.forEach((g) => {
        const a = g.at.orbit ? anchors.orbit : geo.rect(g.at);
        const s = sizes[g.key];
        if (!a || !s) { hide(g.key); return; }
        items.push({ g, a, w: s.w, h: s.h });
      });
      if (!items.length) return;
      const onBoard = items.filter((i) => i.g.at.piece);
      let mid;
      if (onBoard.length >= 3) mid = { x: onBoard.reduce((n, i) => n + (i.a.l + i.a.r) / 2, 0) / onBoard.length, y: onBoard.reduce((n, i) => n + (i.a.t + i.a.b) / 2, 0) / onBoard.length };
      else mid = geo.center() || { x: vw / 2, y: vh / 2 };
      items.forEach((it) => {
        const { a, g } = it;
        const ax = (a.l + a.r) / 2, ay = (a.t + a.b) / 2, aw = a.r - a.l, ah = a.b - a.t;
        let [dx, dy] = a.dir || { above: [0, -1], below: [0, 1], left: [-1, 0], right: [1, 0] }[g.side] || [ax - mid.x, ay - mid.y];
        const n = Math.hypot(dx, dy);
        if (n < 1e-3) { dx = 0; dy = -1; } else { dx /= n; dy /= n; }
        const gap = g.at.el ? 22 : 16;
        const tx = Math.abs(dx) > 1e-3 ? (aw / 2 + it.w / 2 + gap) / Math.abs(dx) : Infinity;
        const ty = Math.abs(dy) > 1e-3 ? (ah / 2 + it.h / 2 + gap) / Math.abs(dy) : Infinity;
        const tt = Math.min(tx, ty);
        it.x = ax + dx * tt - it.w / 2;
        it.y = ay + dy * tt - it.h / 2;
        it.ax = ax; it.ay = ay;
      });
      const others = items.map((i) => pad(i.a, 4));
      const push = (it, o) => {
        const l = it.x, t = it.y, r = it.x + it.w, b = it.y + it.h;
        if (r <= o.l || l >= o.r || b <= o.t || t >= o.b) return false;
        const mx = [o.l - r, o.r - l], my = [o.t - b, o.b - t];
        const sx = Math.abs(mx[0]) < Math.abs(mx[1]) ? mx[0] : mx[1], sy = Math.abs(my[0]) < Math.abs(my[1]) ? my[0] : my[1];
        if (Math.abs(sx) < Math.abs(sy)) it.x += sx; else it.y += sy;
        return true;
      };
      for (let k = 0; k < 24; k++) {
        let moved = false;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const A = items[i], B = items[j];
            const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) + 6, oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) + 4;
            if (ox <= 0 || oy <= 0) continue;
            moved = true;
            if (ox < oy) { const s = ((A.x + A.w / 2 < B.x + B.w / 2 ? -1 : 1) * ox) / 2; A.x += s; B.x -= s; }
            else { const s = ((A.y + A.h / 2 < B.y + B.h / 2 ? -1 : 1) * oy) / 2; A.y += s; B.y -= s; }
          }
        }
        items.forEach((it, i) => {
          obstacles.forEach((o) => { if (push(it, o)) moved = true; });
          others.forEach((o, j) => { if (j !== i && push(it, o)) moved = true; });
          it.x = Math.max(6, Math.min(vw - 6 - it.w, it.x));
          it.y = Math.max(6, Math.min(vh - 6 - it.h, it.y));
        });
        if (!moved) break;
      }
      items.forEach((it) => {
        const e = tagEls.current[it.g.key];
        if (e) e.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px)`;
        const l = lineEls.current[it.g.key];
        if (!l) return;
        if (it.g.at.orbit) { noLine(l); return; }
        // From the label's edge toward what it names, to that thing's edge
        // (a piece's: an oval inside its box on the screen; a button's,
        // its ring).
        const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        let dx = it.ax - cx, dy = it.ay - cy;
        const sx = Math.abs(dx) > 1e-3 ? it.w / 2 / Math.abs(dx) : Infinity, sy = Math.abs(dy) > 1e-3 ? it.h / 2 / Math.abs(dy) : Infinity;
        const s0 = Math.min(sx, sy);
        if (!(s0 < 1)) { noLine(l); return; }
        const x0 = cx + dx * s0, y0 = cy + dy * s0;
        const a = it.a, aw = (a.r - a.l) / 2, ah = (a.b - a.t) / 2;
        let ex, ey;
        dx = x0 - it.ax; dy = y0 - it.ay;
        if (it.g.at.el) {
          const qx = Math.abs(dx) > 1e-3 ? (aw + 11) / Math.abs(dx) : Infinity, qy = Math.abs(dy) > 1e-3 ? (ah + 11) / Math.abs(dy) : Infinity;
          const q = Math.min(qx, qy, 1);
          ex = it.ax + dx * q; ey = it.ay + dy * q;
        } else {
          const rx = Math.max(6, aw * 0.92), ry = Math.max(6, ah * 0.92);
          const q = Math.min(1, 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2));
          const nn = Math.hypot(dx, dy) || 1;
          ex = it.ax + dx * q + (dx / nn) * 3; ey = it.ay + dy * q + (dy / nn) * 3;
        }
        const len = Math.hypot(ex - x0, ey - y0);
        if (len < 9) { noLine(l); return; }
        const ux = (ex - x0) / len, uy = (ey - y0) / len;
        const hs = Math.min(11, len * 0.6);
        const d = `M${x0.toFixed(1)},${y0.toFixed(1)}L${(ex - ux * hs * 0.8).toFixed(1)},${(ey - uy * hs * 0.8).toFixed(1)}`;
        l.halo.setAttribute("d", d); l.line.setAttribute("d", d); l.head.setAttribute("d", head(ex, ey, ux, uy, hs));
      });
    };
    tags.forEach((g) => hide(g.key));
    return subscribe(frame);
  }, [marks, geo, subscribe, cardRef]);
  if (!marks) return null;
  const tone = (k) => TOUR_TONES[k] || TOUR_TONES.mine;
  const keep = (store, k, part) => (e) => { if (e) store.current[k] = { ...(store.current[k] || {}), [part]: e }; };
  const line = (k, t, w = 2.6) => (
    <g key={k}>
      <path ref={keep(lineEls, k, "halo")} fill="none" stroke={HALO} strokeWidth={w + 3.4} strokeLinecap="round" />
      <path ref={keep(lineEls, k, "line")} data-arrow={k} fill="none" stroke={tone(t)} strokeWidth={w} strokeLinecap="round" />
      <path ref={keep(lineEls, k, "head")} fill={tone(t)} stroke={HALO} strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  );
  const orbitPart = (k, t) => (
    <g key={k} data-orbit={k}>
      <path ref={keep(orbitEls, k, "halo")} fill="none" stroke={HALO} strokeWidth={7.5} strokeLinecap="round" />
      <path ref={keep(orbitEls, k, "line")} className="ec-tour-march" fill="none" stroke={tone(t)} strokeWidth={4} strokeLinecap="round" strokeDasharray="14 9" />
      <path ref={keep(orbitEls, k, "head")} fill={tone(t)} stroke={HALO} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  );
  return (
    <div data-testid="tour-marks" aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 12, overflow: "hidden" }}>
      <style>{"@keyframes ecTourPulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes ecTourMarch{to{stroke-dashoffset:-46}}.ec-tour-pulse{animation:ecTourPulse 1.3s ease-in-out infinite}.ec-tour-march{animation:ecTourMarch 1.1s linear infinite}@media (prefers-reduced-motion: reduce){.ec-tour-pulse,.ec-tour-march{animation:none}}"}</style>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {(marks.boxes || []).map((bx) => (
          <g key={bx.key} data-ring={bx.key}>
            <rect ref={keep(boxEls, bx.key, "halo")} rx={12} fill="none" stroke={HALO} strokeWidth={7} width={0} height={0} />
            <rect ref={keep(boxEls, bx.key, "ring")} className="ec-tour-pulse" rx={12} fill="none" stroke={tone(bx.tone)} strokeWidth={3.5} width={0} height={0} />
          </g>
        ))}
        {marks.orbit && [orbitPart("near", marks.orbit.tone), orbitPart("far", marks.orbit.tone)]}
        {marks.orbit && (
          <circle ref={(e) => { if (e) orbitEls.current.finger = e; }} data-orbit="finger" r={11} cx={-99} cy={-99} fill="rgba(255,255,255,0.92)" stroke={HALO} strokeWidth={3} />
        )}
        {(marks.arrows || []).map((ar) => line(`arrow-${ar.key}`, ar.tone, 3.4))}
        {(marks.tags || []).map((g) => line(g.key, g.tone))}
      </svg>
      {(marks.tags || []).map((g) => (
        <div
          key={g.key}
          ref={(e) => { if (e) tagEls.current[g.key] = e; }}
          data-tag={g.key}
          className="ec-tour-tag"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: "translate(-300vw, 0)",
            whiteSpace: "nowrap",
            padding: "4px 8px 3px",
            borderRadius: 4,
            background: tone(g.tone),
            color: "#1B1209",
            border: `1.5px solid ${HALO}`,
            boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
            fontFamily: mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            lineHeight: 1.25,
          }}
        >
          {g.text}
        </div>
      ))}
    </div>
  );
}
