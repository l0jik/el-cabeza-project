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
  shoving: { name: "Shoving", text: "A piece moving into one with fewer cubes pushes it along, for 1 extra point." },
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
    ["Turn", <>Spend <b>{budget} action points</b> <Dots n={budget} C={C} /> on one piece.</>],
    ["Blocks", <>Tip over an edge: north, south, east or west. <b>1 point</b> a roll.</>],
    ["Cabeza", <>Steps one square in any of 8 directions. <b>1 point</b>. It can't crush.</>],
    ["Opa", <>The big cube's move costs <b>2 points</b>, and it moves once per turn.</>],
    ["Free", <>Moving back to where you already were this turn costs nothing.</>],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "baseline" }}>
          <Label C={C}>{k}</Label>
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
          let text = LAW_TEXT[k].text;
          if (k === "shoving") text += ` Pushes ${game.laws.shoveFar ? "as far as the mover travels" : "1 square"}, on ${game.laws.shoveOnRolls ? "slides and rolls" : "slides only"}.`;
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
/* Each tile is a small looping SVG. Drawn in a 120 x 60 box: ground at
   y = 46, one square = 22 units. `ink` is the piece colour, `glow` the
   motion/arrow colour, `warn` the crush/void colour. */
function tiles(C) {
  const ink = C.accentDark || C.charcoal;
  const glow = C.accentDark || C.slate;
  const alt = C.accentLight || C.slate;
  const warn = C.accentDanger || "#c0392b";
  const soft = C.slateSoft;
  const ground = <line x1="4" y1="46.5" x2="116" y2="46.5" stroke={glow} strokeOpacity=".35" />;
  const box = (x, y, w, h, extra = {}) => <rect x={x} y={y} width={w} height={h} fill={ink} fillOpacity=".2" stroke={ink} strokeWidth="1.3" {...extra} />;
  const disc = (cx, cy, extra = {}) => <ellipse cx={cx} cy={cy} rx="9" ry="3.6" fill={C.charcoal} {...extra} />;
  const cell = (x, y, extra = {}) => <rect x={x} y={y} width="16" height="16" fill="none" stroke={glow} strokeOpacity=".3" {...extra} />;
  const grid = (cols, rows, x0, y0) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(<g key={`${r}-${c}`}>{cell(x0 + c * 16, y0 + r * 16)}</g>);
    return out;
  };
  const vb = { transformBox: "view-box" };
  return [
    {
      key: "roll", title: "Roll", cost: <Dots n={1} C={C} />, text: "A block tips over one of its bottom edges: north, south, east or west.",
      svg: <>{ground}<g className="ec-rc-roll" style={{ ...vb, transformOrigin: "46px 46px" }}>{box(24, 24, 22, 22)}</g></>,
    },
    {
      key: "flaco", title: "Tall pieces tumble", cost: <Dots n={1} C={C} />, text: "A Flaco standing up lands lying down, two squares long. Roll it again and it stands back up.",
      svg: <>{ground}<g className="ec-rc-roll" style={{ ...vb, transformOrigin: "40px 46px" }}>{box(29, 2, 11, 44)}</g></>,
    },
    {
      key: "cabeza", title: "Cabeza step", cost: <Dots n={1} C={C} />, text: "The Cabeza steps one square in any of 8 directions. It never crushes.",
      svg: (
        <>
          {grid(3, 3, 36, 6)}
          <g className="ec-rc-step" style={vb}>{disc(60, 30, { ry: 5, rx: 6 })}</g>
          <g stroke={glow} strokeWidth="1" strokeOpacity=".7">
            <path d="M60 22v-10M60 38v10M52 30h-10M68 30h10M54 24l-7-7M66 24l7-7M54 36l-7 7M66 36l7 7" />
          </g>
        </>
      ),
    },
    {
      key: "opa", title: "Opa", cost: <Dots n={2} C={C} />, text: "The big cube rolls two squares at once. Its move costs 2 points, and it moves only once per turn.",
      svg: <>{ground}<g className="ec-rc-roll" style={{ ...vb, transformOrigin: "52px 46px" }}>{box(18, 12, 34, 34)}</g></>,
    },
    {
      key: "crush", title: "Crush", cost: null, text: "Land a block on the enemy Cabeza to crush it. Crushing their last Cabeza wins.",
      svg: (
        <>
          {ground}
          <g className="ec-rc-crushdisc" style={{ ...vb, transformOrigin: "82px 46px" }}>{disc(82, 43, { fill: warn })}</g>
          <g className="ec-rc-roll" style={{ ...vb, transformOrigin: "68px 46px" }}>{box(46, 24, 22, 22)}</g>
        </>
      ),
    },
    {
      key: "win", title: "Reach the far row", cost: null, text: "Step your Cabeza onto the opponent's back row to win.",
      svg: (
        <>
          {grid(5, 2, 20, 12)}
          <rect className="ec-rc-goal" x="20" y="12" width="80" height="16" fill={alt} fillOpacity=".18" />
          <g className="ec-rc-win" style={vb}>{disc(60, 36, { rx: 6, ry: 5 })}</g>
        </>
      ),
    },
    {
      key: "free", title: "Free way back", cost: <span style={{ color: C.slate }}>free</span>, text: "Change your mind: moving back to where you already were this turn gives the points back.",
      svg: (
        <>
          {ground}
          <g className="ec-rc-rollback" style={{ ...vb, transformOrigin: "46px 46px" }}>{box(24, 24, 22, 22)}</g>
          <circle cx="92" cy="12" r="4" fill={ink} opacity=".75" />
          <circle className="ec-rc-refund" cx="103" cy="12" r="4" fill={ink} />
        </>
      ),
    },
    {
      key: "shelter", title: "Shelter", cost: null, text: "A Cabeza can shelter under an Arco or a Codo's overhang. It never stops a piece rolling over it.",
      svg: (
        <>
          {ground}
          <path d="M34 46V16h52v30H72V30H48v16Z" fill={ink} fillOpacity=".2" stroke={ink} strokeWidth="1.3" />
          <g className="ec-rc-shelter" style={vb}>{disc(60, 43)}</g>
        </>
      ),
    },
    {
      key: "slide", law: "slide", title: "Slide", cost: <Dots n={2} C={C} />, text: LAW_TEXT.slide.text,
      svg: <>{ground}<g className="ec-rc-slide" style={vb}>{box(30, 24, 22, 22)}</g></>,
    },
    {
      key: "diagonalSlide", law: "diagonalSlide", title: "Diagonal Slide", cost: <Dots n={2} C={C} />, text: "With Slide on, a slide may also go diagonally. Seen from above.",
      svg: (
        <>
          {grid(3, 3, 36, 6)}
          <g className="ec-rc-diag" style={vb}><rect x="38" y="40" width="12" height="12" fill={ink} fillOpacity=".3" stroke={ink} /></g>
        </>
      ),
    },
    {
      key: "shoving", law: "shoving", title: "Shove", cost: <Dots n={1} C={C} plus />, text: "Moving into a piece with fewer cubes pushes it along, for 1 extra point.",
      svg: (
        <>
          {ground}
          <g className="ec-rc-slide" style={vb}>{box(14, 13, 33, 33)}</g>
          <g className="ec-rc-pushed" style={vb}>{box(47, 35, 11, 11, { fill: alt, stroke: alt })}</g>
        </>
      ),
    },
    {
      key: "cantileverPivot", law: "cantileverPivot", title: "Pivot", cost: <Dots n={1} C={C} />, text: "Seen from above: a piece balanced on one cube turns a quarter turn around it.",
      svg: (
        <>
          {grid(5, 3, 20, 6)}
          <rect x="52" y="22" width="16" height="16" fill={ink} fillOpacity=".45" stroke={ink} />
          <g className="ec-rc-pivot" style={{ ...vb, transformOrigin: "60px 30px" }}>
            <rect x="68" y="22" width="16" height="16" fill={ink} fillOpacity=".2" stroke={ink} strokeDasharray="3 2" />
          </g>
          <circle cx="60" cy="30" r="2" fill={glow} />
        </>
      ),
    },
    {
      key: "blackHoleSquares", law: "blackHoleSquares", title: "Black hole", cost: null,
      text: "Seen from above: go in from one side and you come out of the other hole on that same side. Here: in from the west, out to the west. The turn ends.",
      svg: (
        <>
          {grid(6, 1, 12, 22)}
          <circle cx="36" cy="30" r="6" fill="#000" stroke={glow} strokeOpacity=".8" />
          <circle cx="84" cy="30" r="6" fill="#000" stroke={glow} strokeOpacity=".8" />
          <text x="20" y="16" fontFamily={mono} fontSize="7" fill={glow} textAnchor="middle">IN</text>
          <text x="68" y="16" fontFamily={mono} fontSize="7" fill={alt} textAnchor="middle">OUT</text>
          <path d="M13 45h14m-4-3 4 3-4 3" fill="none" stroke={glow} strokeWidth="1.2" />
          <path d="M75 45H61m4-3-4 3 4 3" fill="none" stroke={alt} strokeWidth="1.2" />
          <g className="ec-rc-bh-in" style={{ ...vb, transformOrigin: "36px 30px" }}><rect x="14" y="24" width="12" height="12" fill={ink} fillOpacity=".4" stroke={ink} /></g>
          <g className="ec-rc-bh-out" style={{ ...vb, transformOrigin: "68px 30px" }}><rect x="62" y="24" width="12" height="12" fill={alt} fillOpacity=".4" stroke={alt} /></g>
        </>
      ),
    },
    {
      key: "splitMovement", law: "splitMovement", title: "Split Movement", cost: null, text: LAW_TEXT.splitMovement.text,
      svg: (
        <>
          {ground}
          <g className="ec-rc-roll" style={{ ...vb, transformOrigin: "36px 46px" }}>{box(22, 32, 14, 14)}</g>
          <g className="ec-rc-roll2" style={{ ...vb, transformOrigin: "86px 46px" }}>{box(72, 32, 14, 14, { fill: ink, stroke: ink })}</g>
          <text x="29" y="24" fontFamily={mono} fontSize="8" fill={glow} textAnchor="middle">1</text>
          <text x="79" y="24" fontFamily={mono} fontSize="8" fill={glow} textAnchor="middle">2</text>
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
      key: "missing", title: "Missing squares", cost: null, text: "A topology option: nothing can stand on a missing square, though an overhang may reach over one.",
      svg: (
        <>
          {grid(5, 3, 20, 6)}
          <rect x="68" y="22" width="16" height="16" fill={C.cream} stroke={warn} strokeDasharray="3 2" />
          <g className="ec-rc-bump" style={vb}><rect x="38" y="24" width="12" height="12" fill={ink} fillOpacity=".4" stroke={ink} /></g>
        </>
      ),
    },
  ];
}

