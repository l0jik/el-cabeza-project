/* Theme Lab: the stylesheet of one design direction.

   Three layers, in order:
     1. tokens: the spec's values as semantic custom properties on :root
        (--bg-primary, --accent-primary, --border-width, --shadow-x ...),
        read by everything below and by the lab's own chrome;
     2. the chassis's shared UI (menu card, buttons, rules, move log, win
        card, piece card, points) restyled from those tokens, so every
        control keeps working and only its dress changes;
     3. the direction's own composition of the in-game read-out (the HUD,
        themes/lab/hud.js), which is where the ten differ most.
   Motion is state, never decoration: every animation here marks a turn
   changing, a piece taken, a game ending, and all of it stops under
   prefers-reduced-motion. */

export function tokensCss(spec) {
  const c = spec.colors, t = spec.typography, b = spec.borders, s = spec.shadows, a = spec.animation;
  const shadow = s.opacity ? `${s.x}px ${s.y}px ${s.blur}px rgba(${s.color},${s.opacity})` : "none";
  return `
  :root {
    --bg-primary: ${c.bgPrimary}; --bg-secondary: ${c.bgSecondary}; --surface: ${c.surface};
    --text-primary: ${c.textPrimary}; --text-secondary: ${c.textSecondary};
    --panel-ink: ${c.panelInk || c.textPrimary};
    --accent-primary: ${c.accentPrimary}; --accent-secondary: ${c.accentSecondary}; --accent-tertiary: ${c.accentTertiary || c.accentSecondary};
    --board-surface: ${c.boardSurface}; --board-grid: ${c.boardGrid};
    --piece-primary: ${c.pieceDark}; --piece-secondary: ${c.pieceLight};
    --border-width: ${b.width}px; --border-color: ${b.color}; --radius: ${b.radius}px;
    --grid-gap: ${spec.spacing.unit}px; --gutter: ${spec.spacing.gutter}px;
    --shadow-x: ${s.x}px; --shadow-y: ${s.y}px; --shadow-blur: ${s.blur}px; --shadow-opacity: ${s.opacity};
    --shadow: ${shadow};
    --transition-speed: ${a.speed}ms; --ease: ${a.ease};
    --font-display: ${t.display}; --font-body: ${t.body}; --font-mono: ${t.mono};
    --display-weight: ${t.displayWeight}; --tracking: ${t.tracking}; --label-tracking: ${t.labelTracking}; --label-case: ${t.labelCase};
  }`;
}

/* The chassis's own controls, re-dressed. */
function chromeCss(spec) {
  return `
  html, body { background: var(--bg-primary); overscroll-behavior: none; }
  [style*="IBM Plex Mono"] { font-family: var(--font-mono) !important; }
  [style*="IBM Plex Sans"] { font-family: var(--font-body) !important; }
  [style*="Fraunces"] { font-family: var(--font-display) !important; }
  .ec-title { font-family: var(--font-display) !important; font-weight: var(--display-weight) !important; letter-spacing: var(--tracking) !important; color: var(--text-primary) !important; text-shadow: none !important; }
  [data-testid="dock-panel"] {
    background: var(--surface) !important; color: var(--panel-ink);
    border: var(--border-width) solid var(--border-color) !important; border-radius: var(--radius) !important;
    box-shadow: var(--shadow) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  .ec-btn { border-radius: var(--radius) !important; letter-spacing: var(--label-tracking) !important; font-family: var(--font-body) !important;
    transition: transform var(--transition-speed) var(--ease), box-shadow var(--transition-speed) var(--ease), background-color var(--transition-speed) var(--ease) !important; }
  .ec-btn:focus-visible, [data-testid="how-to-play"]:focus-visible, .lab-ctl:focus-visible { outline: 2px solid var(--accent-primary) !important; outline-offset: 2px; }
  [data-testid="piece-card"], [data-testid="new-game-choice"], [data-testid="victory-placard"], [data-testid="movelog-sheet"] {
    background: var(--surface) !important; color: var(--panel-ink) !important;
    border: var(--border-width) solid var(--border-color) !important; border-radius: var(--radius) !important;
    box-shadow: var(--shadow) !important; backdrop-filter: none !important;
  }
  [data-testid="piece-card"] span:first-child { font-family: var(--font-display) !important; font-weight: var(--display-weight) !important; letter-spacing: var(--tracking); }
  [data-testid="info-overlay"] > div {
    background: var(--surface) !important; color: var(--panel-ink) !important;
    border: var(--border-width) solid var(--border-color) !important; border-radius: var(--radius) !important;
    box-shadow: var(--shadow) !important; backdrop-filter: none !important;
  }
  [data-testid="info-overlay"] h2 { font-family: var(--font-display) !important; font-weight: var(--display-weight) !important; letter-spacing: var(--tracking) !important; }
  [data-testid="info-overlay"] [role="tab"][aria-selected="true"] { border-bottom-color: var(--accent-primary) !important; }
  [data-testid="victory-placard"] h2, [data-testid="victory-placard"] [style*="font-size"] { font-family: var(--font-display) !important; }
  [data-testid="points-counter"] { color: var(--text-primary) !important; font-family: var(--font-mono) !important; letter-spacing: var(--label-tracking) !important; }
  [data-testid="how-to-play"], button[aria-label$="full screen"] { color: var(--text-primary) !important; }
  [data-testid="unused-points-note"] { color: var(--text-secondary) !important; }
  [data-testid="dock-panel"] { margin-bottom: env(safe-area-inset-bottom); }
  [data-testid="how-to-play"], [data-testid="piece-card"] { margin-left: env(safe-area-inset-left); }
  @media (prefers-reduced-motion: reduce) { .ec-btn { transition: none !important; } }
  `;
}

