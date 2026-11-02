/* The words for a refused move: the Piece guide's bubble beside the X
   (user, with a clip of a Cruce that wouldn't slide: "when attempting
   to make a move that's not allowed, for whatever reason, a pop-up
   should appear with an explanation ... there should be additional
   verbiage to indicate that this feature is a part of this setting";
   the pick, A1: under Piece guide, an X on the square aimed at with a
   bubble beside it, tagged with the setting's name). engine/why-not.js
   says which rule refused the move; this says it as a player reads it,
   a title and a line or two, every line through the language tables
   (i18n/es.js, i18n/vi.js). */
import { t, listOf } from "./i18n.js";
import { PIECE_META } from "../engine/constants.js";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* `mover`: the piece that tried. `sideName(owner)`: what the world calls
   a side ("Pink", "Walnut"). Returns { title, body }. */
export function whyNotWords(reason, { mover, sideName }) {
  const name = (p) => (PIECE_META[p.type] ? PIECE_META[p.type].name : p.type);
  // "your Turrito", "the Pink Cruce" (the Cabeza its own line: Spanish
  // gives it its own article).
  const who = (p) => (p.owner === mover.owner
    ? t("your {piece}", { piece: name(p) })
    : p.type === "cabeza"
      ? t("the {side} Cabeza", { side: sideName(p.owner) })
      : t("the {side} {piece}", { side: sideName(p.owner), piece: name(p) }));
  const whom = (ps) => listOf(ps.map(who));
  const me = name(mover);
  const r = reason;
  const left = r.left === 0 ? t("You have none left.") : r.left === 1 ? t("You have 1 left.") : t("You have {n} left.", { n: r.left });
  const inTheWay = (ps) => cap(t(ps.length > 1 ? "{who} are in the way" : "{who} is in the way", { who: whom(ps) }));
  switch (r.code) {
    case "cost": {
      let body;
      if (r.whole) body = r.opa ? t("An Opa move costs {cost} actions.", { cost: r.cost }) : t("Its cheapest move costs {cost} actions.", { cost: r.cost });
      else if (r.pushed && r.pushed.length) {
        body = r.kind === "slide"
          ? t("Sliding here pushes {pushed}: {cost} actions (slide {base}, push {push}).", { pushed: whom(r.pushed), cost: r.cost, base: r.base, push: r.push })
          : t("Rolling here pushes {pushed}: {cost} actions (roll {base}, push {push}).", { pushed: whom(r.pushed), cost: r.cost, base: r.base, push: r.push });
      } else if (r.kind === "slide") body = t("A slide costs {cost} actions.", { cost: r.cost });
      else if (r.opa) body = t("An Opa move costs {cost} actions.", { cost: r.cost });
      else body = t("This move costs {cost} actions.", { cost: r.cost });
      body += ` ${left}`;
      if (r.firstTurnShort) body += ` ${t("The game's first turn has one action fewer.")}`;
      return { title: t("Not enough actions"), body };
    }
    case "heavy": {
      const one = r.pushed.length === 1 && !r.line;
      const count = r.line
        ? t("With the pieces behind it, that's {mass} cubes, and your {piece} has {cubes}.", { mass: r.mass, piece: me, cubes: r.cubes })
        : !one
          ? t("Together they have {mass} cubes, and your {piece} has {cubes}.", { mass: r.mass, piece: me, cubes: r.cubes })
          : r.mass === r.cubes
            ? t("It has {mass} cubes, as many as your {piece}.", { mass: r.mass, piece: me })
            : t("It has {mass} cubes, more than your {piece}'s {cubes}.", { mass: r.mass, piece: me, cubes: r.cubes });
      const rule = one ? t("A piece can only push pieces with fewer cubes.") : t("A piece can only push pieces with fewer cubes, all together.");
      return { title: cap(t("Can't push {pushed}", { pushed: whom(r.line ? r.pushed.slice(0, 1) : r.pushed) })), body: `${count} ${rule}` };
    }
    case "own":
      return { title: inTheWay(r.blockers), body: t("In this game a push moves only the other side's pieces.") };
    case "inTheWay":
      return {
        title: inTheWay(r.blockers),
        body: r.why === "cabeza" ? t("A Cabeza only steps onto open squares.")
          : r.why === "slidesOnly" ? t("In this game only a slide pushes, never a roll.")
            : t("Pieces can't be pushed in this game."),
      };
    case "noCrushBySlide":
      return { title: t("A slide can't crush"), body: t("To crush {who}, roll a cube down onto it.", { who: whom(r.blockers) }) };
    case "diagonalPush":
      return { title: t("No pushing on a diagonal"), body: t("Pieces are only pushed straight along a row or a column.") };
    case "noRoom": {
      const title = cap(t("Can't push {pushed}", { pushed: whom(r.pushed) }));
      const blocker = r.blocker ? who(r.blocker) : "";
      const body = r.behind === "edge" ? t("It's at the edge of the board, with nowhere to go.")
        : r.behind === "missing" ? t("The square behind it is missing.")
          : r.behind === "hole" ? t("Only a Turrito or a Cabeza can be pushed into a singularity.")
            : r.behind === "holeExit" ? t("Its way out of the singularity is blocked.")
              : r.behind === "piece" && !r.line ? cap(t("{who} is behind it, and lines of pieces aren't pushed in this game.", { who: blocker }))
                : r.behind === "piece" ? cap(t("{who} is in its way.", { who: blocker }))
                  : t("It has no room to get out of the way.");
      return { title, body };
    }
    case "edge":
      return { title: t("The edge of the board"), body: r.kind === "roll" ? t("Your {piece} can't roll off the board.", { piece: me }) : t("Your {piece} can't slide off the board.", { piece: me }) };
    case "missing":
      return { title: t("No square there"), body: t("That square is missing from this board.") };
    case "holeTooBig":
      return { title: t("Too big for the singularity"), body: t("Only a piece standing on a single square can drop into a singularity.") };
    case "holeExit":
      return { title: t("The way out is blocked"), body: t("Your {piece} would come out of the singularity onto a square it can't take.", { piece: me }) };
    case "boxed": {
      // What stands in every way it could go, each named once.
      const seen = new Set();
      const causes = [];
      const add = (key, words) => { if (!seen.has(key)) { seen.add(key); causes.push(words); } };
      for (const x of r.reasons) {
        if (x.code === "edge") add("edge", t("the edge of the board"));
        else if (x.code === "missing") add("missing", t("a missing square"));
        else if (x.code === "holeTooBig" || x.code === "holeExit") add("hole", t("a singularity"));
        else if (x.code === "sweep") add("sweep", t("a piece in its way as it rolls over"));
        for (const p of [...(x.blockers || []), ...(x.pushed || [])]) add(p.id, who(p));
        if (x.blocker) add(x.blocker.id, who(x.blocker));
      }
      return {
        title: t("No move for your {piece}", { piece: me }),
        body: causes.length ? t("Every way it could go is blocked: {causes}.", { causes: listOf(causes) }) : t("Every way it could go is blocked."),
      };
    }
    default:
      return { title: t("That way is blocked"), body: t("Your {piece} can't go that way.", { piece: me }) };
  }
}
