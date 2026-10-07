/* Parrish's two palettes (user: "maybe we can try to do two different
   color palettes"; abstract, no theme, the feeling of the references):

     orinoco    after Enya's "Orinoco Flow" video: high-key and airy, creams,
                sky blue, cobalt streaks, turquoise, sage, lemon, mauve,
                touches of rose, gold leaf.
     watermark  after her "Watermark" cover: dark reds, crimson and wine,
                ruddy browns and umber, a weathered teal-grey patina,
                cream only in the lights.

   ?look=orinoco|watermark in the address picks one (orinoco by default,
   while they're under review). Each gives the world's colour fields
   (six stops, dark to light, in the order the field runs), the strokes'
   accent colours, the grade (how far the darks lift, the gamma), the glow,
   the vignette's colour, and the lights. */

export const LOOKS = {
  orinoco: {
    field: [[0.14, 0.27, 0.56], [0.36, 0.54, 0.8], [0.42, 0.7, 0.74], [0.62, 0.76, 0.9], [0.95, 0.92, 0.84], [0.96, 0.9, 0.64]],
    bias: 0.08,
    blot: [0.64, 0.52, 0.64],   // patches through the fields: mauve
    blot2: [0.6, 0.75, 0.6],    // and sage
    accents: [[0.96, 0.93, 0.84], [0.97, 0.91, 0.62], [0.6, 0.75, 0.6], [0.66, 0.52, 0.62], [0.24, 0.42, 0.76], [0.9, 0.58, 0.56], [0.42, 0.7, 0.72], [0.86, 0.7, 0.38]],
    lift: [0.15, 0.19, 0.27], gamma: 0.86, glow: 0.22, vignette: [0.62, 0.52, 0.6],
    // A line round the whole of each light piece, its foot too (user: they
    // all but vanished on the light squares); parrish-paint.js uPieceEdge.
    pieceEdge: 0.95,
    lights: { key: [0xfff4e2, 1.05], fill: [0xc8dcff, 0.35], back: [0xffe2d0, 0.3] },
    bg: "#9DBEE6",
  },
  watermark: {
    field: [[0.04, 0.015, 0.02], [0.16, 0.035, 0.045], [0.3, 0.12, 0.07], [0.48, 0.06, 0.09], [0.56, 0.28, 0.16], [0.78, 0.68, 0.54]],
    bias: -0.1,
    blot: [0.38, 0.47, 0.45],   // the patina
    blot2: [0.24, 0.14, 0.1],   // umber
    accents: [[0.56, 0.08, 0.12], [0.36, 0.05, 0.08], [0.62, 0.32, 0.2], [0.42, 0.5, 0.48], [0.84, 0.76, 0.62], [0.74, 0.2, 0.18], [0.28, 0.17, 0.12], [0.8, 0.62, 0.34]],
    lift: [0.05, 0.03, 0.035], gamma: 0.95, glow: 0.16, vignette: [0.28, 0.08, 0.1],
    lights: { key: [0xffdcb8, 1.0], fill: [0xc89a9a, 0.3], back: [0xff9a80, 0.35] },
    bg: "#3A0C12",
  },
};

/* What each look is called (user): Orinoco is "Tá muid beo", Watermark
   "Go deo na ndeor". (The address keeps ?look=orinoco / ?look=watermark.) */
export const LOOK_TITLES = { orinoco: "T\u00e1 muid beo", watermark: "Go deo na ndeor" };
export const lookTitle = () => LOOK_TITLES[lookName()];
export function lookName() {
  try {
    const l = new URLSearchParams(window.location.search).get("look");
    if (l && LOOKS[l]) return l;
  } catch (e) { /* no URL */ }
  return "orinoco";
}
export const look = () => LOOKS[lookName()];
