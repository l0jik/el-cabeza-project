/* Steve B. coaching the tour in pictures (user, 2026-11-23: "there should
   be a really brief encapsulation as to what you're seeing for each of
   the pictures. Make it look like Big Lots is showing you how to do
   this"; then "a zoom in portrait of like just the clerk, Steve B. His
   glasses can be, you know, kind of askew because that's kind of his
   personality. But he can kind of be there, sort of like coaching
   along"; picked: "1 · In the corner: one coaching line in a bubble."):

   his portrait at the picture's lower left, leaning in over its edge,
   drawn (the shaggy mop, "slightly messier"; the specs askew, "the left
   lens a little too high, the right lens a little too low"; the mustard
   shirt, a collar point flipped up, his name tag, a pencil behind his
   ear); one line from him in a bubble beside it; and on the picture a few
   words in his marker right by what they're about, yours in yellow,
   theirs in red, the picture's own arrows doing the pointing (user: "the
   words need to be closer to the pictures. There's too much arrow action
   happening here").

   A note keeps to its box on the picture (in the picture's 320 x 140): its
   words are sized with the picture and made smaller, if they must be, to
   fit it (a longer language, a phone's larger text), never run over
   what's drawn. Where a world's tour asks for him (its copy, coach
   "steve": the store's); the card's words stay for a screen reader as
   ever (FirstGameTour). */
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { t as say } from "./i18n.js";
import { TourPicture, TONES, W, H, pictureOf } from "./TourPictures.jsx";
import { fontsHref } from "./font-links.js";

const INK = "#2E2118", CREAM = "#FBF6E6";

/* ------------------------------------------------------------- Steve B. */

