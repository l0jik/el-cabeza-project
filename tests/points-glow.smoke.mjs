/* The Actions dots in every world in the colour of its pieces (user,
   2026-10-29, of Futuris's orange dots for its white Plasma pieces,
   everywhere: "action point counter colors reflect the pieces they are
   standing in for"; themes/points-glow.js).

   For every world in the switcher (themes/realities.js), each side's
   dots against its pieces' own colour: side-names.js's swatch, the dot
   beside the side's name where you pick one.
   - Its own pair: no world left to the accents' fallback.
   - The pieces' hue, where the pieces have one (within 30°), and no
     brighter a colour than lit pieces of it show (walnut a lit brown, not
     the den's old firelight orange); no colour of their own where the
     pieces are black, white or grey.
   - Lit: light enough to glow on the dark and to read apart from a spent
     dot (a dark bead).
   - Where both sides' pieces are greys (black and white, steel and
     chrome), the dark side's dots are the darker, by a step you can see
     (Noir's Shadow's were all but Silver's white).
   Two sides are held to their pieces as drawn, not their swatch:
   Futuris's Photon, near-black glass that reads teal, seen through and
   lit at its edges; and Lluvia's Nắng, pale pink pieces that the signs
   light magenta. The store's dots are the
   first game's tags, yours yellow and the computer's red (user), so its
   pair is checked as that.

   node tests/points-glow.smoke.mjs */
import { WORLDS } from "../themes/realities.js";
import { pointsGlowFor, pointsGlowYouFor } from "../themes/points-glow.js";
import { sideNamesFor } from "../themes/side-names.js";

let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; if (!ok) console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); };

// sRGB hex to OKLCH (L 0..1, C, h in degrees).
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const HEX = /^#[0-9a-f]{6}$/i;
const NEUTRAL = 0.04; // chroma under which a colour is a grey

// The pieces as drawn, where that isn't their swatch.
const AS_DRAWN = { "futuris:dark": "#2c5f68", "lluvia:light": "#c94bbf" };

for (const w of WORLDS) {
  const glow = pointsGlowFor(w.id);
  check(`${w.id}: its own Actions dots`, !!glow && HEX.test(glow.dark || "") && HEX.test(glow.light || ""), JSON.stringify(glow));
  if (!glow) continue;
  if (w.id === "store") {
    const you = pointsGlowYouFor(w.id);
    check("store: yours the tags' yellow, the computer's their red", !!you && you.you === "#ffd23f" && you.them === "#ff5470" && glow.light === "#ffd23f" && glow.dark === "#ff5470", JSON.stringify({ glow, you }));
    continue;
  }
  const names = sideNamesFor(w.id);
  const greys = {};
  for (const side of ["dark", "light"]) {
    const pieces = AS_DRAWN[`${w.id}:${side}`] || names.swatch[side];
    const p = oklch(pieces), d = oklch(glow[side]);
    const label = `${w.id}: ${names[side]}'s dots ${glow[side]} for pieces ${pieces}`;
    if (p.C >= NEUTRAL) check(`${label}: the pieces' hue, no brighter`, d.C >= NEUTRAL && hueGap(p.h, d.h) <= 30 && d.C <= p.C * 2 + 0.03, `C ${d.C.toFixed(3)} for ${p.C.toFixed(3)}, ${hueGap(p.h, d.h).toFixed(0)}° off`);
    else check(`${label}: grey, as the pieces are`, d.C < NEUTRAL, `C ${d.C.toFixed(3)}`);
    check(`${label}: lit`, d.L >= 0.45, `L ${d.L.toFixed(2)}`);
    greys[side] = p.C < NEUTRAL ? d.L : null;
  }
  if (greys.dark !== null && greys.light !== null) check(`${w.id}: the dark side's grey dots the darker`, greys.light - greys.dark >= 0.2, JSON.stringify(greys));
}

console.log(`points glow: ${checks} checks, ${fails} failed`);
if (fails) process.exit(1);
