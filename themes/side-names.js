/* What each theme calls its two sides (user: "all references to dark and
   light" changed to fit the theme; chosen with the user one theme at a
   time). The game itself still says "dark" and "light" inside (the
   engine, the AI, saved games, data attributes and test ids): these are
   only the words a person reads. Dark is always listed first: it is the
   near side and, by default, the side that opens.

   Keyed by the theme's id or the switcher's world id. A theme module
   exports its pair as `sideNames` (the chassis reads theme.sideNames);
   menus that only know a world id (the reality gate) use sideNamesFor. */

/* Where you pick a side, each name also says what its pieces look like
   (user: "whenever the names are not clear... a parenthetical what color
   that name actually is referring to", with a dot of the side's colour;
   the words chosen with the user one world at a time). `hint` only where
   the name doesn't already say it; `swatch` is the pieces' own colour,
   for the dot. */
const pair = (dark, light, swatch, hint) => ({ dark, light, swatch: { dark: swatch[0], light: swatch[1] }, ...(hint ? { hint: { dark: hint[0], light: hint[1] } } : {}) });

const WOOD = pair("Walnut", "Ash", ["#4A2C1C", "#D9B77E"], ["dark", "light"]); // the 1975 set: walnut and olive ash blocks

export const DEFAULT_SIDE_NAMES = pair("Dark", "Light", ["#2E2E2E", "#ECECEC"]);

export const SIDE_NAMES = {
  standard: WOOD,
  den: WOOD,
  tienda: WOOD,
  store: WOOD,
  parrish: WOOD,
  neon: pair("Photon", "Plasma", ["#0D1116", "#FFFFFF"], ["dark", "light"]),
  lluvia: pair("Mưa", "Nắng", ["#0B3B47", "#FFD0EF"], ["teal", "pink"]), // rain / sun
  cromo: pair("Steel", "Chrome", ["#5A5347", "#F2F3F5"], ["dark", "bright"]),
  plano: pair("Blue", "White", ["#163F75", "#DBE9F8"]), // the blueprint: hatched blue masses, white masses
  luna: pair("Mare", "Terra", ["#2C3038", "#ECEEF0"], ["dark", "light"]), // the moon's dark seas and bright highlands
  // Theme Lab (only Iron and Ink, of its names, aren't colours already)
  swiss: pair("Black", "White", ["#111111", "#FAFAF8"]),
  bauhaus: pair("Red", "Blue", ["#C8332A", "#1F4EA3"]),
  destijl: pair("Red", "Blue", ["#D7261E", "#1B3FA0"]),
  elementarism: pair("Graphite", "Silver", ["#2A3038", "#D5DBE1"]),
  brutalist: pair("Iron", "Concrete", ["#2B2A28", "#C9C5BC"], ["dark", "light"]),
  newTypography: pair("Ink", "Paper", ["#141210", "#F1EADB"], ["dark", "light"]),
  corporateSwiss: pair("Navy", "Platinum", ["#1A2B4A", "#D8DEE8"]),
  neoBrutalist: pair("Pink", "Yellow", ["#FF4F9A", "#FFE14D"]),
  minimalMono: pair("Black", "White", ["#0A0A0A", "#FFFFFF"]),
  ultimateFusion: pair("Charcoal", "Bone", ["#2B2B2B", "#EAE6DF"]),
};

/* "Photon (dark)", or just "Red" where the name says it already. */
export const sideLabel = (names, side) => (names.hint && names.hint[side] ? `${names[side]} (${names.hint[side]})` : names[side]);
/* The side's piece colour, for the dot beside its name. */
export const sideSwatch = (names, side) => (names.swatch && names.swatch[side]) || (side === "dark" ? "#2E2E2E" : "#ECECEC");
/* The dot's style: the colour, ringed so a black or white one shows on
   any ground. */
export const sideDotStyle = (names, side, size = 10) => ({
  display: "inline-block", width: size, height: size, borderRadius: "50%", flexShrink: 0, verticalAlign: "-0.05em",
  marginRight: "0.45em", background: sideSwatch(names, side), boxShadow: "0 0 0 1px rgba(128,128,128,0.75)",
});

export function sideNamesFor(id) {
  const key = String(id || "");
  if (SIDE_NAMES[key]) return SIDE_NAMES[key];
  if (key.startsWith("lab-") && SIDE_NAMES[key.slice(4)]) return SIDE_NAMES[key.slice(4)];
  if (key.startsWith("parrish")) return WOOD;
  return DEFAULT_SIDE_NAMES;
}

/* The pair a theme module carries, or the plain one. */
export const sideNamesOf = (theme) => (theme && theme.sideNames) || DEFAULT_SIDE_NAMES;