const ST = { skin: "#EDB892", skin2: "#D89A72", hair: "#8A4F27", hair2: "#5E3317", hair3: "#B5713A", mustard: "#E3A733", brown: "#6B3A1E" };
// A seeded scatter, so his mop falls the same way every time.
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const f1 = (n) => n.toFixed(1);
// A curly edge round an ellipse: a bulge between each two of its points.
function scallop(cx, cy, rx, ry, n, bump, seed, jitter) {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * 2 * i) / n, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) { d += `M${f1(x)},${f1(y)}`; continue; }
    const am = (Math.PI * 2 * (i - 0.5)) / n, b = bump * (1 + (r() - 0.5) * jitter);
    d += ` Q${f1(cx + Math.cos(am) * (rx + b * 1.9))},${f1(cy + Math.sin(am) * (ry + b * 1.9))} ${f1(x)},${f1(y)}`;
  }
  return `${d}Z`;
}
// Curl marks in the mop: little c's (none over his face).
function texture(cx, cy, rx, ry, n, seed, color, w, avoid) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (avoid && avoid(x, y)) continue;
    const s = 4 + r() * 4, rot = r() * 360;
    out += `<path d="M${f1(-s)},0 a${f1(s)},${f1(s)} 0 0 1 ${f1(s * 1.6)},${f1(-s * 0.4)}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
  }
  return out;
}
// His mop: lopsided, big curls, tufts every which way.
const MOP = { cx: 102, cy: 79, rx: 70, ry: 56, n: 17, bump: 9.5, jit: 1.5, fringe: { y: 65, n: 6, drop: 13 }, tufts: [[132, 28, 26], [56, 42, -40], [162, 66, 70], [84, 22, -14], [40, 92, -100]] };
// A grin; a "hmm" (a brow up); a wince (for a loss); and a beam, the huge
// grin he says goodbye with (user: "he should have a huge grin on his face").
const eye = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="5.6" fill="${INK}"/><circle cx="${x + 1.6}" cy="${y - 2}" r="1.7" fill="#fff"/>`;
const MOODS = {
  grin: {
    eyes: `${eye(81, 103)}${eye(119, 100)}<path d="M74,111 q7,4 14,0 M112,108 q7,4 14,0" fill="none" stroke="${ST.skin2}" stroke-width="2" stroke-linecap="round"/>`,
    brows: `<path d="M71,88 q10,-8 20,-3" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/><path d="M109,84 q10,-7 20,0" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/>`,
    mouth: `<path d="M79,127 q22,5 43,-4 q-4,21 -21,22 q-17,0 -22,-18 z" fill="#7A2618" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M81,128 q20,4 39,-4 l-1,6 q-18,6 -37,2 z" fill="#FFFDF6"/><path d="M92,141 q8,-5 16,-1 q-4,4 -8,4 q-5,0 -8,-3 z" fill="#E06A5A"/>`,
  },
  hmm: {
    eyes: `${eye(81, 104)}${eye(119, 99)}`,
    brows: `<path d="M71,92 q10,-4 20,-1" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/><path d="M109,80 q10,-9 20,-2" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/>`,
    mouth: `<path d="M84,136 q10,-5 18,0 q6,3 14,-3" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  },
  beam: {
    eyes: `<path d="M72,105 q9,-11 18,0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><path d="M110,101 q9,-11 18,0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`
      + `<circle cx="72" cy="123" r="10" fill="#EE8E7A" opacity=".4"/><circle cx="130" cy="119" r="10" fill="#EE8E7A" opacity=".4"/>`,
    brows: `<path d="M70,85 q10,-10 21,-4" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/><path d="M108,80 q11,-9 21,-1" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/>`,
    mouth: `<path d="M72,120 q28,9 56,-1 q-3,24 -28,26 q-25,-1 -28,-25 z" fill="#7A2618" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M74,121 q26,8 52,-1 l-1,7 q-25,8 -49,2 z" fill="#FFFDF6"/>`
      + `<path d="M87,139 q13,-8 26,-1 q-6,5 -13,5 q-8,0 -13,-4 z" fill="#E06A5A"/>`,
  },
  wince: {
    eyes: `<path d="M75,101 l13,4 l-13,4" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M125,97 l-13,4 l13,4" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    brows: `<path d="M71,86 q10,6 20,2" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/><path d="M109,82 q10,-5 20,4" fill="none" stroke="${ST.hair2}" stroke-width="4" stroke-linecap="round"/>`,
    mouth: `<path d="M80,133 q20,-6 40,0 q-2,9 -20,9 q-18,0 -20,-9 z" fill="#FFFDF6" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M84,136 h32 M90,133 v8 M100,132 v10 M110,133 v8" stroke="${INK}" stroke-width="1.4" fill="none"/>`,
  },
};
// (Drawn once a mood: the same every time.)
const drawn = {};
export function steveSvg(mood) {
  const m = MOODS[mood] ? mood : "grin";
  if (drawn[m]) return drawn[m];
  const { skin, skin2, hair, hair2, hair3, mustard, brown } = ST;
  const f = MOODS[m], M = MOP;
  const inFace = (x, y) => ((x - 100) / 44) ** 2 + ((y - 98) / 54) ** 2 < 1;
  const { y, n, drop } = M.fringe;
  let edge = "";
  const r = rng(41);
  for (let i = n; i > 0; i--) {
    const x0 = 56 + ((144 - 56) * i) / n, x1 = 56 + ((144 - 56) * (i - 1)) / n;
    edge += ` Q${f1((x0 + x1) / 2)},${f1(y + drop * (0.8 + r() * 0.5) + 4)} ${f1(x1)},${f1(y + 4 + (i === 1 ? 4 : 0))}`;
  }
  const fringe = `<path d="M56,${y + 8} Q60,${y - 26} 100,${y - 28} Q140,${y - 26} 144,${y + 6}${edge}Z" fill="${hair}"/><path d="M144,${y + 6}${edge}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`;
  const curl = "M104,62 c6,8 4,16 -2,20 c-4,3 -2,8 3,8", lock = "M106,66 c5,5 4,10 -1,12 c-3,1 -2,4 1,4";
  const extras = M.tufts.map(([x, yy, rot]) => `<path d="M0,0 q-2,-14 8,-18 q-2,8 6,10 q2,-10 10,-10 q-6,6 -4,16" transform="translate(${x} ${yy}) rotate(${rot})" fill="${hair}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`).join("")
    + `<path d="${curl}" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="${curl}" fill="none" stroke="${hair}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M36,96 c-8,-2 -10,-12 -2,-14 c6,-1 6,6 1,6" fill="none" stroke="${hair2}" stroke-width="2.8" stroke-linecap="round"/><path d="M166,90 c8,-2 10,-12 2,-14 c-6,-1 -6,6 -1,6" fill="none" stroke="${hair2}" stroke-width="2.8" stroke-linecap="round"/>`;
  drawn[m] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false" style="display:block">`
    + `<rect width="200" height="200" fill="#EFC98A"/>`
    // His shirt, mustard; a brown collar, one point flipped up; his name tag, crooked.
    + `<path d="M28,200 q6,-38 40,-46 l64,0 q34,8 40,46 z" fill="${mustard}" stroke="${INK}" stroke-width="3"/>`
    + `<path d="M70,154 l30,26 l-18,14 l-20,-30 z" fill="${brown}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M130,154 l-30,26 l22,6 l26,-40 z" fill="${brown}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    + `<g transform="rotate(-11 74 178)"><rect x="52" y="170" width="44" height="17" rx="2" fill="${CREAM}" stroke="${INK}" stroke-width="2"/><text x="74" y="182.5" text-anchor="middle" font-family="'Libre Franklin', Arial, sans-serif" font-weight="800" font-size="9.5" fill="${INK}">Steve B.</text></g>`
    + `<g transform="rotate(-5 100 110)">`
    // The mop behind, its curls, its tufts and strays.
    + `<path d="${scallop(M.cx, M.cy, M.rx, M.ry, M.n, M.bump, 7, M.jit)}" fill="${hair}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    + texture(M.cx, M.cy, M.rx, M.ry, 26, 19, hair2, 1.8, inFace)
    + texture(M.cx, M.cy - 6, M.rx * 0.9, M.ry * 0.8, 12, 29, hair3, 1.8, inFace)
    + extras
    // Neck, ears, the pencil behind his ear, his face.
    + `<path d="M86,146 h28 v18 h-28 z" fill="${skin2}" stroke="${INK}" stroke-width="3"/>`
    + `<ellipse cx="57" cy="110" rx="8" ry="12" fill="${skin}" stroke="${INK}" stroke-width="3"/><ellipse cx="143" cy="107" rx="8" ry="12" fill="${skin}" stroke="${INK}" stroke-width="3"/>`
    + `<g transform="rotate(-62 150 92)"><rect x="128" y="88" width="44" height="7" fill="#F2C641" stroke="${INK}" stroke-width="2"/><path d="M172,88 l9,3.5 l-9,3.5 z" fill="#F1D3B0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="122" y="88" width="7" height="7" fill="#E8838A" stroke="${INK}" stroke-width="2"/></g>`
    + `<path d="M58,96 q0,-52 42,-54 q42,2 42,54 q0,46 -42,52 q-42,-6 -42,-52 z" fill="${skin}" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="72" cy="122" r="9" fill="#EE8E7A" opacity=".45"/><circle cx="130" cy="118" r="9" fill="#EE8E7A" opacity=".45"/>`
    + `<g fill="${skin2}"><circle cx="86" cy="118" r="1.5"/><circle cx="81" cy="114" r="1.3"/><circle cx="90" cy="113" r="1.2"/><circle cx="112" cy="114" r="1.5"/><circle cx="117" cy="110" r="1.3"/><circle cx="108" cy="110" r="1.2"/></g>`
    + f.brows + f.eyes
    + `<path d="M98,108 q-6,12 2,14 q4,1 6,-2" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`
    + f.mouth
    // The specs, askew about the bridge: the left lens high, the right low.
    + `<g transform="rotate(11 100 101)">`
    + `<rect x="61" y="86" width="37" height="31" rx="10" fill="rgba(255,206,186,.24)" stroke="${brown}" stroke-width="4.2"/><rect x="102" y="86" width="37" height="31" rx="10" fill="rgba(255,206,186,.24)" stroke="${brown}" stroke-width="4.2"/>`
    + `<path d="M98,95 q2,-4 4,0" fill="none" stroke="${brown}" stroke-width="3.6"/><path d="M68,85 q32,-8 64,0" fill="none" stroke="${brown}" stroke-width="2.6"/>`
    + `<path d="M66,93 l8,-4 M107,93 l8,-4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/><path d="M61,96 l-7,2 M139,96 l7,2" stroke="${brown}" stroke-width="3.4" stroke-linecap="round"/>`
    + `</g>`
    // The fringe over his forehead, and a curl loose on it.
    + fringe
    + texture(100, 52, 34, 8, 6, 53, hair2, 1.6, null)
    + `<path d="${lock}" fill="none" stroke="${INK}" stroke-width="5.2" stroke-linecap="round"/><path d="${lock}" fill="none" stroke="${hair}" stroke-width="2.6" stroke-linecap="round"/>`
    + `</g>`
    + `<circle cx="100" cy="100" r="98.5" fill="none" stroke="${INK}" stroke-width="3"/>`
    + `</svg>`;
  return drawn[m];
}