/* The HUD's shared skeleton: where it sits and how it collapses on a
   small screen. Each direction then sets its own composition. */
const HUD_BASE = `
  .lab-hud { position: fixed; z-index: 11; pointer-events: none; box-sizing: border-box;
    left: calc(20px + env(safe-area-inset-left)); top: 76px; width: clamp(200px, 21vw, 290px);
    color: var(--text-primary); font-family: var(--font-body); font-variant-numeric: tabular-nums;
    transition: opacity var(--transition-speed) var(--ease); }
  .lab-hud * { box-sizing: border-box; }
  .lab-hud .lab-label { font-size: 10.5px; letter-spacing: var(--label-tracking); text-transform: var(--label-case); color: var(--text-secondary); }
  .lab-hud .lab-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0; }
  .lab-hud .lab-stats div { min-width: 0; }
  .lab-hud .lab-stats dt { margin: 0; }
  .lab-hud .lab-stats dd { margin: 2px 0 0; font-size: 20px; line-height: 1.05; font-weight: 700; white-space: nowrap; }
  .lab-hud .lab-log { list-style: none; margin: 0; padding: 0; }
  .lab-hud .lab-log li { display: grid; grid-template-columns: 2.2em 1fr; gap: 6px; align-items: baseline; font-size: 13px; }
  .lab-hud .lab-log .n { font-weight: 700; }
  .lab-hud .lab-log .p { display: inline-block; width: 0.7em; height: 0.7em; margin-right: 6px; vertical-align: 0; }
  .lab-hud .lab-log .p[data-p="dark"] { background: var(--piece-primary); }
  .lab-hud .lab-log .p[data-p="light"] { background: var(--piece-secondary); box-shadow: inset 0 0 0 1px var(--text-primary); }
  .lab-hud .lab-over { display: none; }
  .lab-hud[data-status="finished"] .lab-over { display: block; }
  .lab-hud .lab-swatch { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 8px; }
  .lab-hud[data-player="dark"] .lab-swatch { background: var(--piece-primary); }
  .lab-hud[data-player="light"] .lab-swatch { background: var(--piece-secondary); box-shadow: inset 0 0 0 1px var(--text-primary); }
  .lab-hud .lab-turn { animation: lab-turn-in calc(var(--transition-speed) * 2) var(--ease) both; }
  .lab-hud .lab-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .lab-hud[data-focus="selected"] { opacity: 1; }
  @keyframes lab-turn-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lab-capture { 0% { transform: none; } 30% { transform: translateX(-3px); } 60% { transform: translateX(3px); } 100% { transform: none; } }
  .lab-hud[data-captured="yes"] .lab-stats { animation: lab-capture 320ms linear; }
  /* Compact: a phone, or any screen without room beside the board. */
  @media (max-aspect-ratio: 3/2), (max-width: 899px) {
    .lab-hud { left: calc(10px + env(safe-area-inset-left)); right: calc(10px + env(safe-area-inset-right)); top: 58px; width: auto; }
    .lab-hud .lab-log, .lab-hud .lab-note { display: none !important; }
    .lab-hud .lab-stats { grid-template-columns: repeat(4, auto); justify-content: start; gap: 4px 14px; }
    .lab-hud .lab-stats dd { font-size: 15px; }
    .lab-hud[data-phase="setup"] { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .lab-hud, .lab-hud * { animation: none !important; transition: none !important; } }
`;
/* In the compact strip the turn number floats top right; these
   directions keep a column clear for it so nothing sits on it. */
