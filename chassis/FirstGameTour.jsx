import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t as say, tr, listOf, language } from "./i18n.js";

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
   on your next (that ends it). Then, where the menu has its piece in the
   corner, three more, about the menu (TOUR_MENU; user, 2026-10-21: "An
   addendum to the tutorial should be about the UI or user interface. For
   example, the lower right hand corner has the 3D spinning piece. Maybe
   there should be a page or two in the tutorial explaining like what
   that's for, when it opens up, what the buttons inside of it do, that
   sort of thing"): the piece in the corner, calling as it does after a
   game, opens it (tap it, or Open it); inside it, its rows, each ringed
   and said; then the buttons along its foot, each drawn on the card as it
   is on the menu, and the tour's over. The cards keep with the menu:
   opened, the one for inside it; put away, the one for the piece. Its
   Control bar pressed meanwhile shows the bar for now, not kept, with a
   card of its own (TOUR_BAR; user: "Selecting the non-classic doc when in
   the new menu tutorial, it got rid of the tutorial ... there should be a
   way back, or just to have it show it temporarily while you're doing the
   tutorial"): Back to the tour, or the bar's own Use the classic dock,
   brings the menu and its card back; Keep it ends the tour with the bar
   kept. Any card can skip it; from the second on
   a quiet Back steps back a card (from your first turn too, until a piece
   has moved: tour.back, the chassis's). Kept as done on the
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
// and "foe" (the other side's turn after it); then the menu's (TOUR_MENU):
// the piece in the corner, inside the menu, and the buttons along its foot.
export const TOUR_CARDS = ["welcome", "ways", "goal", "crush", "blocks", "turn", "board"];
export const TOUR_MENU = ["menu", "panel", "foot"];
/* With the dock's own menu (chassis/menu-fan.js; user: "Replace the dock
   everywhere"), the two cards inside it are its own. Now Calm Rings (user:
   "A, with B in play"): in a game the fan out of the corner piece, so
   first the line over it and its wedges, each ringed as its line is lit
   (View where the board has views, Sound where there's sound); then More,
   its one list. */
export const TOUR_RINGS_HOW = [
  ["line", '[data-testid="dock-menu"] [data-testid="menu-fan-status"]'],
  ["view", '[data-testid="dock-menu"] [data-ml-item="view"]'],
  ["sound", '[data-testid="dock-menu"] [data-ml-item="sound"]'],
  ["more", '[data-testid="dock-menu"] [data-ml-item="more"]'],
];
export const tourRingsHow = (has) => TOUR_RINGS_HOW.filter(([k]) => (k === "view" ? has.views : k === "sound" ? has.sound : true));
export const TOUR_RINGS_MORE = '[data-testid="dock-menu"] [data-ml-item="more"]';
// (The control bar shown for now from the menu's cards: its own card.)
export const TOUR_BAR = "bar";

/* The menu's cards light what they name one at a time, the ring on the
   menu and its line on the card together (the menu's controls sit too
   close for a ring round each at once): this long each, round and round,
   both begun as the card comes up. */
const TURN_S = 2.6;
function turnFrames(name, n, on, off) {
  const slot = 100 / n, fade = 25 / (n * TURN_S); // (a quarter of a second in and out)
  return `@keyframes ${name}${n}{0%{${off}}${fade.toFixed(2)}%{${on}}${(slot - fade).toFixed(2)}%{${on}}${slot.toFixed(2)}%,100%{${off}}}`;
}
const turnAnim = (name, i, n) => `${name}${n} ${(n * TURN_S).toFixed(2)}s linear ${(i * TURN_S).toFixed(2)}s infinite both`;
// (A line lit: the rings' yellow behind it, its ink dark; unlit, as it was.)
const LIT_ON = "background:rgba(255,210,63,0.62);color:#1B1209";

/* The menu's buttons along its foot as the menu draws them (the chassis's
   dock panel), for the card that says what each does. */
const FOOT_ICONS = {
  layout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6" y="14.5" width="12" height="3" rx="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  guide: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v10H10l-4 4v-4H4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9.5l2.5-2v9" />
    </svg>
  ),
  points: (
    <svg width="18" height="16" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="5" cy="12" r="3.2" fill="currentColor" />
      <circle cx="13" cy="12" r="3.2" fill="currentColor" />
      <circle cx="21" cy="12" r="3.2" />
    </svg>
  ),
  sound: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
};

/* The marks' colours, bright against the board and its pieces: yours (the
   cards call it yellow), the other side's (red), the row you win on
   (green), and a piece that can't move yet. */
export const TOUR_TONES = { mine: "#FFD23F", foe: "#FF5470", goal: "#3FDB7C", dim: "#D9D0C1" };

const WORDS = ["no", "one", "two", "three", "four", "five"];
const word = (n) => tr(WORDS[n] || String(n));
const mono = "'IBM Plex Mono', monospace";
const sans = "'IBM Plex Sans', sans-serif";
// "the Flaco and the Opa"; "the Turrito, the Flaco, and the Opa" (the
// serial comma from three on, user: "where an Oxford comma should be placed").
// (In the other languages, their own way of listing: chassis/i18n.js listOf.)
const list = (xs) => (language() !== "en" ? listOf(xs) : xs.length < 2 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// The pieces with "the" before each, in English ("the Flaco and the Opa").
const theList = (names) => (language() !== "en" ? listOf(names) : list(names.map((n) => `the ${n}`)));

// What a card says: { title, sub, body: [...], rows: [[label, text]], note }.
function cardText(t) {
  const foe = t.foe;
  switch (t.step) {
    case "welcome":
      return {
        title: (t.copy && t.copy.title) || "Welcome to your first game of El Cabeza.",
        sub: (t.copy && t.copy.fine) || null,
        body: [
          t.mineHint
            ? say("You play {side}: the {hint} pieces on your side, ringed in yellow.", { side: t.mine, hint: t.mineHint })
            : say("You play {side}: the near pieces on your side, ringed in yellow.", { side: t.mine }),
          // (Named once, here; after this it's "your opponent", user: "This
          // should say your opponent ... not walnut".)
          t.foeHint
            ? say("Your opponent, the computer, plays {side}: the {hint} pieces across the board, ringed in red.", { side: foe, hint: t.foeHint })
            : say("Your opponent, the computer, plays {side}: the pieces across the board, ringed in red.", { side: foe }),
          "This short tour shows you how to play. The computer waits until you're ready.",
        ],
      };
    case "ways":
      return {
        title: "There are two ways to win.",
        body: [
          "1. Get your Cabeza across the board to your opponent's back row.",
          // ("opponent's", not the side's name, user: "the word should be
          // changed to 'opponent's'".)
          "2. Crush opponent's Cabeza with one of your blocks.",
          "Here's each one.",
        ],
      };
    case "goal":
      return {
        title: "1. Get your Cabeza across.",
        body: [
          "This disc is your Cabeza. Bring it all the way to your opponent's back row, the far edge lit green, and you win.",
          // (How far a turn takes it, not "one square at a time", user: "it
          // will cause a novice to assume it only moves one space per turn,
          // when in fact it can move two".)
          say("It can step up to {n} squares a turn, in any direction, even diagonally.", { n: word(t.budget) }),
        ],
      };
    case "crush":
      return {
        title: "2. Crush opponent's Cabeza.",
        body: [
          // (No "Here it is, up close.", user: "It's unnecessary".)
          "Roll one of your blocks onto your opponent's Cabeza and it's crushed: you win.",
          "Your opponent wins the same two ways, so keep your own Cabeza out from under their blocks.",
        ],
      };
    case "blocks":
      return {
        title: t.blocks.length === 4 ? "Your four blocks." : "Your blocks.",
        body: [
          t.blocks.length ? say("{pieces}, named on the board.", { pieces: cap(theList(t.blocks)) }) : null,
          "A block moves by rolling: it tips over one of its edges into the next squares, never corner to corner.",
          "Only a block can crush. A Cabeza can't.",
        ],
      };
    case "turn":
      return {
        title: t.youFirst ? "You move first." : "Your opponent moves first.",
        body: [
          // (The standard game's two actions for one piece in the user's
          // words: "Each turn, select a piece to roll on its edge either
          // once or twice. Note: the Opa (large cube) only rolls on its
          // edge once due to its large size.")
          t.budget === 2 && !t.split
            ? "Each turn, select a piece to roll on its edge either once or twice."
            : t.split
            ? say(t.hasOpa ? "Each turn you get {n} actions, shared by up to {k} pieces. A roll or a step costs one; the Opa's roll costs two." : "Each turn you get {n} actions, shared by up to {k} pieces. A roll or a step costs one.", { n: word(t.budget), k: word(t.split) })
            : say(t.hasOpa ? "Each turn you get {n} actions, all for one piece. A roll or a step costs one; the Opa's roll costs two." : "Each turn you get {n} actions, all for one piece. A roll or a step costs one.", { n: word(t.budget) }),
          t.budget === 2 && !t.split && t.hasOpa ? { note: "the Opa (large cube) only rolls on its edge once due to its large size." } : null,
          // (The Punto law cuts the opening turn by one: said where it's on.)
          t.punto ? (t.youFirst ? "Your very first turn has one action fewer: this game plays the Punto law." : "Your opponent's very first turn has one action fewer: this game plays the Punto law.") : null,
          t.dots || null,
          "When they're used up, your turn ends and your opponent moves.",
          // (Ending it sooner, Hold to end being always on, user: "As long
          // as it is clearly explained somewhere": a tap on the piece won't.)
          t.budget > 1 ? "To end it sooner, hold the piece you moved until its ring closes, or press End turn." : null,
        ],
      };
    case "board":
      return {
        title: "Turn the board any way you like.",
        body: [
          // (Moving it too, as briefly, user: "a good place to also mention
          // the two-finger panning, up, down, left, right ... I want to be
          // super concise". A mouse moves it with a right-drag, or Alt.)
          t.touch ? "Drag one finger to turn it all the way around, two to move it up, down, or sideways. Pinch to zoom in or out." : "Drag across it to turn it all the way around, right-drag to move it up, down, or sideways. Scroll to zoom in or out.",
          "It doesn't change the game: look from wherever helps.",
        ],
      };
    case "pieces": {
      if (t.waiting) return { title: "Your opponent is moving.", body: ["Your turn's next."] };
      const l = t.lesson;
      if (!l) {
        return {
          title: t.touch ? "Your move: tap a glowing piece." : "Your move: click a glowing piece.",
          body: [
            "Each one moves its own way. Pick one to see its name, how it moves, and an arrow to every square it can reach.",
            t.boxed.length ? say(t.boxed.length === 1 ? "{pieces} is boxed in for now: move another piece out of the way first." : "{pieces} are boxed in for now: move another piece out of the way first.", { pieces: cap(list(t.boxed.map((b) => (b.mine ? tr("your Cabeza") : language() !== "en" ? b.name : `the ${b.name}`)))) }) : null,
          ],
        };
      }
      const rows = [["Moves", l.moves], ["A turn", l.turn]];
      if (l.aim) rows.push(["Aim", l.aim]);
      (l.extra || []).forEach((x) => rows.push(["Also", x]));
      return { title: l.name, sub: l.what || null, rows, note: t.status || null };
    }
    case "foe": {
      if (t.waiting) return { title: "Your opponent's turn.", body: ["Watch the board: the computer moves one of its pieces."] };
      // (Then the menu's cards, where it has its piece in the corner.)
      if (t.menu) {
        const on = "Before your next move, a quick look at your menu.";
        return t.moved.length ? { title: say("Your opponent moved its {pieces}.", { pieces: list(t.moved) }), body: ["The red arrow shows where from.", on] } : { title: "Your turn again.", body: [on] };
      }
      return t.moved.length
        ? { title: say("Your opponent moved its {pieces}.", { pieces: list(t.moved) }), body: ["The red arrow shows where from.", t.touch ? "Your turn again: tap any of your pieces to see what it does. Good luck!" : "Your turn again: click any of your pieces to see what it does. Good luck!"] }
        : { title: "Your turn again.", body: [t.touch ? "Tap any of your pieces to see what it does. Good luck!" : "Click any of your pieces to see what it does. Good luck!"] };
    }
    // The menu: what the piece in the corner is for, and when it opens.
    case "menu":
      return {
        title: "Your menu is in the corner.",
        body: [
          t.touch ? "The spinning piece at the lower right opens it: the menu you started this game from. Tap it now." : "The spinning piece at the lower right opens it: the menu you started this game from. Click it now.",
          t.touch ? "Tap anywhere outside the menu to put it away again." : "Click anywhere outside the menu to put it away again.",
          "When a game ends, the piece glows like this until you open it: your next game starts from there.",
        ],
      };
    // The control bar, shown for now: what it is, and the way back.
    case "bar":
      return {
        title: "The control bar.",
        body: [
          "Your menu, laid out another way: your turn in a bar along the foot of the screen, everything else behind ☰ at the top right.",
          "To have the spinning piece back any time: ☰, then Use the classic dock.",
        ],
      };
    // Inside it, top to bottom, in its own words. (Calm Rings: the line
    // over the fan, then its wedges, as tourRingsHow rings them.)
    case "panel": {
      if (t.rings) {
        const rows = [["Whose move", "The line over it: whose move it is, who you are, and the computer's level."]];
        if (t.views && t.views.length) rows.push(["View", say("{views}: ready-made views of the board.", { views: list(t.views) })]);
        if (t.sound) rows.push(["Sound", t.channels ? "The volume, with the music and the other sounds each on or off." : "The volume."]);
        rows.push(["More", "Every setting, in one list."]);
        return {
          title: "Your menu.",
          body: [t.touch ? "Each one keeps its place. Tap one with choices and they open above it." : "Each one keeps its place. Click one with choices and they open above it."],
          rows,
          lit: true,
        };
      }
      const rows = [];
      if (t.undo) rows.push([t.undo, "Takes back your last turn, and your opponent's answer."]);
      if (t.views && t.views.length) rows.push(["Views", say("{views}: ready-made views of the board.", { views: list(t.views) })]);
      if (t.check) rows.push([t.check, "Warns you when your opponent could crush your Cabeza on its next turn."]);
      if (t.endGame) rows.push([t.endGame, "Ends this game."]);
      return { title: "Inside your menu.", rows, lit: true };
    }
    // Along its foot: each button drawn as the menu draws it. (Calm Rings:
    // what More holds, in its groups.)
    case "foot": {
      if (t.rings) {
        const hints = [t.check ? "Check alert" : null, "Piece guide", t.costs ? "Move costs" : null, "Actions left"].filter(Boolean).map(tr);
        const rows = [
          ["Game", "End your turn, undo, and end the game (it asks first)."],
          ["Help on the board", say("{list}.", { list: list(hints) })],
          ["Sound and language", t.sound ? "The volume, and the language the game speaks." : "The language the game speaks."],
          ["Your games", "Replay a game, and save your progress."],
        ];
        if (t.layout) rows.push(["Layout", "The control bar, in place of the piece."]);
        return {
          title: "Everything else is in More.",
          body: [t.touch ? "Tap More for one plain list, in groups:" : "Click More for one plain list, in groups:"],
          rows,
          note: t.touch ? "That's the tour. Your move: tap any of your pieces to see what it does. Good luck!" : "That's the tour. Your move: click any of your pieces to see what it does. Good luck!",
        };
      }
      const icons = [];
      if (t.layout) icons.push({ icon: "layout", name: "Control bar", text: "moves the menu to a bar along the foot of the screen." });
      icons.push({ icon: "guide", name: "Piece guide", text: "a card that tells you what the piece you pick does." });
      if (t.costs) icons.push({ icon: "costs", name: "Move costs", text: "how many actions each move takes, on its marker." });
      icons.push({ icon: "points", name: "Actions left", text: "the lights at the foot of the screen that count them." });
      if (t.sound) icons.push({ icon: "sound", name: "Sound", text: t.channels ? "the volume, with the music and the other sounds each on or off." : "the volume." });
      return {
        title: "The buttons along the bottom.",
        body: ["Most switch something on or off: a line through one means it's off."],
        icons,
        lit: true,
        note: t.touch ? "That's the tour. Your move: tap any of your pieces to see what it does. Good luck!" : "That's the tour. Your move: click any of your pieces to see what it does. Good luck!",
      };
    }
    default:
      return null;
  }
}

export default function FirstGameTour({ tour, cardRef }) {
  const { step, C, display } = tour;
  const card = TOUR_CARDS.includes(step);
  const menuCard = TOUR_MENU.includes(step) || step === TOUR_BAR;
  // A card before you play: Escape skips the tour, as its link does.
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === "Escape") tour.skip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, tour.skip]);
  /* The card keeps below what a world fixes at the top over it where the
     two would meet: the corner menu's tab, and whatever the world names
     (copy.clear: the store's cart). */
  const clear = ['[data-testid="corner-menu-tab"]', '[data-testid="shell-menu-button"]', tour.copy && tour.copy.clear].filter(Boolean).join(", ");
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
  const nOf = (n, total) => say("{n} of {total}", { n, total });
  const band = `${tr((tour.copy && tour.copy.band) || "First game")}${card ? ` · ${nOf(index + 1, of)}` : step === "pieces" ? ` · ${nOf(of, of)}` : step === TOUR_BAR ? ` · ${tr("Your menu")}` : menuCard ? ` · ${tr("Your menu")} · ${nOf(TOUR_MENU.indexOf(step) + 1, TOUR_MENU.length)}` : ""}`;
  const primary = card
    ? { label: index < TOUR_CARDS.length - 1 ? "Next ›" : "Let's play ›", onClick: tour.next, testid: "tour-next" }
    : step === TOUR_BAR ? { label: "‹ Back to the tour", onClick: tour.next, testid: "tour-bar-back" }
    : menuCard
      ? step === "foot" ? { label: "Got it", onClick: tour.finish, testid: "tour-done" } : { label: step === "menu" ? "Open it ›" : "Next ›", onClick: tour.next, testid: "tour-next" }
      : step === "foe" && !tour.waiting ? (tour.menu ? { label: "Next ›", onClick: tour.next, testid: "tour-next" } : { label: "Got it", onClick: tour.finish, testid: "tour-done" }) : null;
  const link = card
    ? { label: "Skip the tour", onClick: tour.skip, testid: "tour-skip" }
    // (Over from the bar's card: the bar kept.)
    : step === TOUR_BAR ? { label: "Keep it, end the tour", onClick: tour.finish, testid: "tour-bar-keep" }
      : { label: "End the tour", onClick: tour.finish, testid: "tour-end" };
  // A quiet step back, beside Next (the chassis says when there's one).
  const back = tour.back ? { label: "‹ Back", onClick: tour.back, testid: "tour-back" } : null;
  const lit = text.lit ? (text.rows || text.icons).length : 0;
  const css = "@keyframes ecTourIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes ecTourDrop{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion: reduce){[data-testid=\"tour-card\"]{animation:none!important}}"
    + (lit ? `${turnFrames("ecTourLit", lit, LIT_ON, `background:rgba(255,210,63,0);color:${C.slate}`)}@media (prefers-reduced-motion: reduce){[data-lit]{animation:none!important}}` : "");
  return (
    <>
      <style>{css}</style>
      <div
        ref={cardRef}
        key={step}
        data-testid="tour-card"
        data-step={step}
        role={card || menuCard ? "dialog" : "status"}
        aria-live={card || menuCard ? undefined : "polite"}
        aria-labelledby="ec-tour-title"
        style={{
          position: "fixed",
          top: below ? below : "calc(var(--ec-shell-top, env(safe-area-inset-top, 0px)) + 12px)",
          left: side ? "max(16px, env(safe-area-inset-left, 0px))" : "50%",
          transform: side ? "none" : "translateX(-50%)",
          zIndex: tour.rings ? 17 : 13,
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
            {text.body.filter(Boolean).map((p) => (typeof p === "string"
              ? <p key={p} style={{ margin: 0 }}>{p}</p>
              : <p key={p.note} data-testid="tour-note-line" style={{ margin: 0 }}><i>Note</i>: {p.note}</p>))}
          </div>
        )}
        {text.rows && (
          <div data-testid="tour-rows" style={{ marginTop: narrow ? 6 : 8, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 10, rowGap: narrow ? 3 : 5, alignItems: "baseline" }}>
            {text.rows.map(([k, v], i) => (
              <React.Fragment key={k + i}>
                <span data-lit={lit ? i : undefined} style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.slate, whiteSpace: "nowrap", ...(lit ? { animation: turnAnim("ecTourLit", i, lit), borderRadius: 3, padding: "2px 5px", margin: "-2px -5px" } : null) }}>{k}</span>
                <span data-testid={`tour-row-${k.toLowerCase().replace(/\s+/g, "-")}`}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {text.icons && (
          <div data-testid="tour-icons" style={{ marginTop: narrow ? 6 : 8, display: "grid", gridTemplateColumns: "22px 1fr", columnGap: 9, rowGap: narrow ? 4 : 6, alignItems: "center" }}>
            {text.icons.map((x, i) => (
              <React.Fragment key={x.icon}>
                <span aria-hidden="true" data-lit={lit ? i : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, margin: "-2px", borderRadius: "50%", color: C.slate, ...(lit ? { animation: turnAnim("ecTourLit", i, lit) } : null) }}>{FOOT_ICONS[x.icon]}</span>
                <span data-testid={`tour-icon-${x.icon}`}><b style={{ fontWeight: 600 }}>{x.name}</b>: {x.text}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        {text.note && (
          <div data-testid="tour-note" style={{ marginTop: narrow ? 6 : 8, paddingTop: narrow ? 5 : 7, borderTop: `1px solid ${C.slateSoft}`, fontWeight: 600 }}>
            {text.note}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: primary || back ? "space-between" : "flex-end", gap: 12, marginTop: narrow ? 6 : 10 }}>
          <button type="button" data-testid={link.testid} onClick={link.onClick} style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", color: C.slate, fontFamily: sans, fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {link.label}
          </button>
          {(back || primary) && (
            <div style={{ display: "flex", alignItems: "center", gap: narrow ? 6 : 10 }}>
              {back && (
                <button type="button" data-testid={back.testid} onClick={back.onClick} aria-label="Back a step" style={{ background: "none", border: "none", padding: "8px 6px", cursor: "pointer", color: C.slate, fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {back.label}
                </button>
              )}
              {primary && (
                <button
                  type="button"
                  className="ec-btn"
                  data-testid={primary.testid}
                  onClick={primary.onClick}
                  autoFocus={card || menuCard}
                  style={{ background: C.charcoal, color: C.cream, border: `1px solid ${C.charcoal}`, borderRadius: 6, padding: narrow ? "8px 15px" : "9px 17px", cursor: "pointer", fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}
                >
                  {primary.label}
                </button>
              )}
            </div>
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
/* An arrow to a row, not a square (sweep: { lo, hi }, the columns it runs
   between; user, the goal card's arrow to the back row: "Have the
   arrowhead of this long green arrow kind of slide across the back to
   indicate that anywhere on the back row is valid ... having the arrow
   point at that one specific point might be a little bit misleading"):
   its head held a moment where it first points (`hold`), then gliding to
   the row's farther end and on between its two ends, a crossing taking
   `leg` and resting a beat (`rest`) at each end. Still with reduced
   motion. */
const SWEEP = { hold: 700, leg: 2400, rest: 300 };
export function TourMarks({ marks, geo, subscribe, cardRef, raised = false }) {
  const tagEls = useRef({});
  const lineEls = useRef({});
  const boxEls = useRef({});
  const orbitEls = useRef({});
  // (When each sweeping arrow was first drawn, kept while it's shown.)
  const sweptFrom = useRef({});
  useEffect(() => {
    if (!marks || !subscribe || !geo) return undefined;
    const tags = marks.tags || [];
    const sizes = {};
    tags.forEach((g) => { const e = tagEls.current[g.key]; if (e) sizes[g.key] = { w: e.offsetWidth, h: e.offsetHeight }; });
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const swept = sweptFrom.current;
    Object.keys(swept).forEach((k) => { if (!(marks.arrows || []).some((ar) => ar.sweep && ar.key === k)) delete swept[k]; });
    const sweepCol = (ar, now) => {
      const { lo, hi } = ar.sweep, c0 = ar.to.box.col, span = hi - lo;
      if (still || !(span > 0)) return c0;
      if (swept[ar.key] == null) swept[ar.key] = now;
      const s = now - swept[ar.key] - SWEEP.hold;
      if (s <= 0) return c0;
      const ease = (x) => x * x * (3 - 2 * x);
      const far = hi - c0 >= c0 - lo ? hi : lo, near = far === hi ? lo : hi;
      const first = (SWEEP.leg * Math.abs(far - c0)) / span;
      if (s < first) return c0 + (far - c0) * ease(s / first);
      const k = (s - first) % (2 * (SWEEP.rest + SWEEP.leg));
      if (k < SWEEP.rest) return far;
      if (k < SWEEP.rest + SWEEP.leg) return far + (near - far) * ease((k - SWEEP.rest) / SWEEP.leg);
      if (k < 2 * SWEEP.rest + SWEEP.leg) return near;
      return near + (far - near) * ease((k - 2 * SWEEP.rest - SWEEP.leg) / SWEEP.leg);
    };
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
        const r = geo.rect({ el: bx.sel, inset: bx.inset });
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
          /* The way round a drag turns it: where you touch, the side under
             the pointer follows it (turn-where.js). Shown with a finger's
             drag right along the near edge, carrying that edge right (the
             far one goes left), as a thumb low on a phone would; a mouse's
             along the far edge, carrying it right (the near one goes
             left). The fingertip shows the drag. */
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
      // its way, so several from one piece fan out. One to a row, its head
      // along the row (sweepCol).
      (marks.arrows || []).forEach((ar) => {
        const l = lineEls.current[`arrow-${ar.key}`];
        if (!l) return;
        const a = geo.rect(ar.from), b = geo.rect(ar.sweep ? { box: { ...ar.to.box, col: sweepCol(ar, now) } } : ar.to);
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
      /* Never over what it names. A long label set beside a piece near the
         screen's edge is pushed back over the piece by the edge (a phone:
         OPPONENT'S CABEZA on the crush card, user: "obscuring the actual
         piece a little bit too much. Perhaps it needs to be moved down off
         it to the right a little bit"): then it goes just below it, where
         the edge let it be, or above when there's no room below (and where
         it is when there's room for neither). */
      const offOwn = (it, o) => {
        const l = it.x, t = it.y, r = it.x + it.w, b = it.y + it.h;
        if (r <= o.l || l >= o.r || b <= o.t || t >= o.b) return false;
        const down = o.b + 4, up = o.t - it.h - 4;
        if (down + it.h <= vh - 6) it.y = down; else if (up >= 6) it.y = up; else return false;
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
          if (offOwn(it, others[i])) moved = true;
        });
        if (!moved) break;
      }
      items.forEach((it) => {
        const e = tagEls.current[it.g.key];
        if (e) e.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px)`;
        // (Tests: what it names, where it is on the screen.)
        if (e && typeof window !== "undefined" && window.__EC_TEST_HOOKS__) e.dataset.anchor = [it.a.l, it.a.t, it.a.r, it.a.b].map(Math.round).join(",");
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
      <path ref={keep(lineEls, k, "head")} data-head={k} fill={tone(t)} stroke={HALO} strokeWidth={1.6} strokeLinejoin="round" />
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
    <div data-testid="tour-marks" aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: raised ? 17 : 12, overflow: "hidden" }}>
      <style>{"@keyframes ecTourPulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes ecTourMarch{to{stroke-dashoffset:-46}}.ec-tour-pulse{animation:ecTourPulse 1.3s ease-in-out infinite}.ec-tour-march{animation:ecTourMarch 1.1s linear infinite}@media (prefers-reduced-motion: reduce){.ec-tour-pulse,.ec-tour-march,[data-turn]{animation:none!important}}"
        + [...new Set((marks.boxes || []).filter((b) => b.of).map((b) => b.of))].map((n) => turnFrames("ecTourTurn", n, "opacity:1", "opacity:0")).join("")}</style>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {(marks.boxes || []).map((bx) => (
          <g key={bx.key} data-ring={bx.key} {...(bx.of ? { "data-turn": bx.turn, style: { animation: turnAnim("ecTourTurn", bx.turn, bx.of) } } : null)}>
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