export function SteveFace({ mood = "grin", size = 64, style = null }) {
  return (
    <div
      data-testid="tour-coach-face"
      data-mood={mood}
      aria-hidden="true"
      className="ec-coach-face"
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: steveSvg(mood) }}
    />
  );
}

/* ---------------------------------------------------------- what he says */

// A note: its box on the picture [x, y, w, h], whose it is (its colour),
// its words (`end`: the last of them, bigger), set left, center or right,
// at the top, middle or bottom of its box.
const YOURS = "mine", THEIRS = "foe", GOAL = "goal", PLAIN = "dim";
const note = (box, tone, text, o = null) => ({ box, tone, text, ...o });
const UNDER = { align: "center", v: "top" };
/* His face (user: "I want the images of Steve to be bigger too"; of two
   sizes mocked up, the bigger, the buttons beside him): 76 of the
   picture's 320 units across, 13 of them over its lower edge. (His corner,
   the picture's lower left, x under 66 and y over 126, is his face's: no
   note goes there.) */
const FACE = 76, OVER = 13;
/* His words in his bubble: in proportion to the card (k, its pixels to the
   picture's units), 15 to 20 px; on a phone's narrower card no smaller on
   the screen than 17 px at 360 wide, 18 at 412, up to 19 (user: "Without
   affecting overall layout, the text needs to be larger when you're on a
   single screen slab phone because it's kind of small and older people
   might not be able to see it very well": they had been 15 there, against
   the desktop's and the open foldable's 19; the longest line, on the hold
   card, still three lines at 412). `scale`: how much larger the phone's
   own text setting makes them already (textScale), counted toward that,
   so the two never stack (1.5x, they were 22.5 px already). */
