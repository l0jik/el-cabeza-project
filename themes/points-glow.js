/* The Actions counter's dots: each side's in the colour of its own pieces
   (user, 2026-10-29, of Futuris's orange dots for its white Plasma
   pieces, everywhere: "action point counter colors reflect the pieces
   they are standing in for"). Each dot is an ember (user: the
   points "glowing, and when it's used, it is no longer glowing"), so a
   dark side's is its pieces' colour lit: lifted enough to glow on the
   dark and to stand apart from a spent one, the hue and the tint kept
   (black pieces grey, walnut a lit walnut, navy a lit navy). Chosen from
   each world's pieces as they're drawn in play (scratch dots/: every
   world's pieces photographed and sampled side by side); the pieces' own
   colour in the tables is side-names.js's swatch, and
   tests/points-glow.smoke.mjs holds each dot to it.

   Keyed like side-names.js: a theme's id or the switcher's world id. A
   theme module exports its pair as `pointsGlow` (the chassis reads
   theme.pointsGlow); with none, the chassis falls back to the theme's
   accent colours. */

export const POINTS_GLOW = {
  // The 1975 set, walnut and ash (Parrish's, the same blocks).
  standard: { dark: "#8a5632", light: "#d9b77e" },
  den: { dark: "#8a5632", light: "#d9b77e" },
  // Big Glutts: the first game's tags (FirstGameTour.jsx TOUR_TONES), Ash's
  // yellow and Walnut's red (user: "Action counter in fresh game / tutorial
  // should be yellow to match the yellow color chosen for user piece label
  // tags & same for opponent--colors should match"); they were harvest gold
  // and the register's green digits.
  tienda: { dark: "#ff5470", light: "#ffd23f" },
  store: { dark: "#ff5470", light: "#ffd23f" },
  // Photon's teal glass (its near-black body seen through, lit by its
  // edges) and Plasma's white.
  futuris: { dark: "#4bb3c3", light: "#eef2f5" },
  lluvia: { dark: "#4fb0d6", light: "#d65cc9" }, // Mưa's teal and Nắng's pink, as the signs light them
  // (The dark side in its pieces' own warm gunmetal, lit (user: "Action point indicator
  // for the dark pieces in chromo ... needs to reflect the color of pieces. I'm not sure
  // why it's blue"); it had been a cold blue pilot light. The light side, chrome white.)
  cromo: { dark: "#b7ad9c", light: "#f4f8ff" },
  plano: { dark: "#5f95dc", light: "#eef1f5" }, // the hatched blue masses, the white ones
  luna: { dark: "#7c828c", light: "#eceef0" }, // Mare's dark modules, Terra's white
  noir: { dark: "#8a8a8a", light: "#d6d6d6" }, // Shadow and Silver
  ciudad: { dark: "#7f92a3", light: "#efede7" }, // Slate's grey-blue, Chalk's white
  // (Each side's points the colour of its pieces, user: Walnut's walnut,
  // and Ash's the honey of the ash blocks; they were sun gold and candle
  // amber, sea-foam cream and rose wine.)
  "parrish-orinoco": { dark: "#8a5632", light: "#d9b77e" }, // walnut, ash
  "parrish-watermark": { dark: "#a0653a", light: "#d4a86c" }, // walnut and ash by the candle
  // Theme Lab
  swiss: { dark: "#8c8c8c", light: "#ffffff" },
  bauhaus: { dark: "#de5a45", light: "#4f86cc" },
  destijl: { dark: "#d7261e", light: "#3a5ccc" },
  brutalist: { dark: "#8e8b86", light: "#d5d3ce" },
  newTypography: { dark: "#8c8781", light: "#f4ecdc" },
  corporateSwiss: { dark: "#5d78a6", light: "#c5cbd5" },
  neoBrutalist: { dark: "#ff62c6", light: "#ffee5e" },
  minimalMono: { dark: "#8c8c8c", light: "#ffffff" },
  ultimateFusion: { dark: "#8b867f", light: "#ebe6dd" },
};

/* Each world's own light for each side, the dots' colours before they
   were the pieces' (user: "the color of the glowing ember ...
   thematically appropriate for each one", chosen from a page of them;
   where the sides are named for colours, those): the den's firelight and
   lamplight, Futuris's own glows, signs in the rain. After a game the
   corner piece still calls in it (chassis dockCall); a world not listed
   here calls in its dots' colours. */
export const WORLD_LIGHT = {
  standard: { dark: "#ff8a2a", light: "#ffd98a" }, // the den: firelight, lamplight
  den: { dark: "#ff8a2a", light: "#ffd98a" },
  futuris: { dark: "#4de8ff", light: "#ffb454" }, // its own glows
  lluvia: { dark: "#3fe6ff", light: "#ff4fa3" }, // signs in the rain
  plano: { dark: "#8ec2ff", light: "#ffffff" }, // the blueprint's line work
  luna: { dark: "#f2c14e", light: "#ff8d3a" }, // the sides' gold and orange, lit
  noir: { dark: "#c8c8c8", light: "#ffffff" }, // a lamp's light, a lit window
  ciudad: { dark: "#a9c8ff", light: "#ffd08a" }, // an office's cool light, a home's warm one
  swiss: { dark: "#e63946", light: "#ffffff" },
  bauhaus: { dark: "#d1362a", light: "#3f78ff" },
  destijl: { dark: "#d7261e", light: "#3d66ff" },
  brutalist: { dark: "#ff3b00", light: "#e4ddd0" },
  newTypography: { dark: "#d0021b", light: "#fff6e6" },
  corporateSwiss: { dark: "#ffc400", light: "#cfe0ff" },
  neoBrutalist: { dark: "#ff4f9a", light: "#ffe14d" },
  minimalMono: { dark: "#bfbfbf", light: "#ffffff" },
  ultimateFusion: { dark: "#c1121f", light: "#f2b705" },
};

/* Where a world's lights are yours and the other player's, not the
   sides' (the store's: the first game's tags say YOU in yellow and the
   computer in red, whichever side you play): { you, them }, by whose the
   side is when you play the computer or online (the chassis reads
   theme.pointsGlowYou; two people at one screen keep the sides' pair). */
export const POINTS_GLOW_YOU = {
  tienda: { you: "#ffd23f", them: "#ff5470" },
  store: { you: "#ffd23f", them: "#ff5470" },
};

export function pointsGlowYouFor(id) {
  return POINTS_GLOW_YOU[String(id || "")] || null;
}

const lookUp = (table, id) => {
  const key = String(id || "");
  if (table[key]) return table[key];
  if (key.startsWith("lab-") && table[key.slice(4)]) return table[key.slice(4)];
  return null;
};

export const pointsGlowFor = (id) => lookUp(POINTS_GLOW, id);
export const worldLightFor = (id) => lookUp(WORLD_LIGHT, id);
