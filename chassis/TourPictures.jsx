import React from "react";
import { FAN_ICON } from "./fan-icons.js";

/* The first game's tour in pictures, no reading (user, 2026-11-22:
   "Create a version of the instructions that has no reading, just shows
   pictures"). For each card of the tour (chassis/FirstGameTour.jsx), one
   picture that says what its words say: drawn as the board shows it, a
   dark ground with the board's squares and the pieces in their own woods
   (yours ringed yellow, the other side's red, the row you win on green),
   and the same pills the tour sets on the board (a person for you, a
   computer for the other side, a pointing hand for "tap it"), which
   TourMarks shows in place of its words while the pictures are on (TagIcons
   below). Moving where it says how something moves (a block tipping over
   its edge, a crush, a tap, a pinch), still with reduced motion: the
   arrows and the landing say it then. Only digits besides: "1" and "2",
   the two ways to win, as the board's tags number them.

   Every picture is drawn on one 320 x 140 ground (W, H), from a few
   parts: a board seen from above (Grid, TopPiece), a block or a disc seen
   from the side (SideBlock, SideDisc) on a strip of squares (SideGround),
   a block seen from a corner (IsoPiece), arrows (Arrow), the pills (Pill),
   a hand (Hand), and icons on a 24-unit square (ICON: these, and the fan
   menu's own, chassis/fan-icons.js, so what the menu shows is drawn the
   same here). */

export const TONES = { mine: "#FFD23F", foe: "#FF5470", goal: "#3FDB7C", dim: "#D9D0C1" };
const INK = "#1B1209";
const HALO = "rgba(22,14,6,0.62)";
const GROUND = "#2A2019";
const SQ = ["#94734E", "#86663F"];
const EDGE = "#5A3F27";
const WHITE = "#FFF7E6";
const TRAY = "rgba(255,247,230,0.09)";
export const W = 320, H = 140;
const r1 = (v) => Math.round(v * 10) / 10;

// A colour lighter (k > 0) or darker (k < 0).
function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------- icons */

// (A pointing hand, its finger up: filled, the lines between its fingers
// drawn over it.)
const HAND = '<path d="M8.6 13.2V3.6a1.5 1.5 0 0 1 3 0v6.8a1.5 1.5 0 0 1 3 0v.8a1.5 1.5 0 0 1 3 0v.8a1.4 1.4 0 0 1 2.8 0v4.6c0 3.1-2.5 5.4-5.6 5.4H13c-2 0-3.4-.9-4.5-2.3l-3.8-4.4a1.5 1.5 0 0 1 2.2-2l1.7 1.6z" fill="currentColor" stroke="none"/>';
const OWN = {
  person: '<circle cx="12" cy="7.4" r="4.4" fill="currentColor" stroke="none"/><path d="M3.4 21.8c.5-5.1 4-8 8.6-8s8.1 2.9 8.6 8z" fill="currentColor" stroke="none"/>',
  computer: '<rect x="2.6" y="3.4" width="18.8" height="13.2" rx="2.2"/><path d="M8.4 20.8h7.2M12 16.6v4.2"/><rect x="6" y="6.8" width="12" height="6.4" rx="1" fill="currentColor" stroke="none" opacity=".45"/>',
  trophy: '<path d="M6.8 3.4h10.4v4.8a5.2 5.2 0 0 1-10.4 0z" fill="currentColor" stroke="none"/><path d="M6.9 5.4H3.8v1.4a3.4 3.4 0 0 0 3.6 3.4M17.1 5.4h3.1v1.4a3.4 3.4 0 0 1-3.6 3.4M12 13.6v3.8"/><rect x="7.4" y="17.4" width="9.2" height="3.4" rx="1" fill="currentColor" stroke="none"/>',
  yes: '<path d="M4.8 12.6l4.6 4.6L19.4 7"/>',
  no: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4.8" y="10.4" width="14.4" height="10.8" rx="2.2" fill="currentColor" stroke="none"/><path d="M8 10.4V7.8a4 4 0 0 1 8 0v2.6"/>',
  wait: '<path d="M6.2 3h11.6M6.2 21h11.6"/><path d="M7.4 3.4c0 4.6 4.6 5.4 4.6 8.6s-4.6 4-4.6 8.6h9.2c0-4.6-4.6-5.4-4.6-8.6s4.6-4 4.6-8.6z"/><path d="M9.2 19.6c.5-2 2.8-3.1 2.8-3.1s2.3 1.1 2.8 3.1z" fill="currentColor" stroke="none"/>',
  block: '<path d="M12 2.8l8.2 4.6L12 12 3.8 7.4z" fill="currentColor" stroke="none" opacity=".4"/><path d="M12 2.8l8.2 4.6v9.2L12 21.2l-8.2-4.6V7.4zM3.8 7.4L12 12l8.2-4.6M12 12v9.2"/>',
  disc: '<ellipse cx="12" cy="9.4" rx="8.6" ry="4.2" fill="currentColor" stroke="none" opacity=".4"/><ellipse cx="12" cy="9.4" rx="8.6" ry="4.2"/><path d="M3.4 9.4v4.4c0 2.3 3.9 4.2 8.6 4.2s8.6-1.9 8.6-4.2V9.4"/>',
  tap: HAND,
  bars3: '<path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15"/>',
  turn: '<path d="M19.4 9.6A8 8 0 0 0 5.2 7.8"/><path d="M4.6 14.4a8 8 0 0 0 14.2 1.8"/><path d="M5.4 3.6v4.4h4.4M18.6 20.4V16h-4.4"/>',
  pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  zoom: '<circle cx="10.4" cy="10.4" r="6.6"/><path d="M15.2 15.2l5.4 5.4M7.4 10.4h6M10.4 7.4v6"/>',
  mouse: '<rect x="6" y="2.6" width="12" height="18.8" rx="6"/><path d="M12 2.6v6.8M6 9.4h12"/>',
  burst: '<path d="M12 2.5l2.2 5.6 5.9-1.8-3.3 5.2 4.6 3.9-6-.3L14.3 21 12 15.6 9.7 21l-1.1-5.9-6 .3 4.6-3.9-3.3-5.2 5.9 1.8z" fill="currentColor" stroke="none"/>',
};
export const ICON = (k) => OWN[k] || FAN_ICON[k] || "";