const bubbleFont = (k, scale = 1) => Math.round(Math.min(20, Math.max(15, 13.6 * k, Math.min(19, 11.2 + 6.4 * k) / Math.max(1, scale || 1))) * 10) / 10;
// (What the phone's text setting makes of an element's size: its size on
// the screen over the one it was given; 1 where nothing's set.)
function textScale(el) {
  if (!el || typeof getComputedStyle === "undefined") return 1;
  const given = parseFloat(el.style.fontSize), shown = parseFloat(getComputedStyle(el).fontSize);
  return given > 0 && shown > 0 ? Math.round((shown / given) * 100) / 100 : 1;
}

/* The tour's last card: Got it ends it (the menu's last card; or, the
   menu not shown, your turn again). */
const lastCard = (t) => t.step === "foot" || (t.step === "foe" && !t.waiting && !t.menu);

/* Steve's line, his face and the notes for the tour's moment `t` (the
   picture's; null for none). A line in lines is an array, each its own.
   On the tour's last card, one more step: his last word, beaming (user:
   "when the tutorial is over, the last thing that Steve should say is,
   and thank you for shopping at Big Glutts! and he should have a huge
   grin on his face"). */
export function coachFor(t) {
  const c = coachSays(t);
  if (!c || !lastCard(t)) return c;
  const steps = c.parts || [{ focus: c.focus || null, mood: c.mood, line: c.line, notes: c.notes }];
  const bye = { focus: null, mood: "beam", line: "And thank you for shopping at Big Glutts!", notes: c.notes };
  return { ...steps[0], parts: [...steps, bye] };
}

