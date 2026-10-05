/* What each theme calls its two sides (user: "all references to dark and
   light" changed to fit the theme; chosen with the user one theme at a
   time). The game itself still says "dark" and "light" inside (the
   engine, the AI, saved games, data attributes and test ids): these are
   only the words a person reads. Dark is always listed first: it is the
   near side and, by default, the side that opens.

   Keyed by the theme's id or the switcher's world id. A theme module
   exports its pair as `sideNames` (the chassis reads theme.sideNames);
   menus that only know a world id (the reality gate) use sideNamesFor. */

const WOOD = { dark: "Walnut", light: "Ash" }; // the 1975 set: walnut and olive ash blocks

export const DEFAULT_SIDE_NAMES = { dark: "Dark", light: "Light" };

export const SIDE_NAMES = {
  standard: WOOD,
  den: WOOD,
  tienda: WOOD,
  store: WOOD,
  parrish: WOOD,
  neon: { dark: "Photon", light: "Plasma" },
  lluvia: { dark: "Mưa", light: "Nắng" }, // rain / sun
  cromo: { dark: "Steel", light: "Chrome" },
  // Theme Lab
  swiss: { dark: "Black", light: "White" },
  bauhaus: { dark: "Red", light: "Blue" },
  destijl: { dark: "Red", light: "Blue" },
  elementarism: { dark: "Graphite", light: "Silver" },
  brutalist: { dark: "Iron", light: "Concrete" },
  newTypography: { dark: "Ink", light: "Paper" },
  corporateSwiss: { dark: "Navy", light: "Platinum" },
  neoBrutalist: { dark: "Pink", light: "Yellow" },
  minimalMono: { dark: "Black", light: "White" },
  ultimateFusion: { dark: "Charcoal", light: "Bone" },
};

export function sideNamesFor(id) {
  const key = String(id || "");
  if (SIDE_NAMES[key]) return SIDE_NAMES[key];
  if (key.startsWith("lab-") && SIDE_NAMES[key.slice(4)]) return SIDE_NAMES[key.slice(4)];
  if (key.startsWith("parrish")) return WOOD;
  return DEFAULT_SIDE_NAMES;
}

/* The pair a theme module carries, or the plain one. */
export const sideNamesOf = (theme) => (theme && theme.sideNames) || DEFAULT_SIDE_NAMES;