function Ico({ k, x, y, s = 24, c = WHITE, w = 2 }) {
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${Math.round((s / 24) * 1000) / 1000})`} fill="none" stroke={c} color={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON(k) }} />
  );
}

/* The board's tags, as pictures (TourMarks, while the pictures are on):
   each tag's icons in a row, a digit as itself. */
export function TagIcons({ icons, size = 17 }) {
  return (
    <span data-tag-icons={icons.join(" ")} style={{ display: "inline-flex", alignItems: "center", gap: 3, verticalAlign: "middle" }}>
      {icons.map((k, i) => (/^n\d$/.test(k)
        ? <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: size * 0.9, lineHeight: `${size}px`, minWidth: size * 0.6, textAlign: "center" }}>{k.slice(1)}</span>
        : k.startsWith("dots")
          ? <span key={i} style={{ display: "inline-flex", gap: 3 }}>{Array.from({ length: +k.slice(4) || 2 }, (_, j) => <span key={j} style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: "currentColor" }} />)}</span>
          : <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: ICON(k) }} />))}
    </span>
  );
}

/* ------------------------------------------------------------- parts */

// A pill like the board's tags: its tone, a dark edge, dark icons in it
// (and a swatch of a side's wood, a digit). Centred on x, y.
function Pill({ x, y, tone, icons, h = 26, swatch = null }) {
  const s = h - 9, gap = 3, pad = 6;
  const n = icons.length + (swatch ? 1 : 0);
  const w = pad * 2 + n * s + (n - 1) * gap;
  let at = pad;
  const parts = icons.map((k, i) => {
    const px = at; at += s + gap;
    if (/^n\d$/.test(k)) return <text key={i} x={px + s / 2} y={h / 2 + 5.2} textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontWeight="700" fontSize={15} fill={INK}>{k.slice(1)}</text>;
    return <Ico key={i} k={k} x={px} y={(h - s) / 2} s={s} c={INK} w={2.2} />;
  });
  return (
    <g transform={`translate(${r1(x - w / 2)} ${r1(y - h / 2)})`}>
      <rect width={w} height={h} rx={5} fill={TONES[tone]} stroke={HALO} strokeWidth={1.6} />
      {parts}
      {swatch && <rect x={at + 1.5} y={(h - s) / 2 + 1.5} width={s - 3} height={s - 3} rx={2} fill={swatch} stroke={INK} strokeWidth={1.2} />}
    </g>
  );
}
const pillW = (n, h = 26) => 12 + n * (h - 9) + (n - 1) * 3;

// A round badge: a digit, or an icon, in its tone.
function Badge({ x, y, tone, k, r = 11 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1.5} fill={HALO} />
      <circle cx={x} cy={y} r={r} fill={TONES[tone]} />
      {/^n\d$/.test(k)
        ? <text x={x} y={y + 5} textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontWeight="700" fontSize={14} fill={INK}>{k.slice(1)}</text>
        : <Ico k={k} x={x - r * 0.7} y={y - r * 0.7} s={r * 1.4} c={INK} w={3} />}
    </g>
  );
}

// An arrow through two or three points (a curve through the middle one),
// a dark halo under it as on the board; its head at the last.
function Arrow({ pts, tone = "mine", w = 2.6, dash = null, head = 8.5, opacity = 1, children = null }) {
  const [a, b, c] = pts;
  const end = c || b, from = c ? b : a;
  let ux = end[0] - from[0], uy = end[1] - from[1];
  const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
  const hx = end[0] - ux * head * 0.75, hy = end[1] - uy * head * 0.75;
  const d = c ? `M${r1(a[0])},${r1(a[1])}Q${r1(b[0])},${r1(b[1])} ${r1(hx)},${r1(hy)}` : `M${r1(a[0])},${r1(a[1])}L${r1(hx)},${r1(hy)}`;
  const bx = end[0] - ux * head, by = end[1] - uy * head, px = -uy * head * 0.58, py = ux * head * 0.58;
  const hd = `M${r1(end[0])},${r1(end[1])}L${r1(bx + px)},${r1(by + py)}L${r1(bx - px)},${r1(by - py)}Z`;
  const col = TONES[tone] || tone;
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={HALO} strokeWidth={w + 3} strokeLinecap="round" />
      <path d={d} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash || undefined} />
      <path d={hd} fill={col} stroke={HALO} strokeWidth={1.4} strokeLinejoin="round" />
      {children}
    </g>
  );
}

// The board from above: cols x rows squares of s at x, y; a row lit green
// (band), squares lit (lit: [row, col, tone, opacity]).
function Grid({ x, y, cols, rows, s, band = null, lit = [] }) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(<rect key={`${r}-${c}`} x={r1(x + c * s)} y={r1(y + r * s)} width={r1(s)} height={r1(s)} fill={SQ[(r + c) % 2]} />);
  return (
    <g>
      <rect x={r1(x - 2.5)} y={r1(y - 2.5)} width={r1(cols * s + 5)} height={r1(rows * s + 5)} rx={2.5} fill={EDGE} />
      {cells}
      {band != null && <rect x={r1(x)} y={r1(y + band * s)} width={r1(cols * s)} height={r1(s)} fill={TONES.goal} opacity={0.6} />}
      {lit.map(([r, c, tone, o], i) => <rect key={`l${i}`} x={r1(x + c * s + 1)} y={r1(y + r * s + 1)} width={r1(s - 2)} height={r1(s - 2)} rx={1.5} fill={TONES[tone] || tone} opacity={o == null ? 0.3 : o} />)}
    </g>
  );
}
const cellAt = (g, r, c) => [g.x + (c + 0.5) * g.s, g.y + (r + 0.5) * g.s];

// A ring round what it marks, as the board's: a halo, its tone; pulsing.
function pulse(still, dur = 1.3) {
  return still ? null : <animate attributeName="opacity" values="1;0.4;1" dur={`${dur}s`} repeatCount="indefinite" />;
}

// A piece from above, on a Grid: a block (w x h squares) or the disc.
function TopPiece({ g, r, c, w = 1, h = 1, disc = false, fill, tone = null, still, beat = false, faint = false }) {
  const s = g.s, px = g.x + c * s, py = g.y + r * s, pw = w * s, ph = h * s;
  const line = tint(fill, -0.35);
  const ring = tone && (disc
    ? <circle cx={r1(px + pw / 2)} cy={r1(py + ph / 2)} r={r1(s * 0.47)} fill="none" stroke={TONES[tone]} strokeWidth={2} strokeDasharray={faint ? "3 2.5" : undefined}>{beat ? pulse(still) : null}</circle>
    : <rect x={r1(px + 0.6)} y={r1(py + 0.6)} width={r1(pw - 1.2)} height={r1(ph - 1.2)} rx={2.5} fill="none" stroke={TONES[tone]} strokeWidth={2} strokeDasharray={faint ? "3 2.5" : undefined}>{beat ? pulse(still) : null}</rect>);
  const halo = tone && (disc
    ? <circle cx={r1(px + pw / 2)} cy={r1(py + ph / 2)} r={r1(s * 0.47)} fill="none" stroke={HALO} strokeWidth={4} />
    : <rect x={r1(px + 0.6)} y={r1(py + 0.6)} width={r1(pw - 1.2)} height={r1(ph - 1.2)} rx={2.5} fill="none" stroke={HALO} strokeWidth={4} />);
  if (faint) return <g>{halo}{ring}</g>;
  if (disc) {
    const cx = px + pw / 2, cy = py + ph / 2, rr = s * 0.34;
    return (
      <g>
        <circle cx={r1(cx + 0.8)} cy={r1(cy + 1.5)} r={r1(rr)} fill="rgba(0,0,0,0.38)" />
        <circle cx={r1(cx)} cy={r1(cy)} r={r1(rr)} fill={fill} stroke={line} strokeWidth={1} />
        <circle cx={r1(cx)} cy={r1(cy)} r={r1(rr * 0.6)} fill="none" stroke={line} strokeWidth={0.8} opacity={0.55} />
        {halo}{ring}
      </g>
    );
  }
  const i = s * 0.13;
  return (
    <g>
      <rect x={r1(px + i + 0.8)} y={r1(py + i + 1.6)} width={r1(pw - 2 * i)} height={r1(ph - 2 * i)} rx={r1(s * 0.12)} fill="rgba(0,0,0,0.38)" />
      <rect x={r1(px + i)} y={r1(py + i)} width={r1(pw - 2 * i)} height={r1(ph - 2 * i)} rx={r1(s * 0.12)} fill={fill} stroke={line} strokeWidth={1} />
      <rect x={r1(px + i + 2)} y={r1(py + i + 2)} width={r1(Math.max(1, pw - 2 * i - 4))} height={r1(Math.max(1, ph - 2 * i - 4))} rx={r1(s * 0.08)} fill="none" stroke={tint(fill, 0.35)} strokeWidth={0.8} opacity={0.7} />
      {halo}{ring}
    </g>
  );
}

// A strip of the board's squares seen from the side, its top at y.
function SideGround({ x, y, n, s }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => <rect key={i} x={r1(x + i * s)} y={y} width={r1(s)} height={6} fill={SQ[i % 2]} />)}
      <rect x={x - 2} y={y + 6} width={n * s + 4} height={3} rx={1} fill={EDGE} />
    </g>
  );
}

// A block seen from the side, standing on y (its foot), from x.
function SideBlock({ x, y, w, h, fill, tone = null }) {
  return (
    <g>
      {tone && <rect x={r1(x - 1.6)} y={r1(y - h - 1.6)} width={r1(w + 3.2)} height={r1(h + 3.2)} rx={3.5} fill="none" stroke={HALO} strokeWidth={4.4} />}
      <rect x={r1(x)} y={r1(y - h)} width={r1(w)} height={r1(h)} rx={2} fill={fill} stroke={tint(fill, -0.35)} strokeWidth={1} />
      <rect x={r1(x + 2.5)} y={r1(y - h + 2.5)} width={r1(w - 5)} height={r1(h - 5)} rx={1.2} fill="none" stroke={tint(fill, 0.3)} strokeWidth={0.9} opacity={0.75} />
      {tone && <rect x={r1(x - 1.6)} y={r1(y - h - 1.6)} width={r1(w + 3.2)} height={r1(h + 3.2)} rx={3.5} fill="none" stroke={TONES[tone]} strokeWidth={2} />}
    </g>
  );
}

// The disc seen from the side (a little from above: its top an oval),
// drawn round 0, 0 at its foot (so it can be squashed from there).
function SideDisc({ w, fill, tone = null }) {
  const h = w * 0.3, ry = w * 0.16, line = tint(fill, -0.35);
  const body = `M${r1(-w / 2)},${r1(-h)}V0A${r1(w / 2)},${r1(ry)} 0 0 0 ${r1(w / 2)},0V${r1(-h)}`;
  return (
    <g>
      {tone && <ellipse cx={0} cy={r1(-h / 2)} rx={r1(w / 2 + 4)} ry={r1(h / 2 + ry + 3)} fill="none" stroke={HALO} strokeWidth={4.4} />}
      <path d={body} fill={tint(fill, -0.12)} stroke={line} strokeWidth={1} />
      <ellipse cx={0} cy={r1(-h)} rx={r1(w / 2)} ry={r1(ry)} fill={fill} stroke={line} strokeWidth={1} />
      <ellipse cx={0} cy={r1(-h)} rx={r1(w * 0.3)} ry={r1(ry * 0.6)} fill="none" stroke={line} strokeWidth={0.8} opacity={0.5} />
      {tone && <ellipse cx={0} cy={r1(-h / 2)} rx={r1(w / 2 + 4)} ry={r1(h / 2 + ry + 3)} fill="none" stroke={TONES[tone]} strokeWidth={2} />}
    </g>
  );
}

/* A block tipping over its foot's right edge onto the next squares
   (or rolling onto a disc there): in, still, over, still, out. With
   reduced motion it stands where it starts; the arrow says it. */
const ROLL = { dur: 2.8, times: "0;0.1;0.28;0.52;0.88;1" };
function Roll({ x, y, w, h, fill, tone, still, delay = 0, by = 90 }) {
  const px = x + w, py = y;
  const begin = `${delay}s`;
  return (
    <g>
      {!still && <animateTransform attributeName="transform" type="rotate" values={`0 ${px} ${py};0 ${px} ${py};0 ${px} ${py};${by} ${px} ${py};${by} ${px} ${py};${by} ${px} ${py}`} keyTimes={ROLL.times} dur={`${ROLL.dur}s`} begin={begin} repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0 0 1 1;0.5 0 0.5 1;0 0 1 1;0 0 1 1" />}
      {!still && <animate attributeName="opacity" values="0;1;1;1;1;0" keyTimes={ROLL.times} dur={`${ROLL.dur}s`} begin={begin} repeatCount="indefinite" />}
      <SideBlock x={x} y={y} w={w} h={h} fill={fill} tone={tone} />
    </g>
  );
}
// (What it lands on, squashed as it lands; a burst there then.)
function Squashed({ cx, y, w, fill, tone, still, delay = 0, squash = true }) {
  const begin = `${delay}s`;
  return (
    <g transform={`translate(${r1(cx)} ${r1(y)})`}>
      <g>
        {!still && squash && <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1.14 0.2;1.14 0.2;1 1" keyTimes="0;0.47;0.53;0.88;1" dur={`${ROLL.dur}s`} begin={begin} repeatCount="indefinite" />}
        <SideDisc w={w} fill={fill} tone={tone} />
      </g>
    </g>
  );
}
function Burst({ x, y, still, delay = 0, s = 30, c = WHITE, show = false }) {
  const begin = `${delay}s`;
  return (
    <g opacity={still ? (show ? 1 : 0) : 0}>
      {!still && <animate attributeName="opacity" values="0;0;0;1;0;0" keyTimes="0;0.1;0.5;0.56;0.8;1" dur={`${ROLL.dur}s`} begin={begin} repeatCount="indefinite" />}
      <Ico k="burst" x={x - s / 2} y={y - s / 2} s={s} c={c} />
    </g>
  );
}
// The way a roll goes: an arc over the corner it tips on.
const rollArc = (x0, x1, y, lift = 20, tone = "mine") => <Arrow pts={[[x0, y], [(x0 + x1) / 2, y - lift], [x1, y]]} tone={tone} w={2.2} head={7.5} />;

// A hand, its fingertip at x, y; tapping: down and up, a ring going out.
function Hand({ x, y, s = 30, still, tap = true, delay = 0, period = 1.6 }) {
  // (The fingertip sits at 10.1, 2.4 of the hand's 24.)
  const k = s / 24, ox = x - 10.1 * k, oy = y - 2.4 * k;
  const begin = `${delay}s`;
  return (
    <g>
      {tap && !still && (
        <circle cx={x} cy={y} r={4} fill="none" stroke={WHITE} strokeWidth={2}>
          <animate attributeName="r" values="3;3;15" keyTimes="0;0.35;1" dur={`${period}s`} begin={begin} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.95;0" keyTimes="0;0.35;1" dur={`${period}s`} begin={begin} repeatCount="indefinite" />
        </circle>
      )}
      <g>
        {tap && !still && <animateTransform attributeName="transform" type="translate" values="2 6;0 0;0 0;2 6" keyTimes="0;0.3;0.45;1" dur={`${period}s`} begin={begin} repeatCount="indefinite" />}
        <g transform={`translate(${r1(ox)} ${r1(oy)}) scale(${Math.round(k * 1000) / 1000})`}>
          <path d="M8.6 13.2V3.6a1.5 1.5 0 0 1 3 0v6.8a1.5 1.5 0 0 1 3 0v.8a1.5 1.5 0 0 1 3 0v.8a1.4 1.4 0 0 1 2.8 0v4.6c0 3.1-2.5 5.4-5.6 5.4H13c-2 0-3.4-.9-4.5-2.3l-3.8-4.4a1.5 1.5 0 0 1 2.2-2l1.7 1.6z" fill={WHITE} stroke={HALO} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M11.6 10.4v2.8M14.6 11.2v2.4M17.6 12v2" stroke={HALO} strokeWidth={1.1} strokeLinecap="round" fill="none" />
        </g>
      </g>
    </g>
  );
}

// A fingertip on the glass (the board's own mark for a drag).
const Tip = ({ x = 0, y = 0, children = null }) => <circle cx={x} cy={y} r={5.5} fill={WHITE} fillOpacity={0.94} stroke={HALO} strokeWidth={2.4}>{children}</circle>;

// A block seen from a corner, w x d squares, z high, its near corner's
// foot at x, y (u a square's side).
function IsoPiece({ x, y, w = 1, d = 1, z = 1, u = 16, fill, tone = null, disc = false }) {
  const cx = u * 0.866, cy = u * 0.5;
  const P = (a, b, c) => [r1(x + (a - b) * cx), r1(y - (a + b) * cy - c * u)];
  // (Its footprint, ringed on the ground.)
  const foot = [P(0, 0, 0), P(w, 0, 0), P(w, d, 0), P(0, d, 0)];
  const ring = tone && <polygon points={foot.map((p) => p.join(",")).join(" ")} fill="none" stroke={TONES[tone]} strokeWidth={2.2} strokeLinejoin="round" />;
  const ringHalo = tone && <polygon points={foot.map((p) => p.join(",")).join(" ")} fill="none" stroke={HALO} strokeWidth={4.6} strokeLinejoin="round" />;
  const shade = <polygon points={foot.map(([a, b]) => `${a + 2},${b + 1.5}`).join(" ")} fill="rgba(0,0,0,0.35)" />;
  if (disc) {
    const [mx, my] = P(w / 2, d / 2, 0), rx = u * 0.62, ry = u * 0.36, h = u * 0.32;
    return (
      <g>
        {ringHalo}{ring}
        <path d={`M${r1(mx - rx)},${r1(my - h)}V${r1(my)}A${r1(rx)},${r1(ry)} 0 0 0 ${r1(mx + rx)},${r1(my)}V${r1(my - h)}`} fill={tint(fill, -0.18)} stroke={tint(fill, -0.4)} strokeWidth={1} />
        <ellipse cx={r1(mx)} cy={r1(my - h)} rx={r1(rx)} ry={r1(ry)} fill={fill} stroke={tint(fill, -0.4)} strokeWidth={1} />
        <ellipse cx={r1(mx)} cy={r1(my - h)} rx={r1(rx * 0.55)} ry={r1(ry * 0.55)} fill="none" stroke={tint(fill, -0.4)} strokeWidth={0.8} opacity={0.5} />
      </g>
    );
  }
  const top = [P(0, 0, z), P(w, 0, z), P(w, d, z), P(0, d, z)];
  const left = [P(0, 0, 0), P(0, 0, z), P(0, d, z), P(0, d, 0)];
  const right = [P(0, 0, 0), P(w, 0, 0), P(w, 0, z), P(0, 0, z)];
  const poly = (pts, f) => <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={f} stroke={tint(fill, -0.45)} strokeWidth={1} strokeLinejoin="round" />;
  return (
    <g>
      {shade}{ringHalo}{ring}
      {poly(left, tint(fill, -0.22))}
      {poly(right, tint(fill, -0.08))}
      {poly(top, tint(fill, 0.18))}
    </g>
  );
}

// A small square of the screen, its board seen from a corner.
function Screen({ x, y, w, h, children = null }) {
  const cx = x + w / 2, cy = y + h * 0.5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} fill="#17110C" stroke="rgba(255,247,230,0.35)" strokeWidth={1.6} />
      <polygon points={`${r1(cx - w * 0.34)},${r1(cy)} ${r1(cx)},${r1(cy - h * 0.2)} ${r1(cx + w * 0.34)},${r1(cy)} ${r1(cx)},${r1(cy + h * 0.2)}`} fill={SQ[0]} stroke={EDGE} strokeWidth={2} />
      {children}
    </g>
  );
}
// The board seen from a corner, a small one.
const Diamond = ({ cx, cy, rx = 36, ry = 20, fill = SQ[0] }) => (
  <g>
    <polygon points={`${r1(cx - rx)},${r1(cy + 3)} ${r1(cx)},${r1(cy - ry + 3)} ${r1(cx + rx)},${r1(cy + 3)} ${r1(cx)},${r1(cy + ry + 3)}`} fill={EDGE} />
    <polygon points={`${r1(cx - rx)},${r1(cy)} ${r1(cx)},${r1(cy - ry)} ${r1(cx + rx)},${r1(cy)} ${r1(cx)},${r1(cy + ry)}`} fill={fill} stroke={EDGE} strokeWidth={1.4} />
    <path d={`M${r1(cx - rx / 2)},${r1(cy - ry / 2)}L${r1(cx + rx / 2)},${r1(cy + ry / 2)}M${r1(cx + rx / 2)},${r1(cy - ry / 2)}L${r1(cx - rx / 2)},${r1(cy + ry / 2)}`} stroke="rgba(27,18,9,0.3)" strokeWidth={1} />
  </g>
);

// Action lights in a row, as the counter at the foot of the screen.
function Dots({ x, y, n, r = 5, gap = 5, tone = "mine" }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle cx={r1(x + i * (2 * r + gap))} cy={y} r={r + 1.6} fill={HALO} />
          <circle cx={r1(x + i * (2 * r + gap))} cy={y} r={r} fill={TONES[tone]} />
        </g>
      ))}
    </g>
  );
}
const dotsW = (n, r = 5, gap = 5) => n * 2 * r + (n - 1) * gap;

// A divider between a picture's parts.
const Split = ({ x, y0 = 14, y1 = 126 }) => <line x1={x} y1={y0} x2={x} y2={y1} stroke="rgba(255,247,230,0.14)" strokeWidth={1.4} strokeDasharray="3 4" />;

/* A tile for a row of the menu (its cards: lit one at a time, as the
   menu is ringed): its icon, and, lit, the rings' yellow behind it.
   `lit` is the CSS animation that lights it (FirstGameTour's turnAnim). */
function Tile({ x, y, s = 56, icons, lit = null, tone = null }) {
  const k = icons.length > 1 ? 0.42 : 0.52, is = s * k, gap = 4;
  const total = icons.length * is + (icons.length - 1) * gap;
  const draw = (c) => icons.map((ic, i) => <Ico key={i} k={ic} x={x + (s - total) / 2 + i * (is + gap)} y={y + (s - is) / 2} s={is} c={c} w={2} />);
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={10} fill={TRAY} stroke="rgba(255,247,230,0.28)" strokeWidth={1.4} />
      {draw(tone ? TONES[tone] : WHITE)}
      {lit && (
        <g style={{ animation: lit }}>
          <rect x={x - 3} y={y - 3} width={s + 6} height={s + 6} rx={12} fill={TONES.mine} stroke={HALO} strokeWidth={1.6} />
          {draw(INK)}
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------- pictures */

// The opening, as the game sets it: yours along the near edge.
const OPENING = [
  { type: "flaco", r: 8, c: 6, w: 1, h: 2 }, { type: "turrito", r: 9, c: 5 }, { type: "cabeza", r: 9, c: 4, disc: true },
  { type: "chato", r: 8, c: 3, w: 1, h: 2 }, { type: "opa", r: 7, c: 4, w: 2, h: 2 },
];
const mirror = (p) => ({ ...p, r: 10 - p.r - (p.h || 1), c: 10 - p.c - (p.w || 1) });

function Welcome({ t, still, mine, foe }) {
  const g = { x: 104, y: 14, s: 11.2 };
  return (
    <>
      <Grid {...g} cols={10} rows={10} />
      {OPENING.map((p) => <TopPiece key={`f${p.type}`} g={g} {...mirror(p)} fill={foe} tone="foe" still={still} />)}
      {OPENING.map((p) => <TopPiece key={`m${p.type}`} g={g} {...p} fill={mine} tone="mine" still={still} beat />)}
      <Arrow pts={[[236, 32], [196, 18], [176, 28]]} tone="foe" w={2.2} />
      <Pill x={274} y={34} tone="foe" icons={["computer"]} swatch={foe} />
      <Arrow pts={[[84, 108], [124, 122], [146, 112]]} tone="mine" w={2.2} />
      <Pill x={46} y={106} tone="mine" icons={["person"]} swatch={mine} />
    </>
  );
}

function Ways({ still, mine, foe }) {
  const g = { x: 52, y: 24, s: 17 };
  const [dx, dy] = cellAt(g, 5, 1), [gx, gy] = cellAt(g, 0, 1);
  return (
    <>
      <Badge x={20} y={20} tone="mine" k="n1" />
      <Grid {...g} cols={3} rows={6} band={0} />
      <TopPiece g={g} r={5} c={1} disc fill={mine} tone="mine" still={still} beat />
      <Arrow pts={[[dx, dy - 8], [gx, gy + 6]]} tone="goal" w={2.8} />
      <Ico k="trophy" x={110} y={18} s={30} c={TONES.mine} />
      <Split x={160} />
      <Badge x={180} y={20} tone="foe" k="n2" />
      <SideGround x={190} y={112} n={4} s={28} />
      <Squashed cx={260} y={112} w={24} fill={foe} tone="foe" still={still} />
      <Roll x={218} y={112} w={28} h={28} fill={mine} tone="mine" still={still} />
      <Burst x={260} y={96} still={still} />
      {rollArc(224, 266, 74, 16)}
      <Ico k="trophy" x={280} y={18} s={30} c={TONES.mine} />
    </>
  );
}

function Goal({ t, still, mine }) {
  const g = { x: 34, y: 18, s: 18 };
  const [dx, dy] = cellAt(g, 5, 2);
  const cols = [0, 1, 2, 3, 4].map((c) => cellAt(g, 0, c)[0]);
  const to = (x) => { const [ex, ey] = [x, g.y + g.s * 0.5 + 6]; return { ex, ey }; };
  // The arrow's head along the row, end to end (anywhere on it wins).
  const path = (x) => {
    const { ex, ey } = to(x);
    const mx = (dx + ex) / 2, my = (dy - 8 + ey) / 2;
    let ux = ex - mx, uy = ey - my; const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
    const hx = ex - ux * 7, hy = ey - uy * 7;
    return { line: `M${r1(dx)},${r1(dy - 8)}Q${r1(mx)},${r1(my)} ${r1(hx)},${r1(hy)}`, head: `M${r1(ex)},${r1(ey)}L${r1(ex - ux * 9.5 - uy * 5.5)},${r1(ey - uy * 9.5 + ux * 5.5)}L${r1(ex - ux * 9.5 + uy * 5.5)},${r1(ey - uy * 9.5 - ux * 5.5)}Z` };
  };
  const stops = [cols[2], cols[2], cols[4], cols[4], cols[0], cols[0], cols[2]];
  const times = "0;0.12;0.36;0.44;0.84;0.92;1";
  const p0 = path(cols[2]);
  const N = 2, n = 2 * N + 1, s2 = Math.min(16, 84 / n);
  const g2 = { x: 246 - (n * s2) / 2, y: 16, s: s2 };
  const lit = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (r !== N || c !== N) lit.push([r, c, "mine", 0.26]);
  const [cx, cy] = cellAt(g2, N, N);
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  return (
    <>
      <Grid {...g} cols={5} rows={6} band={0} />
      <TopPiece g={g} r={5} c={2} disc fill={mine} tone="mine" still={still} beat />
      <g>
        <path d={p0.line} fill="none" stroke={HALO} strokeWidth={5.8} strokeLinecap="round">{!still && <animate attributeName="d" values={stops.map((x) => path(x).line).join(";")} keyTimes={times} dur="5.6s" repeatCount="indefinite" />}</path>
        <path d={p0.line} fill="none" stroke={TONES.goal} strokeWidth={2.8} strokeLinecap="round">{!still && <animate attributeName="d" values={stops.map((x) => path(x).line).join(";")} keyTimes={times} dur="5.6s" repeatCount="indefinite" />}</path>
        <path d={p0.head} fill={TONES.goal} stroke={HALO} strokeWidth={1.4} strokeLinejoin="round">{!still && <animate attributeName="d" values={stops.map((x) => path(x).head).join(";")} keyTimes={times} dur="5.6s" repeatCount="indefinite" />}</path>
      </g>
      {still && <Arrow pts={[[cols[1], 9], [cols[0] - 6, 9]]} tone="goal" w={2} head={6} />}
      {still && <Arrow pts={[[cols[3], 9], [cols[4] + 6, 9]]} tone="goal" w={2} head={6} />}
      <Ico k="trophy" x={132} y={12} s={28} c={TONES.mine} />
      <Split x={170} />
      <Grid {...g2} cols={n} rows={n} lit={lit} />
      {dirs.map(([ux, uy], i) => <Arrow key={i} pts={[[cx + ux * s2 * 0.45, cy + uy * s2 * 0.45], [cx + ux * s2 * (N - 0.12), cy + uy * s2 * (N - 0.12)]]} tone="mine" w={2} head={6.5} />)}
      {/* (Its ring beating as the far row's disc's does: the same disc,
          yours; its steps alone, user: "People might assume that this is
          how all pieces move.") */}
      <TopPiece g={g2} r={N} c={N} disc fill={mine} tone="mine" still={still} beat />
      <Dots x={246 - dotsW(N) / 2 + 5} y={g2.y + n * s2 + 16} n={N} />
    </>
  );
}

function Crush({ still, mine, foe }) {
  return (
    <>
      <SideGround x={20} y={110} n={4} s={30} />
      <Squashed cx={95} y={110} w={25} fill={foe} tone="foe" still={still} />
      <Roll x={50} y={110} w={30} h={30} fill={mine} tone="mine" still={still} />
      <Burst x={95} y={94} still={still} />
      {rollArc(56, 100, 70, 16)}
      <Ico k="trophy" x={112} y={14} s={32} c={TONES.mine} />
      <Split x={160} />
      <SideGround x={180} y={110} n={4} s={30} />
      <Squashed cx={255} y={110} w={25} fill={mine} tone="mine" still={still} delay={0.7} />
      <Roll x={210} y={110} w={30} h={30} fill={foe} tone="foe" still={still} delay={0.7} />
      <Burst x={255} y={94} still={still} delay={0.7} />
      {rollArc(216, 260, 70, 16, "foe")}
      <Badge x={290} y={30} tone="foe" k="no" r={14} />
    </>
  );
}

function Blocks({ still, mine, foe }) {
  const g = { x: 124, y: 34, s: 24 };
  const [cx, cy] = cellAt(g, 1, 1);
  return (
    <>
      <SideGround x={12} y={104} n={3} s={27} />
      <Roll x={14} y={104} w={25} h={25} fill={mine} tone="mine" still={still} />
      {rollArc(20, 58, 72, 15)}
      <Badge x={88} y={26} tone="goal" k="yes" r={11} />
      <Split x={107} />
      <Grid {...g} cols={3} rows={3} />
      <TopPiece g={g} r={1} c={1} fill={mine} tone="mine" still={still} />
      {[[0, -1], [1, 0], [0, 1], [-1, 0]].map(([ux, uy], i) => <Arrow key={i} pts={[[cx + ux * 11, cy + uy * 11], [cx + ux * g.s * 1.02, cy + uy * g.s * 1.02]]} tone="mine" w={2.4} head={7} />)}
      <Arrow pts={[[cx + 10, cy - 10], [cx + g.s * 0.96, cy - g.s * 0.96]]} tone="foe" w={2.4} head={7} />
      <Badge x={g.x + g.s * 3 + 2} y={g.y - 2} tone="foe" k="no" r={9} />
      <Split x={213} />
      <SideGround x={228} y={104} n={3} s={27} />
      <g transform="translate(241.5 104)"><SideDisc w={22} fill={mine} tone="mine" /></g>
      <g transform="translate(268.5 104)"><SideDisc w={22} fill={foe} tone="foe" /></g>
      <Arrow pts={[[242, 84], [256, 62], [268, 84]]} tone="mine" w={2.2} head={7} />
      <Badge x={298} y={26} tone="foe" k="no" r={11} />
    </>
  );
}

function Turn({ t, still, mine }) {
  const first = t.youFirst ? "mine" : "foe", second = t.youFirst ? "foe" : "mine";
  const who = (k) => (k === "mine" ? ["person"] : ["computer"]);
  // (The basic game's two actions, one piece a turn: its demonstration's.)
  const N = 2;
  const opa = t.hasOpa;
  const s = 17, gy = 126, q = s + 2;
  return (
    <>
      <Pill x={60} y={24} tone={first} icons={who(first)} />
      <Arrow pts={[[82, 24], [128, 24]]} tone={second} w={2.2} head={7} />
      <Pill x={150} y={24} tone={second} icons={who(second)} />
      <Arrow pts={[[172, 24], [218, 24]]} tone={first} w={2.2} head={7} />
      <g opacity={0.5}><Pill x={240} y={24} tone={first} icons={who(first)} /></g>
      <Arrow pts={[[262, 24], [292, 24]]} tone={second} w={2.2} head={7} opacity={0.5} />
      <line x1={14} y1={48} x2={306} y2={48} stroke="rgba(255,247,230,0.12)" strokeWidth={1.2} />
      {/* A turn's actions, a roll each: a light over each roll. */}
      <SideGround x={16} y={gy} n={N + 1} s={q} />
      <SideBlock x={17} y={gy} w={s} h={s} fill={mine} tone="mine" />
      <g opacity={0.6}>{Array.from({ length: N }, (_, i) => <rect key={i} x={17 + (i + 1) * q} y={gy - s} width={s} height={s} rx={2} fill="none" stroke={TONES.mine} strokeWidth={1.4} strokeDasharray="3 2.5" />)}</g>
      {Array.from({ length: N }, (_, i) => (
        <g key={i}>
          {rollArc(21 + i * q, 41 + i * q, gy - s - 5, 11)}
          <Dots x={31 + i * q} y={gy - s - 30} n={1} r={4.5} />
        </g>
      ))}
      {opa && (
        <>
          <Split x={16 + (N + 1) * q + 14} y0={60} y1={130} />
          {/* (The Opa: its one roll takes both.) */}
          <SideGround x={16 + (N + 1) * q + 28} y={gy} n={4} s={q} />
          <SideBlock x={17 + (N + 1) * q + 28} y={gy} w={2 * s + 2} h={2 * s + 2} fill={mine} tone="mine" />
          {rollArc(16 + (N + 1) * q + 38, 16 + (N + 1) * q + 80, gy - 2 * s - 8, 11)}
          <Dots x={16 + (N + 1) * q + 50} y={gy - 2 * s - 32} n={2} r={4.5} gap={4} />
        </>
      )}
      {(
        <>
          <Split x={226} y0={60} y1={130} />
          {/* (Sooner: press and hold the piece till its ring closes; the
              hold alone, as the game is played, user: "Don't teach them
              something that's not going to be used in the actual game".) */}
          <SideBlock x={264} y={gy - 4} w={s} h={s} fill={mine} />
          <circle cx={272.5} cy={gy - 4 - s / 2} r={16} fill="none" stroke="rgba(255,247,230,0.2)" strokeWidth={3.4} />
          <circle cx={272.5} cy={gy - 4 - s / 2} r={16} fill="none" stroke={TONES.mine} strokeWidth={3.4} strokeLinecap="round" strokeDasharray={`${r1(2 * Math.PI * 16)}`} strokeDashoffset={r1(2 * Math.PI * 16 * 0.3)} transform={`rotate(-90 272.5 ${gy - 4 - s / 2})`}>
            {!still && <animate attributeName="stroke-dashoffset" values={`${r1(2 * Math.PI * 16)};0;0`} keyTimes="0;0.75;1" dur="2.4s" repeatCount="indefinite" />}
          </circle>
          <Hand x={274} y={gy - 2 - s / 2} s={26} still={still} tap={false} />
        </>
      )}
    </>
  );
}
// An arrow's head alone, at `at`, pointing on from `from`.
function Head({ at, from, tone = "mine", size = 9 }) {
  let ux = at[0] - from[0], uy = at[1] - from[1];
  const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
  const bx = at[0] - ux * size, by = at[1] - uy * size, px = -uy * size * 0.58, py = ux * size * 0.58;
  return <path d={`M${r1(at[0])},${r1(at[1])}L${r1(bx + px)},${r1(by + py)}L${r1(bx - px)},${r1(by - py)}Z`} fill={TONES[tone]} stroke={HALO} strokeWidth={1.4} strokeLinejoin="round" />;
}
// An arc of an oval round cx, cy from angle a0 to a1 (degrees, y down),
// dashed as the board's, its head at a1.
function Orbit({ cx, cy, rx, ry, a0, a1, children = null }) {
  const P = (deg) => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];
  const [x0, y0] = P(a0), [x1, y1] = P(a1);
  const d = `M${r1(x0)},${r1(y0)}A${rx},${ry} 0 0 ${a1 > a0 ? 1 : 0} ${r1(x1)},${r1(y1)}`;
  const tip = P(a1 + (a1 > a0 ? 6 : -6)), back = P(a1 - (a1 > a0 ? 4 : -4));
  return (
    <g>
      <path d={d} fill="none" stroke={HALO} strokeWidth={6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={TONES.mine} strokeWidth={3} strokeLinecap="round" strokeDasharray="9 6" />
      <Head at={tip} from={back} size={10} />
      {children && children(d, [x0, y0])}
    </g>
  );
}

/* The board turned, moved and zoomed: a finger's way (one finger round,
   two along, a pinch) or a mouse's (its left button, its right, its
   wheel), as the board's own arrows round it say. */
function Board({ t, still }) {
  const mouse = !t.touch;
  const A = { cx: 53, cy: 74 }, R = { rx: 45, ry: 29 };
  // (The way round a drag turns it, as TourMarks draws it on the board.)
  const near = mouse ? [38, 140] : [140, 38], far = mouse ? [-142, -40] : [-40, -142];
  return (
    <>
      {/* Turn it all the way round. */}
      <Diamond cx={A.cx} cy={A.cy} rx={34} ry={19} />
      <Orbit cx={A.cx} cy={A.cy} {...R} a0={far[0]} a1={far[1]} />
      <Orbit cx={A.cx} cy={A.cy} {...R} a0={near[0]} a1={near[1]}>
        {(d, p0) => (mouse ? null : still ? <Tip x={p0[0]} y={p0[1]} /> : (
          <Tip>
            <animateMotion path={d} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2s" repeatCount="indefinite" />
          </Tip>
        ))}
      </Orbit>
      {mouse && <MouseIcon x={A.cx - 14} y={A.cy - 16} button="left" />}
      <Split x={107} />
      {/* Move it up, down, sideways. */}
      <Diamond cx={160} cy={78} rx={34} ry={19} />
      <Ico k="pan" x={140} y={22} s={40} c={TONES.mine} w={2.2} />
      {mouse
        ? <MouseIcon x={146} y={60} button="right" />
        : (
          <g>
            {!still && <animateTransform attributeName="transform" type="translate" values="0 0;0 -9;0 0;9 0;0 0;-9 0;0 0" dur="3.2s" repeatCount="indefinite" />}
            <Tip x={153} y={80} /><Tip x={168} y={80} />
          </g>
        )}
      <Split x={213} />
      {/* Zoom in and out. */}
      <Diamond cx={266} cy={84} rx={30} ry={17} />
      <Ico k="zoom" x={251} y={18} s={30} c={TONES.mine} w={2.4} />
      {mouse
        ? <MouseIcon x={252} y={66} button="wheel" />
        : (
          <g>
            <Arrow pts={[[257, 92], [246, 103]]} tone="mine" w={2} head={6} />
            <Arrow pts={[[275, 76], [286, 65]]} tone="mine" w={2} head={6} />
            <Tip x={256} y={93}>{!still && <animate attributeName="cx" values="261;251;261" dur="2s" repeatCount="indefinite" />}{!still && <animate attributeName="cy" values="88;98;88" dur="2s" repeatCount="indefinite" />}</Tip>
            <Tip x={276} y={75}>{!still && <animate attributeName="cx" values="271;281;271" dur="2s" repeatCount="indefinite" />}{!still && <animate attributeName="cy" values="80;70;80" dur="2s" repeatCount="indefinite" />}</Tip>
          </g>
        )}
    </>
  );
}
// A mouse, its left or right button lit, or its wheel.
function MouseIcon({ x, y, button }) {
  const k = 1.15;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x={6} y={2.6} width={12} height={18.8} rx={6} fill="#17110C" stroke={WHITE} strokeWidth={1.8} />
      {button === "left" && <path d="M12 2.6a6 6 0 0 0-6 6v.8h6z" fill={TONES.mine} />}
      {button === "right" && <path d="M12 2.6a6 6 0 0 1 6 6v.8h-6z" fill={TONES.mine} />}
      <path d="M12 2.6v6.8M6 9.4h12" stroke={WHITE} strokeWidth={1.4} />
      {button === "wheel" && <rect x={10.6} y={4.4} width={2.8} height={4.4} rx={1.4} fill={TONES.mine} />}
    </g>
  );
}

// Your turn: tap a piece ringed in yellow; its arrows; one boxed in.
function Pieces({ t, still, mine }) {
  const g = { x: 76, y: 22, s: 24 };
  const boxed = t.boxed && t.boxed.length > 0;
  const [tx, ty] = cellAt(g, 2, 5);
  return (
    <>
      <Grid {...g} cols={7} rows={4} />
      <TopPiece g={g} r={2} c={1} w={1} h={2} fill={mine} tone={boxed ? "dim" : "mine"} still={still} beat={!boxed} />
      {boxed && <TopPiece g={g} r={1} c={1} fill={mine} tone="mine" still={still} />}
      {boxed && <TopPiece g={g} r={2} c={0} disc fill={mine} tone="mine" still={still} />}
      {boxed && <TopPiece g={g} r={2} c={2} fill={mine} tone="mine" still={still} />}
      {boxed && <Badge x={g.x + 1.5 * g.s} y={g.y + 3 * g.s} tone="dim" k="lock" r={10} />}
      <TopPiece g={g} r={3} c={3} disc fill={mine} tone="mine" still={still} beat />
      <TopPiece g={g} r={2} c={5} fill={mine} tone="mine" still={still} />
      <g>
        {!still && <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.3;0.4;0.92;1" dur="3.2s" repeatCount="indefinite" />}
        {[[0, -1], [1, 0], [-1, 0], [0, 1]].map(([ux, uy], i) => <Arrow key={i} pts={[[tx + ux * 11, ty + uy * 11], [tx + ux * g.s * 0.98, ty + uy * g.s * 0.98]]} tone="mine" w={2.4} head={7} />)}
      </g>
      <g>
        {!still && <animate attributeName="opacity" values="1;1;1;0;0;1" keyTimes="0;0.3;0.42;0.5;0.95;1" dur="3.2s" repeatCount="indefinite" />}
        <Hand x={tx + 3} y={ty + 2} s={32} still={still} period={3.2} />
      </g>
    </>
  );
}

function Waiting({ still, foe }) {
  return (
    <>
      <Pill x={92} y={64} tone="foe" icons={["computer"]} />
      <g>
        {!still && <animateTransform attributeName="transform" type="rotate" values="0 150 64;0 150 64;180 150 64;180 150 64" keyTimes="0;0.6;0.85;1" dur="2.4s" repeatCount="indefinite" />}
        <Ico k="wait" x={134} y={48} s={32} c={WHITE} />
      </g>
      <Arrow pts={[[178, 64], [212, 64]]} tone="mine" w={2.4} head={8} />
      <g opacity={0.6}><Pill x={238} y={64} tone="mine" icons={["person"]} /></g>
    </>
  );
}

// The other side's move: where it stood, an arrow, where it is now.
function Foe({ t, still, mine, foe }) {
  if (t.waiting) {
    const g = { x: 108, y: 34, s: 20 };
    return (
      <>
        <Pill x={52} y={40} tone="foe" icons={["computer"]} />
        <Ico k="wait" x={36} y={70} s={30} c={WHITE} />
        <Grid {...g} cols={5} rows={3} />
        <g>
          {!still && <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;0 ${g.s};0 ${g.s}`} keyTimes="0;0.35;0.6;1" dur="2.4s" repeatCount="indefinite" />}
          <TopPiece g={g} r={0} c={2} fill={foe} tone="foe" still={still} />
        </g>
        <TopPiece g={g} r={2} c={4} disc fill={mine} tone="mine" still={still} />
      </>
    );
  }
  const g = { x: 26, y: 32, s: 20 };
  const [ax, ay] = cellAt(g, 0, 2), [bx, by] = cellAt(g, 1, 2);
  return (
    <>
      <Grid {...g} cols={5} rows={4} />
      <TopPiece g={g} r={0} c={2} fill={foe} tone="foe" faint still={still} />
      <TopPiece g={g} r={1} c={2} fill={foe} tone="foe" still={still} beat />
      <Arrow pts={[[ax - 3, ay - 1], [ax - 12, (ay + by) / 2], [bx - 9, by - 1]]} tone="foe" w={2.4} head={7} />
      <TopPiece g={g} r={3} c={1} disc fill={mine} still={still} />
      <Pill x={g.x + 5 * g.s + 36} y={g.y + g.s * 1.5} tone="foe" icons={["computer"]} />
      <Arrow pts={[[g.x + 5 * g.s + 14, g.y + g.s * 1.5], [bx + 14, by]]} tone="foe" w={2} head={7} />
      <Split x={196} />
      {t.menu
        ? (
          <>
            <Screen x={212} y={22} w={94} h={96} />
            <g transform="translate(284 106)"><IsoPiece x={0} y={0} u={12} fill={mine} /></g>
            <circle cx={284} cy={98} r={15} fill="none" stroke={TONES.mine} strokeWidth={2.4}>{pulse(still)}</circle>
          </>
        )
        : (
          <>
            <Pill x={258} y={34} tone="mine" icons={["person"]} />
            <IsoPiece x={250} y={110} u={18} fill={mine} tone="mine" />
            <Hand x={252} y={92} s={30} still={still} />
          </>
        )}
    </>
  );
}