function coachSays(t) {
  // (The basic game's two actions a turn, always: its demonstration is
  // no other; user: "Steve should only be giving instructions in the
  // tutorial about how to play the basic game ... no 3 moves per piece".)
  const N = 2;
  const tap = (touch, click) => (t.touch ? touch : click);
  switch (pictureOf(t)) {
    case "welcome":
      // (User: "Hi, I'm Steve!\nLet me show you how to play the game.")
      return { mood: "grin", line: ["Hi, I'm Steve!", "Let me show you how to play the game."], notes: [
        note([2, 50, 98, 40], YOURS, "your pieces", { align: "center", v: "bottom" }),
        note([220, 52, 98, 44], THEIRS, "the computer's pieces", UNDER),
      ] };
    case "ways":
      // (User: "Steve needs to say, there's two ways to win a game of El Cabeza.")
      return { mood: "grin", line: "There's two ways to win a game of El Cabeza.", notes: [
        note([106, 52, 52, 60], GOAL, "reach the far row", { v: "top" }),
        note([194, 4, 84, 48], YOURS, "or crush their disc"),
      ] };
    case "goal": {
      /* In two steps, each its half lit: the far row; then how the disc
         steps, said to be the disc's alone (user, of the right half: "It's
         not clear that this graphic indicates that this is the movement of
         the cabeza or disk. It's too generalized. People might assume that
         this is how all pieces move. Let's tighten this up."). Over the
         steps' squares, where the grid leaves room (it starts 16 down),
         whose they are; right of them, any way; by the dots, after them,
         as many as a turn has. */
      const n = 2 * N + 1, s2 = Math.min(16, 84 / n), dw = N * 10 + (N - 1) * 5, x0 = 246 + dw / 2 + 6;
      const parts = [
        // (User: "one way is to get your disk all the way across the board
        // without getting crushed ... but maybe more concise".)
        { focus: [4, 3, 162, 134], mood: "grin", line: "One way: get your disc across in one piece.", notes: [note([127, 46, 41, 50], GOAL, "far row wins!", { v: "top" })] },
        {
          focus: [174, 1, 144, 137], mood: "grin",
          line: "Only your disc moves like this: one square any way, once or twice a turn.",
          notes: [
            note([178, 0, 136, 16], YOURS, "only your disc", { align: "center", v: "bottom" }),
            note([246 + (n * s2) / 2 + 3, 20, 316 - (246 + (n * s2) / 2 + 3), 70], YOURS, "any way!", { align: "center" }),
            note([x0, 16 + n * s2 + 2, 318 - x0, 40], YOURS, say("{n} steps a turn", { n: N })),
          ],
        },
      ];
      return { ...parts[0], parts };
    }
    case "crush":
      // (User: "keep an eye on your disk, because your opponent's going to be
      // trying to crush it with one of their blocks ... make it shorter,
      // more concise, and you know, how Steve would talk".)
      return { mood: "hmm", line: "Keep an eye on your disc. They'll try to squash it!", notes: [
        note([6, 10, 104, 44], YOURS, "your block rolls onto their disc…", { end: "you win!" }),
        note([166, 10, 106, 44], THEIRS, "their block rolls onto your disc…", { end: "you lose." }),
      ] };
    case "blocks":
      // (User: "blocks only roll on their edge. Easy!")
      return { mood: "grin", line: "Blocks only roll on their edge. Easy!", notes: [
        note([4, 8, 70, 48], YOURS, "blocks roll over"),
        note([110, 0, 76, 33], THEIRS, "never corner to corner", { v: "bottom" }),
        note([216, 8, 68, 48], THEIRS, "a disc can't crush"),
      ] };
    case "turn": {
      /* In steps (user, of this card: "This part seems a little busy and
         perhaps convoluted. Maybe Steve needs to break it down, be a little
         bit more explanatory, and take it in steps."): Next goes through
         his points one at a time, each lighting its part of the picture
         (focus), the rest dimmed: whose turn; a block rolled once or twice;
         the big one, once; done early. */
      const left = 16 + (N + 1) * 19 + 8;
      const parts = [
        { focus: [6, 4, 308, 40], mood: "grin", line: t.youFirst ? "You go first, then the computer." : "The computer goes first, then you.", notes: [] },
        { focus: [2, 50, Math.max(left - 2, 86), 88], mood: "grin", line: "Pick a block. Roll it once or twice.", notes: [note([4, 50, 82, 22], YOURS, say("up to {n} rolls", { n: N }))] },
      ];
      if (t.hasOpa) parts.push({ focus: [90, 50, 134, 88], mood: "hmm", line: "The big block is heavy: it rolls just once.", notes: [note([156, 64, 66, 44], YOURS, "the big one rolls once")] });
      // (User: "instead of done early? have him say, don't want to move your
      // piece twice? You don't have to!"; and only the hold, as the game is
      // played: "you can press and hold to end your turn ... there's no check
      // mark". Its note, of ten offered, user: "4 for the wording": "hold to
      // skip your 2nd roll", once "hold it to end early".)
      parts.push({ focus: [228, 50, 90, 88], mood: "grin", line: "Don't want to move your piece twice? You don't have to! Press and hold it to end your turn.", notes: [note([230, 50, 88, 36], YOURS, "hold to skip your 2nd roll", { v: "bottom" })] });
      return { ...parts[0], parts };
    }
    case "board":
      return { mood: "grin", line: "Look from any side you like!", notes: [
        note([4, 109, 100, 17], YOURS, tap("one finger turns it", "drag to turn"), UNDER),
        note([110, 103, 100, 32], YOURS, tap("two fingers move it", "right-drag to move"), UNDER),
        note([216, 108, 102, 28], YOURS, tap("pinch to zoom", "scroll to zoom"), UNDER),
      ] };
    case "pieces": {
      const notes = [note([248, 44, 70, 48], YOURS, "arrows: where it can go")];
      if (t.boxed && t.boxed.length) notes.push(note([2, 50, 70, 50], PLAIN, "boxed in for now"));
      return { mood: "grin", line: tap("Your move! Tap a piece.", "Your move! Click a piece."), notes };
    }
    case "waiting":
      return { mood: "hmm", line: "Hang on, it's thinking!", notes: [
        note([60, 90, 122, 30], THEIRS, "the computer's move", UNDER),
        note([188, 90, 100, 30], YOURS, "then yours", UNDER),
      ] };
    case "lesson": {
      const p = t.lessonPic || {};
      const times = Math.min(2, Math.max(1, p.times || 1)), cost = p.cost || 1, disc = p.type === "cabeza";
      const how = disc
        ? (times > 1 ? say("up to {n} steps, any way", { n: times }) : "one step, any way")
        : times > 1 ? say("up to {n} rolls", { n: times }) : cost > 1 ? "rolls just once" : "one roll";
      const notes = [note([114, 106, 116, 30], YOURS, how, UNDER)];
      if (t.lesson && t.lesson.name) notes.unshift(note([4, 4, 104, 26], YOURS, t.lesson.name, { align: "center", v: "top", size: 14 }));
      if (p.can === false) return { mood: "wince", line: "Boxed in! Try another piece.", notes };
      if (p.locked && p.left > 0) return { mood: "grin", line: disc ? "Step again, or hold it to end your turn." : "Roll again, or hold it to end your turn.", notes };
      // (Where it can go, as the board marks it once the tour's arrows are
      // gone: its squares outlined; user, of the options: "definitely go
      // with D", "Tap an outlined square to move there!"; the arrows kept,
      // the tour's alone: "don't get rid of the arrows because they're
      // only going to be there just for the tutorial".)
      return { mood: "grin", line: tap("Tap an outlined square to move there!", "Click an outlined square to move there!"), notes };
    }
    case "foe": {
      if (t.waiting) return { mood: "hmm", line: "Its turn. Watch the board!", notes: [note([212, 36, 104, 40], THEIRS, "the computer's move")] };
      const notes = [note([128, 80, 66, 46], THEIRS, "it moved this one", UNDER)];
      if (t.menu) notes.push(note([214, 94, 54, 22], YOURS, "your menu", { align: "right" }));
      return { mood: "grin", line: t.menu ? "First, a quick look at your menu!" : tap("Your turn again! Tap a piece.", "Your turn again! Click a piece."), notes };
    }
    case "menu":
      return { mood: "grin", line: "Your menu lives in the corner.", notes: [
        note([10, 1, 82, 18], YOURS, tap("tap the piece", "click the piece"), { align: "center", v: "bottom" }),
        note([120, 1, 82, 18], YOURS, "the menu opens", { align: "center", v: "bottom" }),
        note([230, 1, 82, 18], YOURS, tap("tap away to close", "click away to close"), { align: "center", v: "bottom" }),
      ] };
    case "panel": {
      // (Each tile's, under it: the tiles as TourPictures' Panel lays them.)
      const keys = t.rings
        ? ["who", t.views && t.views.length ? "view" : null, t.sound ? "sound" : null, "more"]
        : [t.undo ? "undo" : null, t.views && t.views.length ? "view" : null, t.check ? "check" : null, t.endGame ? "endgame" : null];
      const rows = keys.filter(Boolean), n = rows.length, s = n > 4 ? 46 : 56, gap = n > 4 ? 12 : 16, x0 = (W - (n * s + (n - 1) * gap)) / 2;
      const words = { who: "whose move", view: "board views", sound: "volume", more: "every setting", undo: "undo your turn", check: "check warning", endgame: "end the game" };
      return { mood: "grin", line: "Here's what's in it!", notes: rows.map((k, i) => note([x0 + i * (s + gap) - gap / 2, (H + s) / 2 + 3, s + gap, 18], PLAIN, words[k], UNDER)) };
    }
    case "foot": {
      const play = note([240, 24, 78, 46], YOURS, tap("tap a piece to play", "click a piece to play"));
      return { mood: "grin", line: "That's it! Your move. Good luck!", notes: t.rings
        ? [note([6, 101, 72, 18], PLAIN, "every setting", UNDER), play]
        : [note([100, 95, 26, 16], GOAL, "on"), note([188, 95, 44, 16], THEIRS, "off"), play] };
    }
    case "bar":
      return { mood: "grin", line: "Your menu, as a bar.", notes: [note([192, 2, 126, 30], YOURS, "the piece, back any time")] };
    default:
      return null;
  }
}