const KEYFRAMES = `
.ec-rc-anim .ec-rc-roll { animation: ecRcRoll 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-roll2 { animation: ecRcRoll2 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-rollback { animation: ecRcRollBack 4s ease-in-out infinite; }
.ec-rc-anim .ec-rc-refund { animation: ecRcRefund 4s ease-in-out infinite; }
.ec-rc-anim .ec-rc-step { animation: ecRcStep 4.8s ease-in-out infinite; }
.ec-rc-anim .ec-rc-crushdisc { animation: ecRcCrush 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-win { animation: ecRcWin 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-goal { animation: ecRcGoal 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-shelter { animation: ecRcShelter 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-slide { animation: ecRcSlide 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-pushed { animation: ecRcPushed 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-diag { animation: ecRcDiag 3.2s ease-in-out infinite; }
.ec-rc-anim .ec-rc-pivot { animation: ecRcPivot 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-bh-in { animation: ecRcBhIn 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-bh-out { animation: ecRcBhOut 3.6s ease-in-out infinite; }
.ec-rc-anim .ec-rc-dot0 { animation: ecRcDot 3s ease-in-out infinite; }
.ec-rc-anim .ec-rc-dot1 { animation: ecRcDot 3s ease-in-out 0.25s infinite; }
.ec-rc-anim .ec-rc-dot2 { animation: ecRcDot3 3s ease-in-out 0.5s infinite; }
.ec-rc-anim .ec-rc-bump { animation: ecRcBump 3.2s ease-in-out infinite; }
@keyframes ecRcRoll { 0%,15% { transform: rotate(0); opacity: 1 } 45%,80% { transform: rotate(90deg); opacity: 1 } 90% { transform: rotate(90deg); opacity: 0 } 91% { transform: rotate(0); opacity: 0 } 100% { transform: rotate(0); opacity: 1 } }
@keyframes ecRcRoll2 { 0%,45% { transform: rotate(0); opacity: 1 } 70%,82% { transform: rotate(90deg); opacity: 1 } 90% { transform: rotate(90deg); opacity: 0 } 91% { transform: rotate(0); opacity: 0 } 100% { transform: rotate(0); opacity: 1 } }
@keyframes ecRcRollBack { 0%,10% { transform: rotate(0) } 35%,55% { transform: rotate(90deg) } 80%,100% { transform: rotate(0) } }
@keyframes ecRcRefund { 0%,20% { opacity: .75 } 35%,60% { opacity: .15 } 80%,100% { opacity: .75 } }
@keyframes ecRcStep { 0%,8% { transform: translate(0,0) } 20%,30% { transform: translate(16px,0) } 42%,52% { transform: translate(0,0) } 64%,74% { transform: translate(-16px,-16px) } 86%,100% { transform: translate(0,0) } }
@keyframes ecRcCrush { 0%,40% { transform: scale(1,1); opacity: 1 } 46%,82% { transform: scale(1.2,.25); opacity: .7 } 90% { opacity: 0 } 100% { transform: scale(1,1); opacity: 1 } }
@keyframes ecRcWin { 0%,15% { transform: translate(0,0) } 45%,85% { transform: translate(0,-16px) } 100% { transform: translate(0,0) } }
@keyframes ecRcGoal { 0%,42% { opacity: .15 } 50%,80% { opacity: .9 } 100% { opacity: .15 } }
@keyframes ecRcShelter { 0%,10% { transform: translate(-40px,0) } 45%,80% { transform: translate(0,0) } 100% { transform: translate(-40px,0) } }
@keyframes ecRcSlide { 0%,15% { transform: translate(0,0); opacity: 1 } 45%,80% { transform: translate(22px,0); opacity: 1 } 90% { opacity: 0; transform: translate(22px,0) } 91% { transform: translate(0,0); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcPushed { 0%,15% { transform: translate(0,0); opacity: 1 } 45%,80% { transform: translate(22px,0); opacity: 1 } 90% { opacity: 0; transform: translate(22px,0) } 91% { transform: translate(0,0); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcDiag { 0%,15% { transform: translate(0,0); opacity: 1 } 45%,80% { transform: translate(16px,-16px); opacity: 1 } 90% { opacity: 0; transform: translate(16px,-16px) } 91% { transform: translate(0,0); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcPivot { 0%,15% { transform: rotate(0) } 45%,80% { transform: rotate(90deg) } 100% { transform: rotate(0) } }
@keyframes ecRcBhIn { 0%,10% { transform: translate(0,0) scale(1); opacity: 1 } 30% { transform: translate(16px,0) scale(1); opacity: 1 } 40% { transform: translate(16px,0) scale(.1); opacity: 0 } 92% { transform: translate(16px,0) scale(.1); opacity: 0 } 93% { transform: translate(0,0) scale(1); opacity: 0 } 100% { opacity: 1 } }
@keyframes ecRcBhOut { 0%,40% { transform: translate(0,0) scale(.1); opacity: 0 } 44% { opacity: 1 } 55%,85% { transform: translate(0,0) scale(1); opacity: 1 } 92%,100% { opacity: 0 } }
@keyframes ecRcDot { 0%,10% { opacity: .15 } 25%,85% { opacity: .8 } 100% { opacity: .15 } }
@keyframes ecRcDot3 { 0%,10% { opacity: .15 } 25%,85% { opacity: .95; filter: drop-shadow(0 0 3px currentColor) } 100% { opacity: .15 } }
@keyframes ecRcBump { 0%,15% { transform: translate(0,0) } 40% { transform: translate(12px,0) } 50%,80% { transform: translate(0,0) } 100% { transform: translate(0,0) } }
@media (prefers-reduced-motion: reduce) { .ec-rc-anim * { animation: none !important; } }
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
    <>Pick <b>one piece</b>. (With Split Movement, up to two.)</>,
    <>Spend your points <Dots n={budget} C={C} /> on its moves: a roll or Cabeza step is 1, a slide or any Opa move is 2, a pivot 1, a shove 1 more.</>,
    <>Changed your mind? Moving back to where you were this turn gives the points back.</>,
    <>The turn ends when the points run out, or when nothing left can use them.</>,
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