const COMPACT_FLOAT = `
  @media (max-aspect-ratio: 3/2), (max-width: 899px) {
    .lab-hud { padding-right: 92px; }
    .lab-hud .lab-big { position: absolute !important; right: 0 !important; top: 0 !important; width: 84px; margin: 0 !important; text-align: right; z-index: 1; }
  }
`;
const FLOATS = new Set(["swiss", "bauhaus", "elementarism", "brutalist", "newTypography", "neoBrutalist", "minimalMono", "ultimateFusion"]);

/* ------------------------------------------------------------ the ten */

const HUD = {
  swiss: `
  .lab-hud { color: #000; }
  .lab-hud .lab-id { display: flex; gap: 10px; align-items: baseline; font-size: 12px; font-weight: 700; border-top: 1px solid #000; padding-top: 6px; }
  .lab-hud .lab-id .num { color: var(--accent-primary); }
  .lab-hud .lab-big { font-family: var(--font-display); font-weight: 800; font-size: clamp(64px, 8vw, 112px); line-height: 0.82; letter-spacing: -0.055em; margin: 22px 0 10px; }
  .lab-hud .lab-big small { display: block; font-size: 11px; letter-spacing: 0.02em; font-weight: 700; margin-bottom: 8px; color: var(--text-secondary); }
  .lab-hud .lab-turn { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; border-top: 4px solid var(--accent-primary); padding-top: 8px; margin-bottom: 22px; }
  .lab-hud .lab-turn { animation-name: lab-swiss-wipe; }
  @keyframes lab-swiss-wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
  .lab-hud .lab-stats { border-top: 1px solid #000; padding-top: 10px; margin-bottom: 22px; }
  .lab-hud .lab-stats dd { font-weight: 800; letter-spacing: -0.02em; }
  .lab-hud .lab-log li { border-top: 1px solid rgba(0,0,0,0.18); padding: 5px 0; }
  .lab-hud .lab-log .n { color: var(--accent-primary); }
  .lab-hud .lab-over { font-size: 42px; font-weight: 800; letter-spacing: -0.04em; line-height: 0.9; margin-top: 18px; border-top: 4px solid var(--accent-primary); padding-top: 10px; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud .lab-big { font-size: 40px; margin: 6px 0 0; position: absolute; right: 0; top: 0; } .lab-hud .lab-big small { display: none; } .lab-hud .lab-turn { font-size: 16px; margin-bottom: 8px; } }
  `,
  bauhaus: `
  .lab-hud { text-transform: lowercase; }
  .lab-hud .lab-id { font-size: 12px; font-weight: 600; letter-spacing: 0.16em; display: flex; gap: 8px; align-items: center; }
  .lab-hud .lab-id .num { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--accent-primary); color: var(--surface); }
  .lab-hud .lab-big { margin: 18px 0 14px; width: 128px; height: 128px; border-radius: 50%; background: var(--accent-primary); color: var(--surface);
    display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; font-size: 56px; line-height: 1; box-shadow: 0 8px 18px rgba(31,29,27,0.2); }
  .lab-hud .lab-big small { display: none; }
  .lab-hud .lab-turn { display: inline-block; background: var(--accent-secondary); color: var(--surface); padding: 12px 16px 12px 14px; font-size: 20px; font-weight: 700; margin: -34px 0 16px 76px; position: relative;
    animation-name: lab-bauhaus-drop; }
  .lab-hud[data-player="dark"] .lab-turn { background: var(--piece-primary); }
  @keyframes lab-bauhaus-drop { from { transform: translateY(-14px) rotate(-6deg); opacity: 0; } to { transform: none; opacity: 1; } }
  .lab-hud .lab-swatch { border-radius: 50%; box-shadow: none !important; background: var(--surface) !important; }
  .lab-hud[data-player="light"] .lab-swatch { border-radius: 0; }
  .lab-hud .lab-stats { background: var(--surface); border: 2px solid var(--text-primary); padding: 12px; position: relative; margin-bottom: 16px; }
  .lab-hud .lab-stats::after { content: ""; position: absolute; right: -2px; top: -26px; width: 0; height: 0; border-left: 26px solid transparent; border-bottom: 26px solid var(--accent-tertiary); }
  .lab-hud .lab-log { border-left: 10px solid var(--accent-tertiary); padding-left: 10px; }
  .lab-hud .lab-log li { padding: 3px 0; }
  .lab-hud .lab-log .p[data-p="dark"] { border-radius: 50%; }
  .lab-hud .lab-over { margin-top: 14px; background: var(--accent-tertiary); color: var(--text-primary); padding: 14px; font-size: 26px; font-weight: 800; clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%); }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud .lab-big { width: 58px !important; height: 58px; font-size: 24px; display: grid !important; place-items: center; text-align: center !important; } .lab-hud .lab-turn { margin: 6px 0 8px; font-size: 15px; padding: 7px 10px; } .lab-hud .lab-stats { padding: 7px; } .lab-hud .lab-stats::after { display: none; } }
  `,
  destijl: `
  .lab-hud { display: grid; grid-template-columns: 1.6fr 1fr; gap: 7px; background: #0E0E0E; padding: 7px; }
  .lab-hud > * { background: #FFFFFF; padding: 10px; margin: 0; }
  .lab-hud .lab-id { grid-column: 1 / -1; font-family: var(--font-display); font-size: 12px; display: flex; gap: 10px; }
  .lab-hud .lab-id .num { color: var(--accent-primary); }
  .lab-hud .lab-big { background: var(--accent-primary); color: #FFF; font-family: var(--font-display); font-size: 44px; line-height: 1; display: grid; align-content: end; min-height: 108px; }
  .lab-hud .lab-big small { font-family: var(--font-body); font-size: 10px; letter-spacing: 0.12em; }
  .lab-hud .lab-turn { font-family: var(--font-display); font-size: 13px; display: grid; align-content: center; animation: lab-destijl-steps 400ms steps(4, end) both; }
  .lab-hud[data-player="light"] .lab-turn { background: var(--accent-secondary); color: #FFF; }
  @keyframes lab-destijl-steps { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0); } }
  .lab-hud .lab-stats { grid-column: 1 / -1; }
  .lab-hud .lab-stats dd { font-family: var(--font-display); font-size: 17px; font-weight: 400; }
  .lab-hud .lab-log { grid-column: 1 / 2; }
  .lab-hud .lab-note { background: var(--accent-tertiary); grid-column: 2 / 3; }
  .lab-hud .lab-log li { font-size: 12px; padding: 2px 0; }
  .lab-hud .lab-over { grid-column: 1 / -1; background: var(--accent-tertiary); font-family: var(--font-display); font-size: 20px; }
  .lab-hud:not([data-status="finished"]) .lab-over { display: none; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud { grid-template-columns: auto 1fr; } .lab-hud .lab-big { min-height: 0; font-size: 26px; } .lab-hud .lab-id { display: none; } .lab-hud > * { padding: 6px 8px; } }
  `,
  elementarism: `
  .lab-hud { transform: rotate(-6deg); transform-origin: 0 0; top: 96px; color: var(--text-primary); }
  .lab-hud .lab-id { font-family: var(--font-display); font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; display: flex; gap: 10px; }
  .lab-hud .lab-id .num { color: var(--accent-primary); }
  .lab-hud .lab-big { font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: clamp(72px, 9vw, 120px); line-height: 0.8; margin: 14px 0 6px; transform: skewX(-12deg);
    background: linear-gradient(135deg, transparent 0 46%, var(--accent-primary) 46% 54%, transparent 54%); padding: 6px 0; }
  .lab-hud .lab-big small { display: block; font-size: 11px; font-style: normal; letter-spacing: 0.22em; color: var(--text-secondary); }
  .lab-hud .lab-turn { background: var(--surface); padding: 10px 28px 10px 14px; font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    clip-path: polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%); border-left: 4px solid var(--accent-primary); margin-bottom: 14px; animation-name: lab-elem-slide; }
  @keyframes lab-elem-slide { from { transform: translate(-30px, 30px); opacity: 0; } to { transform: none; opacity: 1; } }
  .lab-hud .lab-stats { background: rgba(46,53,61,0.85); padding: 12px 14px; clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%); margin-bottom: 14px; }
  .lab-hud .lab-stats dd { font-family: var(--font-display); font-size: 22px; }
  .lab-hud .lab-log li { border-bottom: 1px solid rgba(201,210,219,0.18); padding: 4px 0; transform: skewX(-8deg); }
  .lab-hud .lab-log .n { color: var(--accent-primary); font-family: var(--font-display); }
  .lab-hud .lab-over { font-family: var(--font-display); font-size: 40px; font-weight: 800; font-style: italic; text-transform: uppercase; color: var(--accent-primary); margin-top: 10px; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud { transform: rotate(-3deg); top: 72px; } .lab-hud .lab-big { font-size: 40px; } .lab-hud .lab-turn { font-size: 15px; padding: 6px 22px 6px 10px; margin-bottom: 6px; } }
  `,
  brutalist: `
  .lab-hud { text-transform: uppercase; font-family: var(--font-mono); }
  .lab-hud > * { background: var(--surface); border: 4px solid #111; box-shadow: 8px 8px 0 #111; margin: 0 0 14px; padding: 10px 12px; }
  .lab-hud .lab-id { font-size: 12px; font-weight: 800; display: flex; justify-content: space-between; background: #111; color: var(--surface); }
  .lab-hud .lab-id::before { content: "[SYS]"; }
  .lab-hud .lab-big { font-size: clamp(56px, 7vw, 96px); font-weight: 800; line-height: 0.85; letter-spacing: -0.06em; }
  .lab-hud .lab-big small { display: block; font-size: 11px; letter-spacing: 0.04em; margin-bottom: 4px; }
  .lab-hud .lab-big small::before { content: "[TURN] "; }
  .lab-hud .lab-turn { font-size: 18px; font-weight: 800; background: var(--accent-secondary); color: #111; animation-name: lab-brutal-slam; }
  @keyframes lab-brutal-slam { from { transform: translate(-8px, -8px); box-shadow: 16px 16px 0 #111; } to { transform: none; } }
  .lab-hud .lab-stats dt { font-size: 10.5px; }
  .lab-hud .lab-stats dd { font-size: 22px; font-weight: 800; }
  .lab-hud .lab-log li { border-bottom: 2px solid #111; padding: 3px 0; font-size: 12px; }
  .lab-hud .lab-log li:last-child { border-bottom: 0; }
  .lab-hud .lab-over { font-size: 30px; font-weight: 800; background: #111; color: var(--accent-secondary); }
  .lab-hud:not([data-status="finished"]) .lab-over { display: none; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud > * { margin-bottom: 8px; padding: 6px 8px; box-shadow: 5px 5px 0 #111; border-width: 3px; } .lab-hud .lab-big { font-size: 34px; padding: 4px 8px; } .lab-hud .lab-id { display: none; } }
  `,
  newTypography: `
  .lab-hud { width: clamp(220px, 23vw, 320px); }
  .lab-hud .lab-id { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 3px solid #141210; padding-bottom: 6px; display: flex; justify-content: space-between; }
  .lab-hud .lab-id .num { color: var(--accent-primary); }
  .lab-hud .lab-big { font-family: var(--font-display); font-weight: 900; font-stretch: 62%; font-size: clamp(110px, 13vw, 200px); line-height: 0.76; letter-spacing: -0.05em; margin: 10px 0 0; }
  .lab-hud .lab-big small { display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; font-stretch: 100%; text-transform: uppercase; color: var(--accent-primary); margin-bottom: 6px; }
  .lab-hud .lab-turn { font-weight: 900; font-stretch: 125%; font-size: 17px; text-transform: uppercase; letter-spacing: 0.02em; background: var(--accent-primary); color: var(--bg-primary); padding: 6px 10px; display: inline-block; margin: 10px 0 18px; animation-name: lab-nt-set; }
  @keyframes lab-nt-set { from { letter-spacing: 0.6em; opacity: 0; } to { letter-spacing: 0.02em; opacity: 1; } }
  .lab-hud .lab-stats { grid-template-columns: repeat(3, 1fr); border-top: 1px solid #141210; border-bottom: 1px solid #141210; padding: 8px 0; margin-bottom: 18px; }
  .lab-hud .lab-stats dd { font-weight: 900; font-size: 22px; }
  .lab-hud .lab-log li { grid-template-columns: 2.4em 1fr; border-bottom: 1px solid rgba(20,18,16,0.25); padding: 6px 0; }
  .lab-hud .lab-log .n { font-weight: 900; font-stretch: 62%; font-size: 30px; line-height: 0.9; letter-spacing: -0.04em; }
  .lab-hud .lab-log li:first-child .n { color: var(--accent-primary); }
  .lab-hud .lab-over { font-weight: 900; font-stretch: 62%; font-size: 64px; line-height: 0.85; letter-spacing: -0.04em; border-top: 8px solid var(--accent-primary); padding-top: 8px; margin-top: 10px; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud .lab-big { font-size: 64px; position: absolute; right: 0; top: 0; } .lab-hud .lab-big small { display: none; } .lab-hud .lab-turn { font-size: 13px; margin: 6px 0 6px; } .lab-hud .lab-stats { grid-template-columns: repeat(3, auto); gap: 4px 18px; } .lab-hud .lab-stats dd { font-size: 16px; } }
  `,
  corporateSwiss: `
  .lab-hud { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .lab-hud > * { background: var(--surface); border: 1px solid #5E6E88; border-radius: 2px; padding: 8px 10px; margin: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.45); }
  .lab-hud .lab-id { grid-column: 1 / -1; display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-secondary); border-top: 3px solid var(--accent-primary); }
  .lab-hud .lab-id .num { color: var(--accent-primary); }
  .lab-hud .lab-big, .lab-hud .lab-turn { font-family: var(--font-mono); }
  .lab-hud .lab-big small, .lab-hud .lab-turn small { display: block; font-family: var(--font-body); font-size: 10px; letter-spacing: 0.18em; color: var(--accent-primary); margin-bottom: 5px; text-transform: uppercase; }
  .lab-flap { display: inline-flex; gap: 2px; }
  .lab-flap b { display: inline-grid; place-items: center; min-width: 0.78em; padding: 1px 2px; background: #0A1424; color: #F2F4F7; border-radius: 2px; position: relative; font-weight: 400; line-height: 1.15; }
  .lab-flap b::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,0.75); }
  .lab-hud .lab-big .lab-flap { font-size: 34px; }
  .lab-hud .lab-turn .lab-flap { font-size: 22px; }
  .lab-hud .lab-turn .lab-flap b { animation: lab-flap 340ms var(--ease) both; transform-origin: 50% 50%; }
  .lab-hud .lab-turn .lab-flap b:nth-child(2) { animation-delay: 40ms; } .lab-hud .lab-turn .lab-flap b:nth-child(3) { animation-delay: 80ms; }
  .lab-hud .lab-turn .lab-flap b:nth-child(4) { animation-delay: 120ms; } .lab-hud .lab-turn .lab-flap b:nth-child(5) { animation-delay: 160ms; }
  @keyframes lab-flap { 0% { transform: rotateX(90deg); } 60% { transform: rotateX(-20deg); } 100% { transform: rotateX(0); } }
  .lab-hud .lab-stats { grid-column: 1 / -1; grid-template-columns: repeat(3, 1fr); gap: 8px 10px; }
  .lab-hud .lab-stats dt { font-size: 9.5px; color: var(--accent-primary); }
  .lab-hud .lab-stats dd { font-family: var(--font-mono); font-weight: 400; font-size: 19px; }
  .lab-hud .lab-log { grid-column: 1 / -1; }
  .lab-hud .lab-log li { grid-template-columns: 2.6em 1fr; font-family: var(--font-mono); font-size: 13px; border-bottom: 1px solid rgba(143,163,196,0.2); padding: 3px 0; }
  .lab-hud .lab-log .n { color: var(--accent-primary); font-weight: 400; }
  .lab-hud .lab-over { grid-column: 1 / -1; background: var(--accent-primary); color: #0F1D33; font-family: var(--font-mono); font-size: 22px; }
  .lab-hud:not([data-status="finished"]) .lab-over { display: none; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud { grid-template-columns: auto auto 1fr; } .lab-hud .lab-id { display: none; } .lab-hud .lab-big .lab-flap { font-size: 20px; } .lab-hud .lab-turn .lab-flap { font-size: 15px; } .lab-hud .lab-stats { grid-column: 3 / 4; grid-template-columns: repeat(3, auto); } .lab-hud > * { padding: 5px 7px; } }
  `,
  neoBrutalist: `
  .lab-hud > * { background: #FFF; border: 3px solid #000; border-radius: 10px; box-shadow: 5px 5px 0 #000; padding: 12px 14px; margin: 0 0 14px; }
  .lab-hud .lab-id { display: inline-flex; gap: 8px; align-items: center; background: var(--accent-tertiary); font-weight: 800; text-transform: uppercase; font-size: 13px; transform: rotate(-3deg); padding: 6px 12px; }
  .lab-hud .lab-id .num { background: #000; color: #FFF; border-radius: 999px; padding: 1px 8px; }
  .lab-hud .lab-big { font-family: var(--font-display); font-size: clamp(56px, 7vw, 92px); line-height: 0.9; background: var(--accent-secondary); color: #FFF; -webkit-text-stroke: 2px #000; paint-order: stroke fill; }
  .lab-hud .lab-big small { display: block; font-family: var(--font-body); font-size: 12px; font-weight: 800; -webkit-text-stroke: 0; color: #FFF; text-transform: uppercase; }
  .lab-hud .lab-turn { font-family: var(--font-display); font-size: 22px; text-transform: uppercase; animation-name: lab-neo-pop; }
  .lab-hud[data-player="dark"] .lab-turn { background: var(--piece-primary); } .lab-hud[data-player="light"] .lab-turn { background: var(--piece-secondary); }
  @keyframes lab-neo-pop { 0% { transform: scale(0.8); box-shadow: 0 0 0 #000; } 70% { transform: scale(1.06); } 100% { transform: none; } }
  .lab-hud .lab-swatch { border: 2px solid #000; border-radius: 4px; box-shadow: none !important; }
  .lab-hud .lab-stats { background: #B6F2D2; }
  .lab-hud .lab-stats dt { color: #000; font-weight: 800; }
  .lab-hud .lab-stats dd { font-weight: 800; }
  .lab-hud .lab-log li { padding: 4px 0; border-bottom: 2px dashed #000; }
  .lab-hud .lab-log li:last-child { border-bottom: 0; }
  .lab-hud .lab-log .p { border: 2px solid #000; border-radius: 3px; box-shadow: none !important; }
  .lab-hud .lab-over { font-family: var(--font-display); font-size: 30px; background: var(--accent-primary); transform: rotate(2deg); }
  .lab-hud:not([data-status="finished"]) .lab-over { display: none; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud > * { padding: 6px 9px; margin-bottom: 8px; box-shadow: 3px 3px 0 #000; } .lab-hud .lab-id { display: none; } .lab-hud .lab-big { font-size: 32px; padding: 4px 8px; text-align: center !important; } .lab-hud .lab-turn { font-size: 15px; } }
  `,
  minimalMono: `
  .lab-hud { color: #000; opacity: 0.9; width: 200px; font-weight: 300; }
  .lab-hud[data-focus="selected"] { opacity: 0.28; }
  .lab-hud .lab-id { font-family: var(--font-mono); font-size: 11px; color: rgba(0,0,0,0.4); letter-spacing: 0.2em; text-transform: lowercase; display: flex; gap: 12px; }
  .lab-hud .lab-big { font-family: var(--font-mono); font-size: 44px; font-weight: 300; margin: 26px 0 4px; letter-spacing: -0.02em; }
  .lab-hud .lab-big small { display: block; font-size: 10px; color: rgba(0,0,0,0.35); letter-spacing: 0.2em; }
  .lab-hud .lab-turn { font-size: 13px; letter-spacing: 0.2em; text-transform: lowercase; margin-bottom: 26px; }
  .lab-hud .lab-swatch { width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1px #000 !important; }
  .lab-hud .lab-stats { grid-template-columns: 1fr 1fr; gap: 12px 18px; }
  .lab-hud .lab-stats dt { font-family: var(--font-mono); font-size: 10px; color: rgba(0,0,0,0.35); }
  .lab-hud .lab-stats dd { font-family: var(--font-mono); font-weight: 300; font-size: 15px; }
  .lab-hud .lab-log { margin-top: 26px; }
  .lab-hud .lab-log li { font-family: var(--font-mono); font-size: 11px; color: rgba(0,0,0,0.55); padding: 2px 0; }
  .lab-hud .lab-log li:nth-child(n+4) { display: none; }
  .lab-hud .lab-log .n { font-weight: 400; color: rgba(0,0,0,0.3); }
  .lab-hud .lab-log .p { border-radius: 50%; width: 6px; height: 6px; }
  .lab-hud .lab-over { font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.2em; margin-top: 26px; }
  .lab-hud .lab-turn { animation-duration: 600ms; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud .lab-big { font-size: 22px; position: absolute; right: 0; top: 0; margin: 0; } .lab-hud .lab-big small { display: none; } .lab-hud .lab-turn { margin-bottom: 8px; } .lab-hud .lab-id { display: none; } }
  `,
  ultimateFusion: `
  .lab-hud { background: #1F1F1F; border: 3px solid #EAE6DF; box-shadow: 6px 6px 0 #0A0A0A; padding: 0; width: clamp(220px, 22vw, 300px);
    background-image: radial-gradient(circle, #6d6a64 1.6px, transparent 2px), radial-gradient(circle, #6d6a64 1.6px, transparent 2px), radial-gradient(circle, #6d6a64 1.6px, transparent 2px), radial-gradient(circle, #6d6a64 1.6px, transparent 2px);
    background-size: 12px 12px; background-repeat: no-repeat; background-position: 6px 6px, calc(100% - 6px) 6px, 6px calc(100% - 6px), calc(100% - 6px) calc(100% - 6px); }
  .lab-hud > * { padding: 10px 14px; margin: 0; }
  .lab-hud .lab-id { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; display: flex; justify-content: space-between;
    background: repeating-linear-gradient(-45deg, var(--accent-secondary) 0 10px, #1A1A1A 10px 20px); color: #1A1A1A; padding: 4px 14px; }
  .lab-hud .lab-id span { background: var(--accent-secondary); padding: 0 4px; }
  .lab-hud .lab-big { font-family: var(--font-display); font-weight: 900; font-size: clamp(64px, 8vw, 104px); line-height: 0.82; letter-spacing: -0.05em; border-left: 10px solid var(--accent-primary); }
  .lab-hud .lab-big small { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--text-secondary); margin-bottom: 6px; font-weight: 400; }
  .lab-hud .lab-turn { font-family: var(--font-display); font-weight: 900; font-size: 22px; letter-spacing: -0.02em; background: var(--surface); color: #2B2B2B; border-top: 3px solid #0A0A0A; border-bottom: 3px solid #0A0A0A; animation-name: lab-fusion-slide; }
  @keyframes lab-fusion-slide { from { transform: translateX(-100%); } to { transform: none; } }
  .lab-hud .lab-stats dt { font-family: var(--font-mono); font-size: 9.5px; color: var(--accent-secondary); }
  .lab-hud .lab-stats dd { font-family: var(--font-display); font-weight: 900; font-size: 22px; }
  .lab-hud .lab-log li { font-family: var(--font-mono); font-size: 11.5px; border-top: 1px solid #3a3836; padding: 4px 0; }
  .lab-hud .lab-log .n { color: var(--accent-primary); }
  .lab-hud .lab-over { font-family: var(--font-display); font-weight: 900; font-size: 34px; background: var(--accent-primary); color: var(--surface); letter-spacing: -0.03em; }
  .lab-hud:not([data-status="finished"]) .lab-over { display: none; }
  @media (max-aspect-ratio: 3/2), (max-width: 899px) { .lab-hud { width: auto; } .lab-hud .lab-id { display: none; } .lab-hud .lab-big { font-size: 36px; border-left-width: 6px; padding: 6px 8px 6px 8px; background: #1F1F1F; border: 3px solid #EAE6DF; } .lab-hud .lab-big small { display: none; } .lab-hud > * { padding: 6px 10px; } .lab-hud .lab-turn { font-size: 16px; } }
  `,
};