/* ------------------------------------------------------------- the card */

// (His marker: Patrick Hand, as his comic's; the store hasn't it.)
function useHandFont() {
  useEffect(() => {
    if (typeof document === "undefined" || document.querySelector('link[href*="family=Patrick+Hand"]')) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = fontsHref("family=Patrick+Hand");
    document.head.appendChild(l);
  }, []);
}

const COACH_CSS = `
.ec-coach-note { position: absolute; display: flex; flex-direction: column; pointer-events: none; }
.ec-coach-note > div { font-family: 'Patrick Hand', 'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', cursive; font-weight: 400; line-height: 1.02; text-wrap: balance; hyphens: none;
  text-shadow: 0 1px 0 rgba(0,0,0,.75), 0 0 6px rgba(0,0,0,.55); transform: rotate(-3deg); }
.ec-coach-note b { font-weight: 400; font-size: 1.18em; letter-spacing: .01em; white-space: nowrap; }
.ec-coach-face { flex: none; position: relative; z-index: 1; box-sizing: border-box; border-radius: 50%; overflow: hidden; background: #EFC98A;
  border: 3px solid ${CREAM}; box-shadow: 0 2px 0 ${INK}, 0 4px 10px rgba(0,0,0,.35); }
.ec-coach-bubble { position: relative; min-width: 0; box-sizing: border-box; background: ${CREAM}; color: ${INK}; border: 2px solid ${INK}; border-radius: 16px;
  padding: 4px 12px 5px; font-family: 'Patrick Hand', 'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', cursive; font-weight: 400; line-height: 1.1; text-wrap: balance; box-shadow: 2px 2px 0 rgba(46,33,24,.5); }
.ec-coach-bubble::before { content: ""; position: absolute; left: -11px; top: 9px; border: 7px solid transparent; border-right: 10px solid ${INK}; border-left: 0; }
.ec-coach-bubble::after { content: ""; position: absolute; left: -7px; top: 11px; border: 5px solid transparent; border-right: 7px solid ${CREAM}; border-left: 0; }
.ec-coach-bubble.ec-coach-mid { padding: 7px 13px 9px; }
.ec-coach-bubble.ec-coach-mid::before { top: calc(50% - 8px); }
.ec-coach-bubble.ec-coach-mid::after { top: calc(50% - 6px); }
.ec-coach-btn { display: inline-flex; align-items: center; gap: 7px; margin-top: 7px; padding: 6px 12px 6px 9px; cursor: pointer;
  font: 800 12.5px/1.05 'Libre Franklin', 'Franklin Gothic Medium', Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; text-align: left;
  background: #A8321F; color: #F6EEDA; border: 2px solid ${INK}; border-radius: 2px; box-shadow: 3px 3px 0 ${INK}; }
.ec-coach-btn.ec-coach-ghost { background: transparent; color: ${INK}; border-color: rgba(46,33,24,.55); box-shadow: none; }
.ec-coach-btn:active { transform: translate(1px, 1px); }
.ec-coach-btn:focus-visible { outline: 2px solid ${INK}; outline-offset: 3px; }
.ec-coach-btn svg { flex: none; width: 16px; height: 16px; }
.ec-coach-pips { display: flex; gap: 5px; margin: 5px 0 1px; }
.ec-coach-pips i { width: 7px; height: 7px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid ${INK}; opacity: .55; }
.ec-coach-pips i.on { background: ${INK}; opacity: 1; }
.ec-coach-focus rect.ec-coach-hole, .ec-coach-focus rect.ec-coach-edge { transition: x .35s ease, y .35s ease, width .35s ease, height .35s ease; }
@media (prefers-reduced-motion: reduce) { .ec-coach-focus rect.ec-coach-hole, .ec-coach-focus rect.ec-coach-edge { transition: none; } }
`;
const V = { top: "flex-start", middle: "center", bottom: "flex-end" };
const TURN_AT = { left: "0 50%", center: "50% 50%", right: "100% 50%" };
const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;

