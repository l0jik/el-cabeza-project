/* Shoving's settings, written once for every world (user, of the Cabeza
   Nova menu: "All pieces or only opponents buttons should be available
   for [slides] only as well in all relevant instances throughout all
   themes. This should be written into the chassis"; asked, one choice for
   slides and rolls alike). Read by the shared menus
   (themes/rules-selections.js: the store, the worlds' gate menus), Futuris's
   sphere, Lluvia's terminal, the corner menu and the rules cards.

   Three choices while the Shoving law is on:
   - which moves shove: "Slides and rolls" or "Slides only" (the default:
     a roll into a piece is simply blocked, as without the law);
   - which pieces a shove may push, a slide's or a roll's: "All pieces"
     or "Only opponents" (the default: one of your own in the way blocks
     the move, as without the law);
   - what a piece behind one being pushed does: "Block" (the default, the
     rule as it was) or "Pushed too", the whole line along with it, as
     long as all of it together has fewer cubes than the piece pushing
     (user, of the Shove card's "Anything behind them blocks": "add a
     chassis level rule toggle ... this rule that can be toggled will
     allow you to push however many blocks are in the path behind it, as
     long as the total number of cubes is less than the pushing piece").
   (The defaults were Slides and rolls and All pieces until the user,
   2026-10-21, ringing Slides only and Only opponents: "Make the orange
   highlighted buttons the default, globally.")
   A selection keeps them as shove: { onRolls, own, chain }; the engine
   gets ACTIVE_LAWS.shoveOnRolls, ACTIVE_LAWS.shoveOwn and
   ACTIVE_LAWS.shoveChain (engine/rules.js tryShove, shoveLine). */

// Each setting and its two options, in the order the menus show them.
export const SHOVE_SETTINGS = [
  { key: "onRolls", name: "Shoves on", options: [{ value: true, name: "Slides and rolls" }, { value: false, name: "Slides only" }] },
  { key: "own", name: "Shoves push", options: [{ value: true, name: "All pieces" }, { value: false, name: "Only opponents" }] },
  { key: "chain", name: "Pieces behind", options: [{ value: true, name: "Pushed too" }, { value: false, name: "Block" }] },
];
// (v: saved since these defaults. A save without it is from before.)
const SHOVE_V = 2;
export const DEFAULT_SHOVE = { onRolls: false, own: false, chain: false, v: SHOVE_V };

// A saved setting read back. From before these defaults, an answer it
// hasn't was the old default (slides and rolls, all pieces), and one
// from when the pieces choice was for rolls only (ownOnRolls) keeps its
// answer, now for every shove; and one still on both old defaults takes
// today's, once ("globally", user: a menu left as it was shows them).
// An older save's push distance is dropped (the rule fixes it). One from
// before pieces behind could be pushed has them block, as they did.
export function shoveOf(saved) {
  if (!saved || typeof saved !== "object") return { ...DEFAULT_SHOVE };
  const s = saved, now = s.v === SHOVE_V;
  const onRolls = typeof s.onRolls === "boolean" ? s.onRolls : now ? DEFAULT_SHOVE.onRolls : true;
  const own = typeof s.own === "boolean" ? s.own : typeof s.ownOnRolls === "boolean" ? s.ownOnRolls : now ? DEFAULT_SHOVE.own : true;
  const chain = s.chain === true;
  if (!now && onRolls && own) return { ...DEFAULT_SHOVE, chain };
  return { onRolls, own, chain, v: SHOVE_V };
}

// What the engine gets (setActiveLaws).
export function shoveLaws(saved) {
  const s = shoveOf(saved);
  return { shoveOnRolls: s.onRolls, shoveOwn: s.own, shoveChain: s.chain };
}

// The engine's laws back as a setting (the corner menu, the rules cards):
// as the engine reads them, a law without its settings shoving on rolls,
// pushing any piece and blocked by pieces behind (every game sets all
// three). (Today's, v: read as an old save, slides and rolls with all
// pieces came back as the defaults, and the corner menu said so.)
export const shoveFromLaws = (laws = {}) => ({ onRolls: laws.shoveOnRolls !== false, own: laws.shoveOwn !== false, chain: laws.shoveChain === true, v: SHOVE_V });

// Each setting with the name of what's chosen: [["Shoves on", "Slides
// only"], ["Shoves push", "Only opponents"]] (the corner menu's lines).
export function shoveChosen(saved) {
  const s = shoveOf(saved);
  return SHOVE_SETTINGS.map((st) => [st.name, st.options.find((o) => o.value === s[st.key]).name]);
}

// For a summary: "slides and rolls", "slides only", "slides and rolls,
// only opponents", "slides only, only opponents", and ", whole lines" when
// pieces behind are pushed too. `say` puts each part in the player's
// language (chassis/i18n.js tr; this file is the engine's too, so it
// doesn't bring the tables in itself).
export function shoveSummary(saved, say = (w) => w) {
  const s = shoveOf(saved);
  return `${say(s.onRolls ? "slides and rolls" : "slides only")}${s.own ? "" : say(", only opponents")}${s.chain ? say(", whole lines") : ""}`;
}

// The sentence for "Only opponents", wherever a setting's described
// ("pieces" said, user: "One of your own pieces in the way...").
export const OWN_BLOCKS = "A shove pushes only your opponent's pieces: one of your own pieces in the way blocks the move.";

// The sentence for "Pushed too": pieces behind go along, the whole line.
export const LINE_PUSHED = "Pieces behind the ones pushed are pushed along too, the whole line, as long as all of it together has fewer cubes than the piece pushing.";

/* What actually shoves with the rules as they're set, for the line under
   the settings (user: the Slide/Shoving link confused even the
   developer). It changes as Orthogonal slide is ticked. `laws` are the
   menu's own: slide, diagonalSlide. The menus keep "Slides only" and
   Orthogonal slide in step (rules-selections.js toggleLaw and setShove,
   Futuris's sphere its own), and the buttons show it when they move, so
   the line no longer warns of it (user, of "Turning Orthogonal slide off
   switches this back to Slides and rolls": "a bit opaque ... we should
   take it out"; its twin "Choosing Slides only turns it on" went too).
   No "Right now", and "can" (user, "only slides shove" ringed: "Only
   slides can shove..."), in each of its forms. */
export function shoveNow(saved, laws = {}) {
  const s = shoveOf(saved);
  // (And never on a diagonal, user: said while Diagonal slide is on.)
  // (Sentences, as the language tables have them: chassis/i18n.js.)
  const diag = laws.diagonalSlide ? "Diagonal slides never shove." : "";
  const own = [s.own ? "" : OWN_BLOCKS, s.chain ? LINE_PUSHED : ""];
  const say = (...xs) => xs.flat().filter(Boolean).join(" ");
  if (!s.onRolls)
    return say("Only slides can shove.", diag, "A roll into a piece is just blocked.", own);
  if (!laws.slide)
    return laws.diagonalSlide
      ? say("Only rolls can shove: Orthogonal slide is off, and diagonal slides never shove.", own)
      : say("Only rolls can shove: Orthogonal slide is off, so there are no slides to shove with.", own);
  return say("Slides and rolls can both shove.", diag, own);
}
