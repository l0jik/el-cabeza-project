/* Shoving's settings, written once for every world (user, of the Cabeza
   Nova menu: "All pieces or only opponents buttons should be available
   for [slides] only as well in all relevant instances throughout all
   themes. This should be written into the chassis"; asked, one choice for
   slides and rolls alike). Read by the shared menus
   (themes/rules-selections.js: the store, the worlds' gate menus), Neon's
   sphere, Lluvia's terminal, the corner menu and the rules cards.

   Two choices while the Shoving law is on:
   - which moves shove: "Slides and rolls" (the default) or "Slides only"
     (a roll into a piece is simply blocked, as without the law);
   - which pieces a shove may push, a slide's or a roll's: "All pieces"
     (the default) or "Only opponents'" (one of your own in the way blocks
     the move, as without the law).
   A selection keeps them as shove: { onRolls, own }; the engine gets
   ACTIVE_LAWS.shoveOnRolls and ACTIVE_LAWS.shoveOwn (engine/rules.js
   tryShove). */

// Each setting and its two options, in the order the menus show them.
export const SHOVE_SETTINGS = [
  { key: "onRolls", name: "Shoves on", options: [{ value: true, name: "Slides and rolls" }, { value: false, name: "Slides only" }] },
  { key: "own", name: "Shoves push", options: [{ value: true, name: "All pieces" }, { value: false, name: "Only opponents'" }] },
];
export const DEFAULT_SHOVE = { onRolls: true, own: true };

// A saved setting read back: a save from before a choice existed has its
// default; one from when the pieces choice was for rolls only (ownOnRolls)
// keeps its answer, now for every shove. An older save's push distance is
// dropped (the rule fixes it).
export function shoveOf(saved) {
  const s = saved || {};
  return { onRolls: s.onRolls !== false, own: s.own !== undefined ? s.own !== false : s.ownOnRolls !== false };
}

// What the engine gets (setActiveLaws).
export function shoveLaws(saved) {
  const s = shoveOf(saved);
  return { shoveOnRolls: s.onRolls, shoveOwn: s.own };
}

// The engine's laws back as a setting (the corner menu, the rules cards).
export const shoveFromLaws = (laws = {}) => ({ onRolls: laws.shoveOnRolls !== false, own: laws.shoveOwn !== false });

// Each setting with the name of what's chosen: [["Shoves on", "Slides
// only"], ["Shoves push", "Only opponents'"]] (the corner menu's lines).
export function shoveChosen(saved) {
  const s = shoveOf(saved);
  return SHOVE_SETTINGS.map((st) => [st.name, st.options.find((o) => o.value === s[st.key]).name]);
}

// For a summary: "slides and rolls", "slides only", "slides and rolls,
// only opponents'", "slides only, only opponents'".
export function shoveSummary(saved) {
  const s = shoveOf(saved);
  return `${s.onRolls ? "slides and rolls" : "slides only"}${s.own ? "" : ", only opponents'"}`;
}

// The sentence for "Only opponents'", wherever a setting's described.
export const OWN_BLOCKS = "A shove pushes only your opponent's pieces: one of your own in the way blocks the move.";

/* What actually shoves with the rules as they're set, for the line under
   the settings (user: the Slide/Shoving link confused even the
   developer). It changes as Orthogonal slide is ticked. `laws` are the
   menu's own: slide, diagonalSlide. */
export function shoveNow(saved, laws = {}) {
  const s = shoveOf(saved);
  // (And never on a diagonal, user: said while Diagonal slide is on.)
  const diag = laws.diagonalSlide ? " Diagonal slides never shove." : "";
  const own = s.own ? "" : ` ${OWN_BLOCKS}`;
  if (!s.onRolls)
    return `Right now only slides shove.${diag} A roll into a piece is just blocked.${own} Turning Orthogonal slide off switches this back to Slides and rolls.`;
  if (!laws.slide)
    return laws.diagonalSlide
      ? `Right now only rolls shove: Orthogonal slide is off, and diagonal slides never shove.${own} Choosing Slides only turns it on.`
      : `Right now only rolls shove: Orthogonal slide is off, so there are no slides to shove with.${own} Choosing Slides only turns it on.`;
  return `Right now slides and rolls both shove.${diag}${own}`;
}