/* A note's words at the picture's size, or else the largest size that fits
   its box (no word wider than it, no more lines than its height holds). */
function fitNote(box, k) {
  const words = box.firstElementChild;
  if (!words) return;
  const want = (Number(box.dataset.size) || 13) * k;
  const bw = box.clientWidth, bh = box.clientHeight;
  const fits = (fs) => {
    words.style.fontSize = `${fs}px`;
    return words.scrollWidth <= bw + 0.5 && words.offsetHeight <= bh + 0.5;
  };
  if (!bw || !bh || fits(want)) { box.dataset.fit = "1.000"; return; }
  let lo = Math.min(6, want), hi = want;
  for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  words.style.fontSize = `${lo}px`;
  box.dataset.fit = (lo / want).toFixed(3);
}

/* The picture with Steve: the notes over it, his face leaning in at its
   lower left, his line in a bubble beside him and the card's buttons
   (`nav`) under it, beside him too, so his bigger face costs the card no
   height. Everything in proportion to the picture (k: its pixels to its
   units). */
export function CoachPicture({ t, still, anim, nav = null, part = 0 }) {
  const whole = coachFor(t);
  // (A card in steps: the step's line, face, notes and the part it lights.)
  const parts = whole && whole.parts, at = parts ? Math.max(0, Math.min(parts.length - 1, part)) : 0;
  const coach = parts ? { ...whole, ...parts[at] } : whole;
  const boxRef = useRef(null), lineRef = useRef(null);
  const [k, setK] = useState(0);
  const [scale, setScale] = useState(1);
  useHandFont();
  const fitRef = useRef(null);
  fitRef.current = () => {
    const el = boxRef.current;
    if (!el || !el.clientWidth) return;
    const kk = el.clientWidth / W;
    if (Math.abs(kk - k) > 0.002) setK(kk);
    const sc = textScale(lineRef.current);
    if (Math.abs(sc - scale) > 0.02) setScale(sc);
    el.querySelectorAll("[data-note]").forEach((b) => fitNote(b, kk));
  };
  // (After each drawing, as it comes; and when the card's width changes or
  // the marker's font arrives.)
  useLayoutEffect(() => { fitRef.current(); });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    let raf = 0;
    const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fitRef.current && fitRef.current()); };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(again) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", again);
    const fonts = typeof document !== "undefined" ? document.fonts : null;
    if (fonts && fonts.ready) fonts.ready.then(again, () => {});
    if (fonts && fonts.addEventListener) fonts.addEventListener("loadingdone", again);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", again);
      if (fonts && fonts.removeEventListener) fonts.removeEventListener("loadingdone", again);
    };
  }, []);
  if (!coach) return <TourPicture t={t} still={still} anim={anim} />;
  const kk = k || 1.4, pic = pictureOf(t);
  const face = Math.round(FACE * kk);
  return (
    <div data-testid="tour-coach" data-picture={pic} data-part={parts ? at : undefined} data-parts={parts ? parts.length : undefined}>
      <style>{COACH_CSS}</style>
      <div ref={boxRef} style={{ position: "relative" }}>
        <TourPicture t={t} still={still} anim={anim} />
        {coach.focus && <Focus box={coach.focus} />}
        <div data-testid="tour-coach-notes" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {coach.notes.map((n, i) => (
            <div
              key={`${pic}-${i}`}
              data-note={i}
              data-size={n.size || 13}
              data-box={n.box.map((v) => Math.round(v * 10) / 10).join(",")}
              className="ec-coach-note"
              style={{ left: pct(n.box[0], W), top: pct(n.box[1], H), width: pct(n.box[2], W), height: pct(n.box[3], H), justifyContent: V[n.v || "middle"], textAlign: n.align || "left", color: TONES[n.tone] }}
            >
              <div style={{ fontSize: (n.size || 13) * kk, transformOrigin: TURN_AT[n.align || "left"] }}>
                {n.text}
                {n.end ? <> <b>{n.end}</b></> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: Math.round(8 * kk) }}>
        <SteveFace mood={coach.mood} size={face} style={{ marginTop: -Math.round(OVER * kk), marginLeft: -Math.round(5 * kk) }} />
        <div data-testid="tour-coach-side" style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: Math.round(8 * kk), paddingTop: 6 }}>
          <div ref={lineRef} data-testid="tour-coach-line" className="ec-coach-bubble" style={{ alignSelf: "flex-start", fontSize: bubbleFont(kk, scale) }}>
            {Array.isArray(coach.line) ? coach.line.map((l, i) => <span key={i} data-line={i} style={{ display: "block" }}>{l}</span>) : coach.line}
            {parts && (
              <span className="ec-coach-pips" aria-hidden="true">
                {parts.map((_, i) => <i key={i} className={i === at ? "on" : ""} />)}
              </span>
            )}
          </div>
          {nav}
        </div>
      </div>
    </div>
  );
}