/* A little per-direction tailoring of the chassis's own controls. */
const CHROME = {
  swiss: `.ec-btn-invert { background: #000 !important; } [data-testid="dock-panel"] { border-top: 4px solid var(--accent-primary) !important; }`,
  bauhaus: `[data-testid="dock-panel"] { border-left: 12px solid var(--accent-primary) !important; } .ec-btn { text-transform: lowercase !important; }`,
  destijl: `[data-testid="dock-panel"] { box-shadow: inset 0 0 0 6px #0E0E0E !important; border: 0 !important; } [data-testid="victory-placard"] { border: 8px solid #0E0E0E !important; } [data-testid="victory-placard"]::before { content: ""; position: absolute; left: 0; top: 0; width: 34%; height: 18px; background: var(--accent-primary); }`,
  elementarism: `[data-testid="dock-panel"] { clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px)); border-left: 3px solid var(--accent-primary) !important; }`,
  brutalist: `.ec-btn { border: 3px solid #111 !important; box-shadow: 4px 4px 0 #111 !important; text-transform: uppercase; } .ec-btn:active { transform: translate(4px, 4px) !important; box-shadow: none !important; } [data-testid="dock-panel"] { border-width: 4px !important; }`,
  newTypography: `[data-testid="dock-panel"] { border-width: 0 0 0 !important; border-top: 6px solid #141210 !important; } .ec-title { font-stretch: 62%; }`,
  corporateSwiss: `[data-testid="dock-panel"] { border-top: 3px solid var(--accent-primary) !important; } [data-testid="points-counter"] [data-filled="true"] { background: var(--accent-primary) !important; }`,
  neoBrutalist: `.ec-btn { border: 3px solid #000 !important; box-shadow: 4px 4px 0 #000 !important; font-weight: 800 !important; } .ec-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #000 !important; } .ec-btn:active { transform: translate(4px, 4px) !important; box-shadow: none !important; } .ec-btn-invert { background: var(--accent-secondary) !important; color: #FFF !important; }`,
  minimalMono: `[data-testid="dock-panel"] { box-shadow: none !important; } .ec-btn { font-weight: 400 !important; } [data-testid="points-counter"] { opacity: 0.55; }`,
  ultimateFusion: `.ec-btn { border: 2px solid #2B2B2B !important; box-shadow: 3px 3px 0 #0A0A0A !important; text-transform: uppercase; } .ec-btn:active { transform: translate(3px, 3px) !important; box-shadow: none !important; } [data-testid="dock-panel"] { border-top: 8px solid var(--accent-primary) !important; } .ec-title { color: var(--surface) !important; }`,
};

export function styleSheetFor(spec) {
  return [`@import url('${spec.typography.url}');`, tokensCss(spec), chromeCss(spec), HUD_BASE, HUD[spec.hud] || "", FLOATS.has(spec.hud) ? COMPACT_FLOAT : "", CHROME[spec.id] || ""].join("\n");
}
