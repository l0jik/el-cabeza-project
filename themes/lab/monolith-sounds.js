/* The Monolith's sound: real stone, recorded (user: "I want the sound
   palette to be non-synthesizer generated. I want real massive: thud /
   boom / scraping sounds that follow the implementation instructions
   previously outlined, per weight dictating pitch, etc."; the direction
   that took the Lab's second place from Bauhaus, user: "we're getting rid
   of Bauhaus and replacing it with something imposing & neolithic
   monoliths").

   Nine recordings, all CC0 from freesound.org (assets/monolith/src/
   CREDITS.md), cut by tools/monolith_sounds.mjs into three files the Lab
   page carries beside it:

     hits    one hit a second: five heavy thumps on stone, four rocks and
             a brick knocked on stone, two rubble thumps
     falls   the concrete smash, a rockfall's blocky chunks, rocks tumbling
     drags   a stone door's slab grinding aside, stone rubbed on stone
             (both held as loops)

   This file is the layout both the tool and the game read (where each
   sound sits in its file), and the weight rules, the same as the wooden
   pieces' (themes/wood-sfx.js): how loud a landing is follows the
   piece's cubes; how low, the face it lands on and a little the whole
   piece (landingSize). A recording is lowered by playing it slower, so
   the exponent is gentler than wood's 1/sqrt: past an octave down, a
   re-pitched thud smears. */
import { massOf, landingSize } from "../wood-sfx.js";

export const MONOLITH_FILES = {
  hits: "el-cabeza-monolith-hits.mp3",
  falls: "el-cabeza-monolith-falls.mp3",
  drags: "el-cabeza-monolith-drags.mp3",
};

// hits: each in its own second, starting at its slot (the game finds the
// attack itself, so an encoder's few milliseconds of delay don't matter).
export const HIT_SLOT = 1;
export const HITS = { thud: [0, 1, 2, 3, 4], knock: [5, 6, 7, 8], rubble: [9, 10] };
export const HIT_COUNT = 11;

// falls: [start, length] in seconds.
export const FALLS = { smash: [0, 1.6], rockfall: [1.6, 7.6], tumble: [9.2, 2.6] };
export const FALLS_LENGTH = 11.8;

// drags: each a held loop inside its stretch ([start, end] of the loop in
// the file, clear of the file's own edges; its last XFADE seconds were
// crossfaded into the XFADE before its start, so it goes round unseen).
export const DRAGS = {
  grind: { at: 0, len: 4.8, loop: [0.35, 4.35] },
  rub: { at: 4.8, len: 4.2, loop: [5.15, 8.45] },
};
export const DRAGS_LENGTH = 9;
export const XFADE = 0.3;

/* The playback rate of a landing: 1.2 for a single cube, down to 0.6 for
   an Opa coming down flat (size 8), each re-pitch within an octave. */
export function landingRate(units, contact) {
  return 1.2 / Math.cbrt(landingSize(units, contact));
}
/* How loud: from 0.55 (one cube) to 1 (eight). */
export function landingLevel(units) {
  return 0.55 + 0.45 * (Math.log2(massOf(units)) / 3);
}
/* The rate a dragged piece grinds at: lower as it's heavier. */
export function dragRate(units) {
  return 1.15 / Math.cbrt(massOf(units));
}

/* Where a hit's attack starts in its slot: the first sample above 2% of
   the slot's own peak (decoders differ by a few ms at a file's start). */
export function attackIn(data, sampleRate, slot) {
  const a = Math.floor(slot * HIT_SLOT * sampleRate), b = Math.min(data.length, Math.floor((slot + 1) * HIT_SLOT * sampleRate));
  let peak = 0;
  for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(data[i]));
  const th = peak * 0.02;
  for (let i = a; i < b; i++) if (Math.abs(data[i]) > th) return Math.max(a, i - Math.floor(sampleRate * 0.002)) / sampleRate;
  return a / sampleRate;
}
/* Where a hit has died away in its slot: just past the last sample above
   half a percent of the slot's peak (the cut's own fade ends it; the rest
   of the slot is silence, and a voice held through it is a voice the
   others can't have). */
export function endIn(data, sampleRate, slot) {
  const a = Math.floor(slot * HIT_SLOT * sampleRate), b = Math.min(data.length, Math.floor((slot + 1) * HIT_SLOT * sampleRate));
  let peak = 0;
  for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(data[i]));
  const th = peak * 0.005;
  for (let i = b - 1; i > a; i--) if (Math.abs(data[i]) > th) return Math.min(b, i + Math.floor(sampleRate * 0.02)) / sampleRate;
  return b / sampleRate;
}