/* The part of the picture a step is about, lit; the rest dimmed (a mask
   with the part cut out of it, a yellow edge round it; moving to the next
   step's part). The geometry set both ways: as attributes, and as style
   for the move where the browser animates it. */
function Focus({ box }) {
  const [x, y, w, h] = box;
  const geo = { x, y, width: w, height: h };
  // (Its mask's own name: one per picture, should there be two.)
  const id = `ec-coach-focus-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg className="ec-coach-focus" data-testid="tour-coach-focus" data-box={box.join(",")} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y="0" width={W} height={H} fill="#fff" />
          <rect className="ec-coach-hole" {...geo} style={geo} rx="9" fill="#000" />
        </mask>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="8" fill="rgba(18,12,6,0.64)" mask={`url(#${id})`} />
      <rect className="ec-coach-edge" {...geo} style={geo} rx="9" fill="none" stroke={TONES.mine} strokeWidth="1.6" strokeOpacity="0.8" />
    </svg>
  );
}

// A note, a slash through it for off.
const MusicIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

/* Steve on a card with no picture (the tour's first card): his face, a
   line, and a button in his bubble ({ label, onClick, testid, off, ghost }:
   the store's red, or quiet). Sized as on the pictures' cards, by the
   card's width. */
export function SteveSays({ mood = "grin", line, action = null, testid = "tour-coach-say" }) {
  const ref = useRef(null), lineRef = useRef(null);
  const [w, setW] = useState(0);
  const [scale, setScale] = useState(1);
  useHandFont();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => { setW(el.clientWidth); setScale(textScale(lineRef.current)); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, []);
  const k = (w || 448) / W;
  return (
    <div ref={ref} data-testid={testid} data-mood={mood} style={{ display: "flex", alignItems: "center", gap: Math.round(10 * k) }}>
      <style>{COACH_CSS}</style>
      <SteveFace mood={mood} size={Math.round(FACE * k)} />
      <div ref={lineRef} data-testid="tour-coach-line" className="ec-coach-bubble ec-coach-mid" style={{ flex: "0 1 auto", fontSize: bubbleFont(k, scale) }}>
        {Array.isArray(line) ? line.map((l, i) => <span key={i} data-line={i} style={{ display: "block" }}>{l}</span>) : line}
        {action && (
          <>
            {!Array.isArray(line) && <br />}
            <button type="button" data-testid={action.testid} className={`ec-coach-btn${action.ghost ? " ec-coach-ghost" : ""}`} onClick={action.onClick}>
              <MusicIcon off={!!action.off} />
              {action.label}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