// A piece picked: what it is, how it moves and how often, what next.
function MiniRoll({ x, y, fill }) {
  return (
    <g>
      <SideGround x={x} y={y} n={2} s={15} />
      <SideBlock x={x + 1} y={y} w={13} h={13} fill={fill} />
      {rollArc(x + 5, x + 23, y - 18, 9)}
    </g>
  );
}
function MiniStep({ cx, cy, fill }) {
  // (A square each way from it, corners too: four straight, four corner.)
  const g = { x: cx - 21, y: cy - 21, s: 14 };
  return (
    <g>
      <Grid {...g} cols={3} rows={3} lit={[0, 1, 2, 3, 5, 6, 7, 8].map((k) => [Math.floor(k / 3), k % 3, "mine", 0.22])} />
      {[[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([ux, uy], i) => <Arrow key={i} pts={[[cx + ux * 5.5, cy + uy * 5.5], [cx + ux * 13.5, cy + uy * 13.5]]} tone="mine" w={1.8} head={5} />)}
      <circle cx={cx} cy={cy} r={4.6} fill={fill} stroke={HALO} strokeWidth={1.2} />
    </g>
  );
}
function Lesson({ t, still, mine }) {
  const p = t.lessonPic || {};
  const type = p.type || "turrito";
  const disc = type === "cabeza";
  const dims = { turrito: [1, 1, 1], opa: [2, 2, 2], chato: [1, 2, 2], flaco: p.z > 1 ? [1, 1, 2] : [1, 2, 1] }[type] || [p.w || 1, p.h || 1, p.z || 1];
  const big = Math.max(...dims);
  const u = big > 1 ? 19 : 28;
  const times = Math.min(2, Math.max(1, p.times || 1)), cost = p.cost || 1;
  const col = disc ? 54 : 40, x0 = 172 - (times * col) / 2;
  return (
    <>
      <IsoPiece x={56 - ((dims[0] - dims[1]) * u * 0.866) / 2} y={98 + ((dims[0] + dims[1]) * u * 0.5) / 2 - u * 0.35} w={dims[0]} d={dims[1]} z={dims[2]} u={u} fill={mine} tone="mine" disc={disc} />
      <Split x={112} />
      {/* How it moves, as often as a turn allows: the lights each takes
          over it. */}
      {Array.from({ length: times }, (_, i) => {
        const cx = x0 + i * col + col / 2;
        return (
          <g key={i}>
            <Dots x={cx - ((cost - 1) * 13) / 2} y={44} n={cost} r={4.5} gap={4} />
            {disc ? <MiniStep cx={cx} cy={84} fill={mine} /> : <MiniRoll x={cx - 15} y={96} fill={mine} />}
          </g>
        );
      })}
      <Split x={232} />
      {p.can === false
        ? (
          <>
            <Badge x={276} y={36} tone="dim" k="lock" r={14} />
            <Arrow pts={[[262, 58], [252, 80], [266, 96]]} tone="mine" w={2.2} head={7} />
            <IsoPiece x={286} y={118} u={15} fill={mine} tone="mine" />
            <Hand x={288} y={104} s={26} still={still} />
          </>
        )
        : p.locked && p.left > 0
          ? (
            <>
              {/* (Again; or press and hold it till its ring closes.) */}
              <MiniRoll x={261} y={40} fill={mine} />
              <line x1={242} y1={56} x2={312} y2={56} stroke="rgba(255,247,230,0.12)" strokeWidth={1.2} />
              <SideBlock x={268} y={118} w={16} h={16} fill={mine} />
              <circle cx={276} cy={110} r={15} fill="none" stroke="rgba(255,247,230,0.2)" strokeWidth={3} />
              <circle cx={276} cy={110} r={15} fill="none" stroke={TONES.mine} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${r1(2 * Math.PI * 15)}`} strokeDashoffset={r1(2 * Math.PI * 15 * 0.3)} transform="rotate(-90 276 110)">
                {!still && <animate attributeName="stroke-dashoffset" values={`${r1(2 * Math.PI * 15)};0;0`} keyTimes="0;0.75;1" dur="2.4s" repeatCount="indefinite" />}
              </circle>
              <Hand x={278} y={111} s={24} still={still} tap={false} />
            </>
          )
          : (
            <>
              {/* (Where it can go, as the board shows it: an arrow from the
                  piece to the squares it would land on, outlined; tap
                  there. Not a square lit, user: "It's not a lit square.") */}
              <Grid x={250} y={46} cols={2} rows={2} s={24} />
              {disc
                ? <circle cx={262} cy={82} r={7} fill={mine} stroke={TONES.mine} strokeWidth={1.8} />
                : <rect x={254.5} y={74.5} width={15} height={15} rx={2.5} fill={mine} stroke={TONES.mine} strokeWidth={1.8} />}
              <rect x={276.5} y={48.5} width={19} height={19} rx={2.5} fill="none" stroke={HALO} strokeWidth={3.6} />
              <rect x={276.5} y={48.5} width={19} height={19} rx={2.5} fill="none" stroke={TONES.mine} strokeWidth={1.6} />
              <Arrow pts={[[264, 73], [262, 59], [280, 58]]} tone="mine" w={2.4} head={7} />
              <Hand x={288} y={60} s={30} still={still} />
            </>
          )}
    </>
  );
}

// The menu in the corner: tap the piece, the menu out round it; tap
// outside, put away.
function Fan({ cx, cy, r0 = 16, r1: rr = 40, n = 4, lit = -1 }) {
  const wedge = (a0, a1) => {
    const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = P(rr, a0), [x1, y1] = P(rr, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
    return `M${r1(x0)},${r1(y0)}A${rr},${rr} 0 0 1 ${r1(x1)},${r1(y1)}L${r1(x2)},${r1(y2)}A${r0},${r0} 0 0 0 ${r1(x3)},${r1(y3)}Z`;
  };
  const from = Math.PI, to = Math.PI * 1.5, step = (to - from) / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => <path key={i} d={wedge(from + i * step + 0.03, from + (i + 1) * step - 0.03)} fill={i === lit ? TONES.mine : "#EDE0C4"} stroke={HALO} strokeWidth={1.4} />)}
    </g>
  );
}
function Menu({ still, mine }) {
  const piece = (x, y) => <g transform={`translate(${x} ${y})`}><IsoPiece x={0} y={0} u={9} fill={mine} /></g>;
  return (
    <>
      <Screen x={10} y={20} w={82} h={100}>
        {piece(78, 108)}
        <circle cx={78} cy={102} r={12} fill="none" stroke={TONES.mine} strokeWidth={2.4}>{pulse(still)}</circle>
        <Hand x={80} y={103} s={26} still={still} />
      </Screen>
      <Arrow pts={[[98, 70], [116, 70]]} tone="mine" w={2.2} head={7} />
      <Screen x={120} y={20} w={82} h={100}>
        <Fan cx={190} cy={110} r0={14} r1={46} />
        {piece(188, 116)}
      </Screen>
      <Arrow pts={[[208, 70], [226, 70]]} tone="mine" w={2.2} head={7} />
      <Screen x={230} y={20} w={82} h={100}>
        <g opacity={0.35}><Fan cx={300} cy={110} r0={14} r1={46} /></g>
        {piece(298, 116)}
        <Hand x={250} y={40} s={26} still={still} />
      </Screen>
    </>
  );
}

// The menu's rows, each lit as the menu rings it (anim(i): the light's).
function Rows({ rows, anim }) {
  const n = rows.length, s = n > 4 ? 46 : 56, gap = n > 4 ? 12 : 16;
  const x0 = (W - (n * s + (n - 1) * gap)) / 2;
  return <>{rows.map((icons, i) => <Tile key={i} x={x0 + i * (s + gap)} y={(H - s) / 2} s={s} icons={icons} lit={anim ? anim(i, n) : null} />)}</>;
}
function Panel({ t, anim }) {
  if (t.rings) {
    const rows = [["person", "computer"]];
    if (t.views && t.views.length) rows.push(["view"]);
    if (t.sound) rows.push(["sound"]);
    rows.push(["more"]);
    return <Rows rows={rows} anim={anim} />;
  }
  const rows = [];
  if (t.undo) rows.push(["undo"]);
  if (t.views && t.views.length) rows.push(["view"]);
  if (t.check) rows.push(["check"]);
  if (t.endGame) rows.push(["endgame"]);
  return <Rows rows={rows} anim={anim} />;
}
// Along its foot (the classic menu), each lit in turn; or what More holds.
function Foot({ t, still, mine, anim }) {
  if (t.rings) {
    const groups = [["endturn", "undo", "endgame"], [t.check ? "check" : null, "guide", "whynot", "points"].filter(Boolean), ["sound", "language"], ["replay", "saves"]];
    if (t.layout) groups.push(["bar"]);
    const rh = groups.length > 4 ? 21 : 25;
    const y0 = (H - groups.length * rh) / 2;
    return (
      <>
        <Tile x={16} y={44} s={52} icons={["more"]} lit={anim ? "none" : null} tone="mine" />
        <rect x={13} y={41} width={58} height={58} rx={12} fill="none" stroke={TONES.mine} strokeWidth={2.6} />
        <Arrow pts={[[78, 70], [96, 70]]} tone="mine" w={2.2} head={7} />
        <rect x={100} y={y0 - 6} width={124} height={groups.length * rh + 12} rx={8} fill={TRAY} stroke="rgba(255,247,230,0.28)" strokeWidth={1.4} />
        {groups.map((gr, i) => (
          <g key={i}>
            {i > 0 && <line x1={108} y1={y0 + i * rh} x2={216} y2={y0 + i * rh} stroke="rgba(255,247,230,0.14)" strokeWidth={1} />}
            {gr.map((k, j) => <Ico key={k} k={k} x={110 + j * 26} y={y0 + i * rh + (rh - 18) / 2} s={18} c={WHITE} w={2} />)}
          </g>
        ))}
        <Split x={236} />
        <IsoPiece x={276} y={112} u={18} fill={mine} tone="mine" />
        <Hand x={278} y={94} s={30} still={still} />
      </>
    );
  }
  const keys = [t.layout ? "bar" : null, "whynot", "guide", "points", t.sound ? "sound" : null].filter(Boolean);
  const n = keys.length, s = 36, gap = 8, x0 = (236 - (n * s + (n - 1) * gap)) / 2;
  return (
    <>
      {keys.map((k, i) => <Tile key={k} x={x0 + i * (s + gap)} y={30} s={s} icons={[k]} lit={anim ? anim(i, n) : null} />)}
      {/* (On, and off: a line through it.) */}
      <Tile x={40} y={86} s={34} icons={["guide"]} />
      <Badge x={88} y={103} tone="goal" k="yes" r={9} />
      <g>
        <Tile x={128} y={86} s={34} icons={["guide"]} />
        <line x1={134} y1={114} x2={156} y2={92} stroke={WHITE} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      <Badge x={176} y={103} tone="foe" k="no" r={9} />
      <Split x={236} />
      <IsoPiece x={276} y={112} u={18} fill={mine} tone="mine" />
      <Hand x={278} y={94} s={30} still={still} />
    </>
  );
}
// The control bar, shown for now: the bar along the foot, its menu at
// the top right; from there, the piece in the corner again.
function Bar({ still, mine }) {
  return (
    <>
      <Screen x={40} y={14} w={150} h={112}>
        <rect x={48} y={104} width={134} height={16} rx={4} fill="#EDE0C4" />
        <rect x={45} y={101} width={140} height={22} rx={6} fill="none" stroke={TONES.mine} strokeWidth={2.4} />
        <g transform="translate(166 22)">
          <rect x={0} y={0} width={18} height={16} rx={3} fill="#EDE0C4" />
          <Ico k="bars3" x={2} y={1} s={14} c={INK} w={2.4} />
        </g>
        <rect x={163} y={19} width={24} height={22} rx={6} fill="none" stroke={TONES.mine} strokeWidth={2.4}>{pulse(still)}</rect>
        <Hand x={176} y={34} s={24} still={still} />
      </Screen>
      <Arrow pts={[[204, 40], [238, 36], [252, 74]]} tone="mine" w={2.4} head={8} />
      <IsoPiece x={262} y={112} u={18} fill={mine} tone="mine" />
    </>
  );
}

/* The picture for the tour's moment `t` (FirstGameTour's tour, with
   mineSwatch and foeSwatch: the sides' woods; lessonPic: a picked
   piece's type, how often it moves, what it costs, where your turn
   stands). `anim(i, n)` lights the menu's rows in turn (the card's), and
   `still` holds every picture still (reduced motion). */
// Which picture a moment of the tour has (the pieces' card: the computer
// moving, a piece picked, or yours to pick).
export const pictureOf = (t) => (t.step === "pieces" ? (t.waiting ? "waiting" : t.lessonPic ? "lesson" : "pieces") : t.step);

export function TourPicture({ t, still, anim, preview = false }) {
  const mine = t.mineSwatch || "#D9B77E", foe = t.foeSwatch || "#4A2C1C";
  const k = { t, still, mine, foe, anim };
  let body = null;
  switch (t.step) {
    case "welcome": body = <Welcome {...k} />; break;
    case "ways": body = <Ways {...k} />; break;
    case "goal": body = <Goal {...k} />; break;
    case "crush": body = <Crush {...k} />; break;
    case "blocks": body = <Blocks {...k} />; break;
    case "turn": body = <Turn {...k} />; break;
    case "board": body = <Board {...k} />; break;
    case "pieces": body = t.waiting ? <Waiting {...k} /> : t.lessonPic ? <Lesson {...k} /> : <Pieces {...k} />; break;
    case "foe": body = <Foe {...k} />; break;
    case "menu": body = <Menu {...k} />; break;
    case "panel": body = <Panel {...k} />; break;
    case "foot": body = <Foot {...k} />; break;
    case "bar": body = <Bar {...k} />; break;
    default: body = null;
  }
  if (!body) return null;
  return (
    <svg data-testid={preview ? "tour-choice-pictures" : "tour-picture"} data-picture={pictureOf(t)} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", borderRadius: 8, background: GROUND, aspectRatio: `${W} / ${H}`, maxWidth: "100%" }} aria-hidden="true">
      {body}
    </svg>
  );
}
