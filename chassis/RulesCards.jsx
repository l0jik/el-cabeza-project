/* The rules cards: five ways into the rules, shown as tabs in the INFO
   overlay (see ElCabeza3D.jsx) and opened in place from wherever a rule
   matters (the Current Variants flyout, the unused-points note, the
   SINGULARITY LAWS menu, the sphere's help line) through one window event,
   so themes never import the chassis:

     window.dispatchEvent(new CustomEvent(OPEN_RULES_EVENT, { detail: { tab, focus } }))

   tab is one of RULES_TABS' keys ("about" is the chassis's own history
   page); focus names a MOVES tile (a law key or a move key) to scroll to
   and highlight. Colours come from the theme's COLORS, so the cards sit
   in Standard's paper and Neon's glass alike. The text states the rules
   exactly as the engine plays them (engine/constants.js, engine/rules.js). */
import React, { useEffect, useRef } from "react";

export const OPEN_RULES_EVENT = "el-cabeza:open-rules";
// Sent when the player asks for the original game (ABOUT's link): the
// sphere closes and Nova returns to the Standard theme.
export const PLAY_ORIGINAL_EVENT = "el-cabeza:play-original";

export function openRules(tab = "quick", focus = null) {
  window.dispatchEvent(new CustomEvent(OPEN_RULES_EVENT, { detail: { tab, focus } }));
}

export const RULES_TABS = [
  { key: "about", label: "About" },
  { key: "quick", label: "Quick" },
  { key: "costs", label: "Costs" },
  { key: "game", label: "This game" },
  { key: "moves", label: "Moves" },
  { key: "turn", label: "Your turn" },
];

// One sentence per law, shared by "This game" and the MOVES tiles.
export const LAW_TEXT = {
  splitMovement: { name: "Split Movement", text: "Your points can be shared between up to two pieces in one turn." },
  slide: { name: "Slide", text: "Any piece can move one open square north, south, east or west without tipping. A slide costs 2 points." },
  diagonalSlide: { name: "Diagonal Slide", text: "Slides can also go diagonally." },
  blackHoleSquares: { name: "Black Hole Squares", text: "Two linked holes. A piece standing on one square that enters one hole comes out of the other on the same side it went in, and the turn ends." },
  cantileverPivot: { name: "Cantilever Pivot", text: "A Codo, Rayo or Zeta balanced on one cube can turn a quarter turn around it, for 1 point." },
  threeActions: { name: "3 Actions Per Turn", text: "Each turn has 3 action points instead of 2." },
  shoving: { name: "Shoving", text: "A piece rolling or sliding into pieces with fewer cubes than it, all together, pushes them along, for 1 extra point. A slide pushes them one square; a roll pushes them just past where it lands. Nothing may be behind them." },
};

const mono = "'IBM Plex Mono', monospace";
const sans = "'IBM Plex Sans', sans-serif";

function Dots({ n, C, plus = false }) {
  const fill = C.accentDark || C.charcoal;
  return (
    <span style={{ display: "inline-flex", gap: 4, verticalAlign: "-1px" }}>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          style={{
            width: 9, height: 9, borderRadius: "50%", boxSizing: "border-box",
            background: plus ? "transparent" : fill,
            border: plus ? `1.25px dashed ${C.accentLight || C.slate}` : "none",
            boxShadow: !plus && C.accentDark ? `0 0 5px ${C.accentDark}` : "none",
            opacity: plus ? 0.9 : 0.75,
          }}
        />
      ))}
    </span>
  );
}

const Label = ({ children, C }) => (
  <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.accentDark || C.slate }}>{children}</span>
);

