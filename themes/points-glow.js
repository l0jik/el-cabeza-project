/* The action-points counter's ember colours (user: the points "glowing,
   and when it's used, it is no longer glowing"; Ember, breathing; "the
   color of the glowing ember ... thematically appropriate for each one").
   Each world's light for each side, dark (the first side) and light.
   Chosen with the user from a page of them; where the sides are named
   for colours (Bauhaus, De Stijl, Neo-Brutalism) the embers are those.

   Keyed like side-names.js: a theme's id or the switcher's world id. A
   theme module exports its pair as `pointsGlow` (the chassis reads
   theme.pointsGlow); with none, the chassis falls back to the theme's
   accent colours. */

export const POINTS_GLOW = {
  standard: { dark: "#ff8a2a", light: "#ffd98a" }, // the den: firelight, lamplight
  den: { dark: "#ff8a2a", light: "#ffd98a" },
  tienda: { dark: "#f2b632", light: "#6dffb0" }, // Big Glutts: harvest gold, the register's green digits
  store: { dark: "#f2b632", light: "#6dffb0" },
  neon: { dark: "#4de8ff", light: "#ffb454" }, // its own glows
  lluvia: { dark: "#3fe6ff", light: "#ff4fa3" }, // signs in the rain
  cromo: { dark: "#8fcaff", light: "#f4f8ff" }, // a cold blue pilot light, chrome white
  // (Walnut's points are walnut, user: "because the ash ones already look
  // like ash"; they were sun gold and candle amber.)
  "parrish-orinoco": { dark: "#8a5632", light: "#fff1d0" }, // walnut, sea-foam cream
  "parrish-watermark": { dark: "#a0653a", light: "#ff8fa8" }, // walnut by the candle, rose wine
  // Theme Lab
  swiss: { dark: "#e63946", light: "#ffffff" },
  bauhaus: { dark: "#d1362a", light: "#3f78ff" },
  destijl: { dark: "#d7261e", light: "#3d66ff" },
  elementarism: { dark: "#ff5a1f", light: "#c9d2db" },
  brutalist: { dark: "#ff3b00", light: "#e4ddd0" },
  newTypography: { dark: "#d0021b", light: "#fff6e6" },
  corporateSwiss: { dark: "#ffc400", light: "#cfe0ff" },
  neoBrutalist: { dark: "#ff4f9a", light: "#ffe14d" },
  minimalMono: { dark: "#bfbfbf", light: "#ffffff" },
  ultimateFusion: { dark: "#c1121f", light: "#f2b705" },
};

export function pointsGlowFor(id) {
  const key = String(id || "");
  if (POINTS_GLOW[key]) return POINTS_GLOW[key];
  if (key.startsWith("lab-") && POINTS_GLOW[key.slice(4)]) return POINTS_GLOW[key.slice(4)];
  return null;
}