/* ---------------------------------------------------------------- A */
function QuickCard({ C, budget }) {
  const rows = [
    ["Win", <>Get your <b>Cabeza</b> to the far row, or crush the enemy Cabeza by landing a block on it.</>],
    ["Must", <><b>Move at least 1 piece, 1 time.</b> Skipping your turn is not allowed.</>],
    ["Turn", <>Spend up to <b>{budget} action points</b> <Dots n={budget} C={C} /> on one piece. You can stop after one move: tap the piece again, or press Stop here.</>],
    ["Blocks", <>Every piece but the Cabeza. Tip over an edge: north, south, east or west. <b>1 point</b> a roll.</>],
    // The Opa is a block with its own cost, so it sits indented under Blocks.
    ["Opa", <>The big cube's move costs <b>2 points</b>, and it moves once per turn.</>, true],
    ["Cabeza", <>Steps one square in any of 8 directions. <b>1 point</b>. It can't crush.</>],
    ["Free", <>Moving back to where you already were this turn costs nothing.</>],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map(([k, v, sub]) => (
        <div key={k} data-testid={`rules-quick-${k.toLowerCase()}`} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "baseline", marginTop: sub ? -4 : 0 }}>
          <span style={{ paddingLeft: sub ? 12 : 0, whiteSpace: "nowrap" }}>
            {sub && <span style={{ color: C.slate, marginRight: 4 }}>└</span>}
            <Label C={C}>{k}</Label>
          </span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- B */
function CostsCard({ C }) {
  const rows = [
    ["Roll a block", "Tip it over one edge", <Dots n={1} C={C} />],
    ["Cabeza step", "Any of 8 directions", <Dots n={1} C={C} />],
    ["Opa move", "Roll or slide; once per turn", <Dots n={2} C={C} />],
    ["Slide", "One square, no tipping", <Dots n={2} C={C} />, true],
    ["Pivot", "Codo, Rayo or Zeta on one cube", <Dots n={1} C={C} />, true],
    ["Shove", "Added to the move that pushes", <Dots n={1} C={C} plus />, true],
    ["Back to an earlier spot", "This turn only", <span style={{ color: C.slate }}>free</span>],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${C.slateSoft}`, background: C.slateFaint, padding: "8px 10px" }}>
        <span>Points per turn</span>
        <span>2 <span style={{ color: C.slate }}>· 3 with 3 Actions</span></span>
      </div>
      <div>
        {rows.map(([name, sub, cost, law]) => (
          <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.slateSoft}` }}>
            <div>
              <div>
                {name}
                {law && <span style={{ marginLeft: 7, fontFamily: mono, fontSize: 8.5, letterSpacing: "0.14em", color: C.accentLight || C.slate, border: `1px solid ${C.slateSoft}`, padding: "1px 4px", verticalAlign: 1 }}>LAW</span>}
              </div>
              <div style={{ fontSize: 11.5, color: C.slate }}>{sub}</div>
            </div>
            <div style={{ flexShrink: 0 }}>{cost}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.slate, textAlign: "center" }}>
        Anything costing 3 needs 3 Actions · points don't carry over
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- C */
function GameCard({ C, game, onFocus }) {
  const on = Object.keys(LAW_TEXT).filter((k) => game.laws[k]);
  const extras = [];
  if (game.rows !== 10 || game.cols !== 10) extras.push(`${game.rows} × ${game.cols} board`);
  if (game.missing) extras.push(`${game.missing} missing squares`);
  if (game.newTypes.length) extras.push(...game.newTypes);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {on.length === 0 ? (
        <div style={{ color: C.slate }}>No laws are on: this game plays the standard rules.</div>
      ) : (
        on.map((k) => {
          const text = LAW_TEXT[k].text;
          return (
            <button
              key={k}
              type="button"
              data-testid={`rules-game-law-${k}`}
              onClick={() => onFocus(k)}
              style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "8px 1fr", gap: 10 }}
            >
              <span style={{ width: 8, height: 8, marginTop: 6, background: C.accentDark || C.charcoal }} />
              <span>
                <span style={{ display: "block", fontWeight: 600 }}>{LAW_TEXT[k].name}</span>
                <span style={{ display: "block", fontSize: 13 }}>{text}</span>
              </span>
            </button>
          );
        })
      )}
      <div style={{ fontSize: 12.5, color: C.slate, borderTop: `1px solid ${C.slateSoft}`, paddingTop: 10 }}>
        Always true: win by reaching the far row or crushing the enemy Cabeza. Rolls and Cabeza steps cost 1, an Opa move 2.
      </div>
      {extras.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {extras.map((x) => (
            <span key={x} style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${C.slateSoft}`, borderRadius: 999, padding: "4px 8px" }}>{x}</span>
          ))}
        </div>
      )}
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.slate, textAlign: "center" }}>Tap a law to see it move</div>
    </div>
  );
}

/* ---------------------------------------------------------------- D */
/* Each tile is a small looping SVG, seen from directly above the board
   so the move reads as squares crossed: a 120 x 60 box holding a grid of
   16-unit squares. A roll shows a quick flip (the piece narrows as it
   tips over the edge between squares); a slide glides flat. `ink` is the
   piece colour (every piece shown is the same side's), `glow` the
   grid/arrow colour, `alt` the goal-row highlight,
   `warn` the crush/void colour. */
const SQ = 16;
const X0 = 12, Y0 = 6; // top-left of the 6 x 3 grid
const cx = (c) => X0 + c * SQ;
const cy = (r) => Y0 + r * SQ;
function tiles(C) {
  const ink = C.accentDark || C.charcoal;
  const glow = C.accentDark || C.slate;
  const alt = C.accentLight || C.slate;
  const warn = C.accentDanger || "#c0392b";
  const grid = (cols = 6, rows = 3, x0 = X0, y0 = Y0) => {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push(<rect key={`${r}-${c}`} x={x0 + c * SQ} y={y0 + r * SQ} width={SQ} height={SQ} fill="none" stroke={glow} strokeOpacity=".28" />);
    return out;
  };
  // A piece covering w x h squares from square (c, r), inset 2 units.
  const piece = (c, r, w = 1, h = 1, colour = ink, extra = {}) => (
    <rect x={cx(c) + 2} y={cy(r) + 2} width={w * SQ - 4} height={h * SQ - 4} fill={colour} fillOpacity=".35" stroke={colour} strokeWidth="1.2" {...extra} />
  );
  const ghost = (c, r, w = 1, h = 1) => (
    <rect x={cx(c) + 2} y={cy(r) + 2} width={w * SQ - 4} height={h * SQ - 4} fill="none" stroke={glow} strokeOpacity=".45" strokeDasharray="2 2" />
  );
  const disc = (c, r, colour = C.charcoal) => <circle cx={cx(c) + 8} cy={cy(r) + 8} r="5" fill={colour} />;
  const fb = { transformBox: "fill-box", transformOrigin: "center" };
  const fbLeft = { transformBox: "fill-box", transformOrigin: "left center" };
  const vb = { transformBox: "view-box" };
  // Two-panel tiles: seen from ABOVE on the left (a 12-unit grid), from the
  // SIDE on the right (ground at y = 48, 12-unit cubes, looking north).
  const MS = 12, MX = 4, MY = 12;
  const miniGrid = (cols = 4, rows = 3) => {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push(<rect key={`m${r}-${c}`} x={MX + c * MS} y={MY + r * MS} width={MS} height={MS} fill="none" stroke={glow} strokeOpacity=".28" />);
    return out;
  };
  const mini = (c, r, w = 1, h = 1, extra = {}) => (
    <rect x={MX + c * MS + 1.5} y={MY + r * MS + 1.5} width={w * MS - 3} height={h * MS - 3} fill={ink} fillOpacity=".35" stroke={ink} strokeWidth="1.1" {...extra} />
  );
  const panels = (
    <>
      <text x="28" y="7" fontFamily={mono} fontSize="5.5" letterSpacing=".6" fill={glow} fillOpacity=".75" textAnchor="middle">ABOVE</text>
      <text x="90" y="7" fontFamily={mono} fontSize="5.5" letterSpacing=".6" fill={glow} fillOpacity=".75" textAnchor="middle">SIDE</text>
      <line x1="59" y1="10" x2="59" y2="52" stroke={glow} strokeOpacity=".2" />
      <line x1="64" y1="48.5" x2="116" y2="48.5" stroke={glow} strokeOpacity=".4" />
    </>
  );
  const cube = (x, y, extra = {}) => <rect x={x} y={y} width={MS} height={MS} fill={ink} fillOpacity=".3" stroke={ink} strokeWidth="1.1" {...extra} />;
  return [
    {
      key: "roll", title: "Roll", cost: <Dots n={1} C={C} />, text: "A block tips over one edge into the next square: north, south, east or west.",
      svg: <>{grid()}{ghost(3, 1)}<g className="ec-rc-rollT" style={fb}>{piece(2, 1)}</g></>,
    },
    {
      key: "flaco", title: "Tall pieces tumble", cost: <Dots n={1} C={C} />, text: "A standing Flaco tips over and lands lying down across the next two squares. Roll it on and it stands back up.",
      svg: (
        <>
          {panels}
          {miniGrid()}
          <rect x={MX + MS + 1.5} y={MY + MS + 1.5} width={2 * MS - 3} height={MS - 3} fill="none" stroke={glow} strokeOpacity=".45" strokeDasharray="2 2" />
          <g className="ec-rc-tumbleM" style={fbLeft}>{mini(0, 1, 1, 1, { strokeWidth: 2 })}</g>
          <g className="ec-rc-rotate" style={{ ...vb, transformOrigin: "82px 48px" }}>{cube(70, 24)}{cube(70, 36)}</g>
        </>
      ),
    },
    {
      key: "cabeza", title: "Cabeza step", cost: <Dots n={1} C={C} />, text: "The Cabeza steps one square in any of 8 directions. It never crushes.",
      svg: (
        <>
          {grid(3, 3, 36, 6)}
          <g stroke={glow} strokeWidth="1" strokeOpacity=".6">
            <path d="M60 22v-10M60 38v10M52 30h-10M68 30h10M54 24l-7-7M66 24l7-7M54 36l-7 7M66 36l7 7" />
          </g>
          <g className="ec-rc-step" style={vb}><circle cx="60" cy="30" r="5" fill={C.charcoal} /></g>
        </>
      ),
    },
    {
      key: "opa", title: "Opa", cost: <Dots n={2} C={C} />, text: "The big cube covers four squares and rolls two squares at once. Its move costs 2 points, and it moves only once per turn.",
      svg: <>{grid()}{ghost(3, 0, 2, 2)}<g className="ec-rc-opaT" style={fb}>{piece(1, 0, 2, 2)}</g></>,
    },
    {
      key: "crush", title: "Crush", cost: null, text: "Roll a block onto the enemy Cabeza's square to crush it. Crushing their last Cabeza wins.",
      svg: (
        <>
          {grid()}
          <g className="ec-rc-crushdisc" style={fb}>{disc(3, 1, warn)}</g>
          <g className="ec-rc-rollT" style={fb}>{piece(2, 1)}</g>
        </>
      ),
    },
    {
      key: "win", title: "Reach the far row", cost: null, text: "Step your Cabeza onto the opponent's back row to win.",
      svg: (
        <>
          {grid(5, 3, 20, 6)}
          <rect className="ec-rc-goal" x="20" y="6" width="80" height="16" fill={alt} fillOpacity=".25" />
          <g className="ec-rc-win" style={vb}><circle cx="60" cy="30" r="5" fill={C.charcoal} /></g>
        </>
      ),
    },
    {
      key: "free", title: "Free way back", cost: <span style={{ color: C.slate }}>free</span>, text: "Change your mind: moving back to where you already were this turn gives the points back.",
      svg: (
        <>
          {grid()}
          <g className="ec-rc-rollback" style={fb}>{piece(1, 1)}</g>
          <circle cx="86" cy="14" r="3.5" fill={ink} opacity=".75" />
          <circle className="ec-rc-refund" cx="96" cy="14" r="3.5" fill={ink} />
        </>
      ),
    },
    {
      key: "shelter", title: "Shelter", cost: null, text: "A Cabeza can shelter under a Codo's overhang or in an Arco's opening. It never stops a piece rolling over it.",
      svg: (
        <>
          {panels}
          {miniGrid()}
          <g className="ec-rc-shelterM" style={fb}><circle cx={MX + MS + 6} cy={MY + MS + 6} r="3.5" fill={C.charcoal} /></g>
          {mini(0, 1, 1, 1)}
          {mini(1, 1, 1, 1, { fillOpacity: ".12", strokeDasharray: "2 1.5" })}
          <g className="ec-rc-shelterM" style={fb}><ellipse cx="88" cy="45.5" rx="5" ry="2.5" fill={C.charcoal} /></g>
          {cube(70, 36)}{cube(70, 24)}{cube(82, 24)}
        </>
      ),
    },
    {
      key: "slide", law: "slide", title: "Slide", cost: <Dots n={2} C={C} />, text: "Any piece glides one square north, south, east or west without tipping, so a lying Flaco stays lying down (a roll would stand it up). Costs 2 points.",
      svg: (
        <>
          {grid()}
          {ghost(2, 1, 2, 1)}
          <g className="ec-rc-slideT" style={fb}>{piece(1, 1, 2, 1)}</g>
        </>
      ),
    },
    {
      key: "diagonalSlide", law: "diagonalSlide", title: "Diagonal Slide", cost: <Dots n={2} C={C} />, text: "With Slide on, a slide may also go diagonally.",
      svg: (
        <>
          {grid(3, 3, 36, 6)}
          <g className="ec-rc-diag" style={vb}><rect x="38" y="40" width="12" height="12" fill={ink} fillOpacity=".35" stroke={ink} strokeWidth="1.2" /></g>
        </>
      ),
    },
    {
      key: "shoving", law: "shoving", title: "Shove", cost: <Dots n={1} C={C} plus />, text: "Rolling or sliding into pieces with fewer cubes, all together, pushes them along, for 1 extra point: a slide one square, a roll just past where it lands. Anything behind them blocks.",
      svg: (
        <>
          {grid()}
          <g className="ec-rc-slideT" style={fb}>{piece(0, 0, 2, 2)}</g>
          <g className="ec-rc-slideT" style={fb}>{piece(2, 1)}</g>
        </>
      ),
    },
    {
      key: "cantileverPivot", law: "cantileverPivot", title: "Pivot", cost: <Dots n={1} C={C} />, text: "A Codo, Rayo or Zeta balanced on one cube turns a quarter turn around it. Its arm is held up, so it swings right over a Cabeza.",
      svg: (
        <>
          {panels}
          {miniGrid()}
          <circle cx={MX + 2 * MS + 6} cy={MY + MS + 6} r="3.5" fill={C.charcoal} />
          {mini(1, 1, 1, 1, { fillOpacity: ".5" })}
          <g className="ec-rc-pivot" style={{ ...vb, transformOrigin: `${MX + MS + 6}px ${MY + MS + 6}px` }}>
            {mini(1, 0, 1, 1, { fillOpacity: ".18", strokeDasharray: "2 1.5" })}
          </g>
          <circle cx={MX + MS + 6} cy={MY + MS + 6} r="1.4" fill={glow} />
          <ellipse cx="88" cy="45.5" rx="5" ry="2.5" fill={C.charcoal} />
          {cube(70, 36)}{cube(70, 24)}
          <g className="ec-rc-armGrow" style={fbLeft}>{cube(82, 24)}</g>
        </>
      ),
    },
    {
      key: "blackHoleSquares", law: "blackHoleSquares", title: "Black hole", cost: null,
      text: "Only a piece standing on one square can enter: a Cabeza, a Turrito, or an upright Flaco or 1×3. It comes out of the other hole on the same side it went in (here: in from the west, out to the west), and the turn ends.",
      svg: (
        <>
          {grid(6, 1, 12, 22)}
          <circle cx="36" cy="30" r="6" fill="#000" stroke={glow} strokeOpacity=".8" />
          <circle cx="84" cy="30" r="6" fill="#000" stroke={glow} strokeOpacity=".8" />
          <text x="20" y="16" fontFamily={mono} fontSize="7" fill={glow} textAnchor="middle">IN</text>
          <text x="68" y="16" fontFamily={mono} fontSize="7" fill={glow} textAnchor="middle">OUT</text>
          <path d="M13 45h14m-4-3 4 3-4 3" fill="none" stroke={glow} strokeWidth="1.2" />
          <path d="M75 45H61m4-3-4 3 4 3" fill="none" stroke={glow} strokeWidth="1.2" />
          <g className="ec-rc-bh-in" style={{ ...vb, transformOrigin: "36px 30px" }}><rect x="14" y="24" width="12" height="12" fill={ink} fillOpacity=".4" stroke={ink} /></g>
          <g className="ec-rc-bh-out" style={{ ...vb, transformOrigin: "68px 30px" }}><rect x="62" y="24" width="12" height="12" fill={ink} fillOpacity=".4" stroke={ink} /></g>
        </>
      ),
    },
    {
      key: "splitMovement", law: "splitMovement", title: "Split Movement", cost: null, text: "Your points can be shared between up to two pieces. Here a Turrito rolls for 1 point, then a lying Flaco rolls over its long side, one square, for the other.",
      svg: (
        <>
          {grid()}
          <text x="7" y={cy(0) + 11} fontFamily={mono} fontSize="7" fill={glow} textAnchor="middle">1</text>
          <text x="7" y={cy(1) + 11} fontFamily={mono} fontSize="7" fill={glow} textAnchor="middle">2</text>
          <g className="ec-rc-rollT" style={fb}>{piece(1, 0)}</g>
          <g className="ec-rc-rollS2" style={fb}>{piece(3, 1, 2, 1)}</g>
        </>
      ),
    },
    {
      key: "threeActions", law: "threeActions", title: "3 Actions", cost: <Dots n={3} C={C} />, text: LAW_TEXT.threeActions.text + " A slide plus a roll now fits in one turn.",
      svg: (
        <>
          {[40, 60, 80].map((x, i) => (
            <circle key={x} className={`ec-rc-dot${i}`} cx={x} cy="30" r="7" fill={ink} />
          ))}
        </>
      ),
    },
    {
      key: "missing", title: "Missing squares", cost: null, text: "A topology option: nothing can stand on a missing square, though an overhang may reach over one. A piece can't move onto it.",
      svg: (
        <>
          {grid(5, 3, 20, 6)}
          <rect x="68" y="22" width="16" height="16" fill={C.cream} stroke={warn} strokeOpacity=".6" strokeDasharray="3 2" />
          <g className="ec-rc-approach" style={fb}><rect x="38" y="24" width="12" height="12" fill={ink} fillOpacity=".4" stroke={ink} strokeWidth="1.2" /></g>
          <g className="ec-rc-xflash" stroke={warn} strokeWidth="2" strokeLinecap="round"><path d="M71 25l10 10M81 25l-10 10" /></g>
        </>
      ),
    },
  ];
}

const KEYFRAMES = `
.ec-rc-anim .ec-rc-rollT { animation: ecRcRollT 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-roll2T { animation: ecRcRoll2T 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-opaT { animation: ecRcOpaT 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-tumbleM { animation: ecRcTumbleM 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-rotate { animation: ecRcRotate 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-shelterM { animation: ecRcShelterM 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-armGrow { animation: ecRcArmGrow 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-rollS2 { animation: ecRcRollS2 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-approach { animation: ecRcApproach 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-xflash { animation: ecRcX 3.6s linear infinite; }
.ec-rc-anim .ec-rc-rollback { animation: ecRcRollBack 4s ease-in-out infinite; }
.ec-rc-anim .ec-rc-refund { animation: ecRcRefund 4s ease-in-out infinite; }
.ec-rc-anim .ec-rc-step { animation: ecRcStep 4.8s ease-in-out infinite; }
.ec-rc-anim .ec-rc-crushdisc { animation: ecRcCrush 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-win { animation: ecRcWin 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-goal { animation: ecRcGoal 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-slideT { animation: ecRcSlideT 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-diag { animation: ecRcDiag 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-pivot { animation: ecRcPivot 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-bh-in { animation: ecRcBhIn 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-bh-out { animation: ecRcBhOut 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-dot0 { animation: ecRcDot 3s ease-in-out infinite; }
.ec-rc-anim .ec-rc-dot1 { animation: ecRcDot 3s ease-in-out 0.25s infinite; }
.ec-rc-anim .ec-rc-dot2 { animation: ecRcDot 3s ease-in-out 0.5s infinite; }
@keyframes ecRcRollT { 0%,15% { transform: translate(0,0) scaleX(1); opacity: 1 } 30% { transform: translate(8px,0) scaleX(.3) } 45%,80% { transform: translate(16px,0) scaleX(1); opacity: 1 } 90% { transform: translate(16px,0); opacity: 0 } 91% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcRoll2T { 0%,45% { transform: translate(0,0) scaleX(1); opacity: 1 } 58% { transform: translate(8px,0) scaleX(.3) } 70%,82% { transform: translate(16px,0) scaleX(1); opacity: 1 } 90% { transform: translate(16px,0); opacity: 0 } 91% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcOpaT { 0%,15% { transform: translate(0,0) scaleX(1); opacity: 1 } 30% { transform: translate(16px,0) scaleX(.3) } 45%,80% { transform: translate(32px,0) scaleX(1); opacity: 1 } 90% { transform: translate(32px,0); opacity: 0 } 91% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcRollBack { 0%,10% { transform: translate(0,0) scaleX(1) } 22% { transform: translate(8px,0) scaleX(.3) } 35%,55% { transform: translate(16px,0) scaleX(1) } 67% { transform: translate(8px,0) scaleX(.3) } 80%,100% { transform: translate(0,0) scaleX(1) } }
@keyframes ecRcRefund { 0%,20% { opacity: .75 } 35%,60% { opacity: .15 } 80%,100% { opacity: .75 } }
@keyframes ecRcStep { 0%,8% { transform: translate(0,0) } 20%,30% { transform: translate(16px,0) } 42%,52% { transform: translate(0,0) } 64%,74% { transform: translate(-16px,-16px) } 86%,100% { transform: translate(0,0) } }
@keyframes ecRcCrush { 0%,38% { transform: scale(1); opacity: 1 } 46%,82% { transform: scale(.35); opacity: .35 } 90% { opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes ecRcWin { 0%,15% { transform: translate(0,0) } 45%,85% { transform: translate(0,-16px) } 100% { transform: translate(0,0) } }
@keyframes ecRcGoal { 0%,42% { opacity: .15 } 50%,80% { opacity: .9 } 100% { opacity: .15 } }
@keyframes ecRcSlideT { 0%,15% { transform: translate(0,0); opacity: 1 } 45%,80% { transform: translate(16px,0); opacity: 1 } 90% { transform: translate(16px,0); opacity: 0 } 91% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcDiag { 0%,15% { transform: translate(0,0); opacity: 1 } 45%,80% { transform: translate(16px,-16px); opacity: 1 } 90% { opacity: 0; transform: translate(16px,-16px) } 91% { transform: translate(0,0); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcPivot { 0%,15% { transform: rotate(0) } 45%,80% { transform: rotate(90deg) } 100% { transform: rotate(0) } }
@keyframes ecRcBhIn { 0%,10% { transform: translate(0,0) scale(1); opacity: 1 } 30% { transform: translate(16px,0) scale(1); opacity: 1 } 40% { transform: translate(16px,0) scale(.1); opacity: 0 } 92% { transform: translate(16px,0) scale(.1); opacity: 0 } 93% { transform: translate(0,0) scale(1); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcBhOut { 0%,40% { transform: translate(0,0) scale(.1); opacity: 0 } 44% { opacity: 1 } 55%,85% { transform: translate(0,0) scale(1); opacity: 1 } 92%,100% { opacity: 0 } }
@keyframes ecRcDot { 0%,10% { opacity: .15 } 25%,85% { opacity: .85 } 100% { opacity: .15 } }
@keyframes ecRcTumbleM { 0%,15% { transform: translate(0,0) scaleX(1); opacity: 1 } 30% { transform: translate(9px,0) scaleX(.35) } 45%,80% { transform: translate(12px,0) scaleX(2.333); opacity: 1 } 90% { transform: translate(12px,0) scaleX(2.333); opacity: 0 } 91% { transform: translate(0,0) scaleX(1); opacity: 0 } 100% { transform: translate(0,0) scaleX(1); opacity: 1 } }
@keyframes ecRcRotate { 0%,15% { transform: rotate(0); opacity: 1 } 45%,80% { transform: rotate(90deg); opacity: 1 } 90% { transform: rotate(90deg); opacity: 0 } 91% { transform: rotate(0); opacity: 0 } 100% { transform: rotate(0); opacity: 1 } }
@keyframes ecRcShelterM { 0%,10% { transform: translate(12px,0) } 45%,80% { transform: translate(0,0) } 100% { transform: translate(12px,0) } }
@keyframes ecRcArmGrow { 0%,15% { transform: scaleX(0) } 45%,80% { transform: scaleX(1) } 100% { transform: scaleX(0) } }
@keyframes ecRcRollS2 { 0%,45% { transform: translate(0,0) scaleY(1); opacity: 1 } 58% { transform: translate(0,8px) scaleY(.3) } 70%,82% { transform: translate(0,16px) scaleY(1); opacity: 1 } 90% { transform: translate(0,16px); opacity: 0 } 91% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcApproach { 0%,12% { transform: translate(0,0) scaleX(1); opacity: 1 } 26% { transform: translate(8px,0) scaleX(.3) } 38% { transform: translate(16px,0) scaleX(1) } 46% { transform: translate(22px,0) } 54%,84% { transform: translate(16px,0); opacity: 1 } 92% { transform: translate(16px,0); opacity: 0 } 93% { transform: translate(0,0); opacity: 0 } 100% { transform: translate(0,0); opacity: 1 } }
@keyframes ecRcX { 0%,45% { opacity: 0 } 46%,51% { opacity: 1 } 52%,56% { opacity: 0 } 57%,62% { opacity: 1 } 63%,100% { opacity: 0 } }
/* Reduced motion: the calm version, the same moves at half speed (every
   tile's parts share one duration, so they stay in step). */
@media (prefers-reduced-motion: reduce) { .ec-rc-anim * { animation-duration: 7.2s !important; } }
`;

function MovesCard({ C, focus }) {
  const refs = useRef({});
  useEffect(() => {
    const el = focus && refs.current[focus];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);
  const list = tiles(C);
  return (
    <div className="ec-rc-anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
      <style>{KEYFRAMES}</style>
      <div style={{ gridColumn: "1 / -1", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.slate, textAlign: "center" }}>
        Seen from above · a roll flips over the edge, a slide glides
      </div>
      {list.map((t) => {
        const hot = focus && (focus === t.key || focus === t.law);
        return (
          <div
            key={t.key}
            ref={(el) => { refs.current[t.key] = el; }}
            data-testid={`rules-tile-${t.key}`}
            data-focus={hot ? "true" : "false"}
            style={{
              border: `1px solid ${hot ? (C.accentDark || C.charcoal) : C.slateSoft}`,
              boxShadow: hot && C.accentDark ? `0 0 12px ${C.slateSoft}` : "none",
              background: C.slateFaint,
              padding: 10,
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <svg viewBox="0 0 120 60" style={{ width: "100%", height: 64, display: "block", overflow: "visible" }} aria-hidden="true">{t.svg}</svg>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
                {t.title}
                {t.law && <span style={{ marginLeft: 6, fontSize: 8.5, letterSpacing: "0.14em", color: C.accentLight || C.slate }}>LAW</span>}
              </span>
              {t.cost}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: C.charcoal, opacity: 0.72 }}>{t.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- E */
function TurnCard({ C, budget }) {
  const steps = [
    <><b>You must move at least 1 piece, 1 time.</b> Skipping your turn is not allowed.</>,
    <>Pick <b>one piece</b>. (With Split Movement, up to two.)</>,
    <>Spend your points <Dots n={budget} C={C} /> on its moves: a roll or Cabeza step is 1, a slide or any Opa move is 2, a pivot 1, a shove 1 more.</>,
    <>Changed your mind? Moving back to where you were this turn gives the points back.</>,
    <>The turn ends when the points run out, when nothing left can use them, or when you stop early after your first move: tap the piece again, or press Stop here.</>,
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.slateSoft}`, fontFamily: mono, fontSize: 11, lineHeight: "22px", textAlign: "center", color: C.accentDark || C.charcoal }}>{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div style={{ fontSize: 13, borderLeft: `2px solid ${C.accentLight || C.slate}`, padding: "8px 10px", background: C.slateFaint }}>
        <b style={{ color: C.accentLight || C.charcoal }}>Example:</b> with 3 Actions, an Opa roll spends 2. The last point goes unused, because an Opa moves only once per turn. (With Split Movement, another piece could use it.)
      </div>
    </div>
  );
}

/* The tab row plus the chosen card. `game` describes the game in play
   (laws, board size, missing squares, new piece types) for "This game". */
export function RulesTabs({ tab, onTab, C }) {
  return (
    <div role="tablist" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 14px", margin: "0 0 20px" }}>
      {RULES_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          data-testid={`rules-tab-${t.key}`}
          onClick={() => onTab(t.key)}
          style={{
            all: "unset", cursor: "pointer",
            fontFamily: mono, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "4px 0",
            color: tab === t.key ? C.charcoal : C.slate,
            borderBottom: `1px solid ${tab === t.key ? (C.accentDark || C.charcoal) : "transparent"}`,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function RulesCard({ tab, focus, onFocus, C, budget, game }) {
  return (
    <div data-testid={`rules-card-${tab}`} style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.55, color: C.charcoal }}>
      {tab === "quick" && <QuickCard C={C} budget={budget} />}
      {tab === "costs" && <CostsCard C={C} />}
      {tab === "game" && <GameCard C={C} game={game} onFocus={onFocus} />}
      {tab === "moves" && <MovesCard C={C} focus={focus} />}
      {tab === "turn" && <TurnCard C={C} budget={budget} />}
    </div>
  );
}

/* The piece card (ElCabeza3D.jsx, data-testid piece-card): what the
   selected piece is, how it moves and what that costs, in this game's
   rules. `piece` is a live piece ({ type, w, h, z }); `laws` is
   ACTIVE_LAWS. Returns { name, text, tile }, tile being the MOVES tile
   its "More" link opens. */
const CRUSH = "Land on the enemy Cabeza to crush it.";
const CUBE_CRUSH = "It crushes only with a cube that comes down on the Cabeza.";
const PIECE_TEXT = {
  cabeza: ["Steps one square in any of 8 directions, 1 point a step. It never crushes. Reach the far row to win.", "cabeza"],
  turrito: ["Rolls one square north, south, east or west, 1 point a roll. " + CRUSH, "roll"],
  opa: ["The big cube rolls two squares at once. Its move costs 2 points, once per turn. " + CRUSH, "opa"],
  chato: ["Rolls over one edge into the next squares, 1 point a roll. " + CRUSH, "roll"],
  block1x3: ["Rolls over one edge, 1 point a roll. Standing on one square, it can enter a black hole. " + CRUSH, "roll"],
  block2x3: ["Rolls over one edge, 1 point a roll. " + CRUSH, "roll"],
  codo: ["Three cubes in an L. Rolls for 1 point; its overhang can shelter a Cabeza. " + CUBE_CRUSH, "shelter"],
  arcoChico: ["An arch. Rolls for 1 point; a Cabeza in its opening is sheltered. " + CUBE_CRUSH, "shelter"],
  arcoAlto: ["A tall arch. Rolls for 1 point; a Cabeza in its opening is sheltered. " + CUBE_CRUSH, "shelter"],
  arcoAncho: ["A wide arch. Rolls for 1 point; a Cabeza in its opening is sheltered. " + CUBE_CRUSH, "shelter"],
  rayo: ["Four cubes in an S. Rolls for 1 point. " + CUBE_CRUSH, "roll"],
  zeta: ["Five cubes in a Z. Rolls for 1 point. " + CUBE_CRUSH, "roll"],
};
const PIVOTERS = ["codo", "rayo", "zeta"];

export function pieceCardInfo(piece, laws = {}, name = piece.type) {
  let [text, tile] = PIECE_TEXT[piece.type] || ["Rolls over one edge, 1 point a roll. " + CRUSH, "roll"];
  if (piece.type === "flaco") {
    const standing = piece.z > 1;
    text = standing
      ? "Standing, it tips over and lands lying across the next two squares, 1 point. " + CRUSH
      : "Lying down, it rolls one square, 1 point; rolled along its length it stands back up. " + CRUSH;
    tile = "flaco";
  }
  const extra = [];
  if (laws.slide && piece.type !== "cabeza") {
    extra.push(piece.type === "opa"
      ? `It can also slide one square${laws.diagonalSlide ? ", diagonals too" : ""}, still 2 points.`
      : `Or slide one square without tipping${laws.diagonalSlide ? ", diagonals too" : ""}, 2 points.`);
  }
  if (laws.cantileverPivot && PIVOTERS.includes(piece.type)) extra.push("Or pivot a quarter turn on one cube, 1 point.");
  if (laws.shoving && piece.type !== "cabeza") {
    extra.push("Rolling or sliding into lighter pieces (fewer cubes, all together) shoves them along, 1 point more.");
  }
  return { name, text: [text, ...extra].join(" "), tile };
}
