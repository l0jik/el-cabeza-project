import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

import {
  BOARD_ROWS, BOARD_COLS, SLAB_X, SLAB_Z, SLAB_MIN, SQUARE_SIZE, SLAB_THICKNESS, OFF_X, OFF_Z, PIECE_SCALE,
  DISC_DIAM, DISC_H, GHOST_SCALE, GHOST_FADE_MS, ROLL_MS, SLIDE_MS,
  CAMERA_DAMPING, RESET_CAMERA_DAMPING, RESET_TRANSITION_MS,
  ORBIT_SENS_THETA, ORBIT_SENS_PHI, DRAG_DEAD_ZONE_PX, ZOOM_MIN, ZOOM_MAX_FOR_BOARD,
  PIECE_META, GOAL_ROW, STEP_DIRS, INVERSE_DIR, getBoardDimensions,
} from "../engine/constants.js";
import {
  createInitialPieces, rollBlock, legalMovesFor, pairLog, sameState,
} from "../engine/rules.js";
import { findBestAiTurn, AI_DIFFICULTY } from "../engine/ai.js";
import {
  pieceCenter, restingY, makeRoundedBox, rayHitBoardPlaneY0,
  boardVerticalOverlapFraction, clampVerticalTarget, pivotFor,
  setGhostLineTarget,
} from "../engine/geometry.js";

/* Semantic Versioning (MAJOR.MINOR.PATCH), shared by both themes since
   it describes the game as a whole, not any one skin's own history. */
const APP_VERSION = "1.39.0";

/* Builds a clamp() string with all three numbers scaled by a per-theme
   multiplier — used for the masthead's font-size (see its own comment
   at the h1 below). Scales the actual numbers, not a wrapping
   transform:scale(): the latter shrinks the clamp()'s own floor right
   along with everything else, which is exactly the bug a previous pass
   of this same masthead shipped (see ARCHITECTURE.md's "Known
   pitfalls"). floorPx/ceilingPx are bare px numbers, vw is a bare vw
   number; scale defaults to 1 for a theme with no opinion. */
function mastheadClamp(floorPx, vw, ceilingPx, scale) {
  const s = scale || 1;
  return `clamp(${floorPx * s}px, ${vw * s}vw, ${ceilingPx * s}px)`;
}

/* ------------------------------------------------------------------ */
/*  El Cabeza — 3D — shared chassis                                    */
/*                                                                     */
/*  This component is intentionally theme-agnostic: every visual/audio */
/*  decision is delegated to the `theme` prop (see ARCHITECTURE.md for */
/*  the full plugin contract). World axes: +x = columns, +z = rows      */
/*  (south), +y = up.                                                   */
/* ------------------------------------------------------------------ */

export default function ElCabeza3D({ theme, initialMuted = false, onMutedChange }) {
  const { COLORS, HEX, EDGE_RADIUS, modalBackdrop, modalSurface, canvasGradientStart, canvasGradientEnd } = theme;
  /* Display face for the masthead title and modal headers (Move Log,
     the intro panel, the end-of-game banner). Themes without their own
     opinion fall back to Standard's Fraunces — only Neon currently
     overrides this, with Chakra Petch. */
  const titleFontFamily = theme.titleFontFamily || "'Fraunces', serif";

  /* Style helpers — nested here (not module-level) so they close
     over the theme's own COLORS/HEX rather than needing them passed
     as arguments at every call site. */
  const MINI_BUTTON_BASE = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "6px 10px",
    cursor: "pointer",
    border: `1.5px solid ${COLORS.charcoal}`,
  };

  function playerButtonStyle(player) {
    const isDark = player === "dark";
    return {
      ...MINI_BUTTON_BASE,
      // bodyDark/bodyLight, not the raw charcoal/cream ink tokens —
      // Neon's own charcoal/cream are inverted for its dark UI, which
      // would otherwise swap which player's button reads as filled-
      // dark vs filled-light. See the same fix on the move-log column
      // headers.
      background: isDark ? COLORS.bodyDark : COLORS.bodyLight,
      color: isDark ? COLORS.bodyLight : COLORS.bodyDark,
    };
  }

  function ghostButtonStyle() {
    return {
      ...MINI_BUTTON_BASE,
      background: "transparent",
      color: COLORS.slate,
      borderColor: COLORS.slateSoft,
    };
  }

  // Translucent version of a theme hex color, for the dock's glass
  // effect — backdropFilter's blur only reads through a background
  // that isn't fully opaque.
  function hexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* For a row of mutually-exclusive choices (opponent type, difficulty) —
     the selected option reads as filled/committed, the rest sit quiet. */
  function toggleButtonStyle(active) {
    return active
      ? { ...MINI_BUTTON_BASE, background: COLORS.charcoal, color: COLORS.cream }
      : ghostButtonStyle();
  }

  /* For the two compact "AI" opponent buttons — selected reuses the same
     filled player coloring as playerButtonStyle (Stop here uses it too),
     so a glance tells you which side, if any, is AI-controlled without
     needing the label to spell it out. Unselected keeps a hint of the
     color in the text rather than going fully neutral, since "AI" alone
     gives no other way to tell the two buttons apart at rest. */
  /* AI side buttons: pill-shaped, and fully colored for their side at ALL
     times — charcoal-filled/cream-text for Dark, cream-filled/charcoal-
     text-and-border for Light — not just when selected. That persistence
     is the point: a toggle button's fill appears and disappears with
     selection, so it can't double as "this is what Dark/Light actually
     looks like." Selection is communicated purely by opacity, applied at
     the call site, same as every other button in this row.
     The rounded shape is what keeps a solid-charcoal-filled Dark button
     from being visually interchangeable with Human-active — also solid
     charcoal, also cream text, but rectangular. Round reads as "a player-
     color chip" instead, echoing the small circular dots already used for
     exactly that purpose in the status bar and the move record's Dark/
     Light column headers — the same visual idea reused, not a new one. */
  function aiSideButtonStyle(side) {
    const isDark = side === "dark";
    return {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 10,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "6px 14px",
      cursor: "pointer",
      borderRadius: 999,
      border: `1.5px solid ${COLORS.charcoal}`,
      // bodyDark/bodyLight — see the comment on playerButtonStyle above.
      background: isDark ? COLORS.bodyDark : COLORS.bodyLight,
      color: isDark ? COLORS.bodyLight : COLORS.bodyDark,
    };
  }

  const mountRef = useRef(null);
  const three = useRef({});
  const anim = useRef(null);
  // Keyed by piece id -> { pieceRef, mesh, shell }, so the "build pieces"
  // effect below can tell which pieces are untouched since the last render
  // (commitRef's setPieces calls keep the exact same object reference for
  // every piece the move didn't affect — see that function's own comment)
  // and skip disposing/rebuilding their mesh+shell entirely.
  const pieceMeshCacheRef = useRef(new Map());
  const commitRef = useRef(null);
  /* Always-fresh reference to beginMove, reassigned every render (same
     pattern as commitRef). Needed because the AI's continuation logic
     fires from a setTimeout — by the time that callback actually runs,
     a beginMove closure captured at the moment the timer was scheduled
     would still see the stale `busy: true` from the step that's still
     finishing, and its own guard would silently refuse to start the
     next roll. Reading beginMoveRef.current at call time instead always
     gets whatever render most recently ran. */
  const beginMoveRef = useRef(null);
  /* The AI's fully-decided turn for its current move, set once when it
     starts thinking and cleared the moment that turn ends for any
     reason (crush, goal, running out of steps, or the AI choosing to
     stop early). null whenever no AI turn is in flight. */
  const aiDirsRef = useRef(null);
  /* How many of the AI's own most recent consecutive turns moved its
     Cabeza — real history that findBestAiTurn has no other way to see,
     since it only ever looks at the current `pieces` snapshot. Fed into
     findBestAiTurn on every AI decision, then updated right after a
     turn is chosen (see the orchestration effect below); reset to 0 on
     New Game so a fresh game never inherits it from the last one. Only
     Hard difficulty actually reads this (see AI_DIFFICULTY), but it
     costs nothing to keep updated regardless of difficulty. */
  const aiCabezaStreakRef = useRef(0);
  /* Lets a human queue their turn's second input (a continuation
     direction, or a "stop here") WHILE the first step's roll/slide
     animation is still playing, instead of that tap being silently
     dropped until the animation finishes — see beginMove (where this is
     populated) and onUp/the consuming effect below (where it's read).
     inFlightRef describes the step currently animating: the piece it
     belongs to, and — only when a further step is actually possible
     from the resulting position (not a crush/win, and under maxSteps)
     — the second-step candidates a tap can be matched against, computed
     the same way generateTurns/commitRef.current already would, just
     up front rather than waited on. null whenever no step is animating,
     or the one that is can't be continued anyway. pendingIntentRef is
     the single queued action such a tap resolved to (at most one: a
     turn is at most 2 steps, so there's never more than one "next"
     action to remember); consumed and cleared by the effect below the
     moment the animation it was waiting on actually commits. */
  const inFlightRef = useRef(null);
  const pendingIntentRef = useRef(null);
  /* cam.current holds where input WANTS the camera — set instantly and
     directly by drag, wheel, and pinch. The camera actually reads from
     cam.current.view, which chases those goals every frame at a fixed
     rate (see tick()). That separation is what removes the twitchiness:
     without it, every raw pointer sample was applied to the camera
     immediately, so any jitter in the input showed up immediately too. */
  const cam = useRef({
    theta: 0,
    phi: 0.86,
    radius: 17,
    target: new THREE.Vector3(0, 0, 0),
    view: { theta: 0, phi: 0.86, radius: 17, target: new THREE.Vector3(0, 0, 0) },
  });
  /* Current Player View / Top-Down View's own zoom radius, captured
     ONCE per game (see captureViewBaselines, called right when Begin
     Game is pressed) and reused by every later press of either button
     or gesture — never recomputed against whatever the window happens
     to measure at click time. Per feedback: resizing the browser
     window between two presses of the same button used to change its
     framing, because the fit itself (fitRadiusToBoard) measures
     against the LIVE canvas size every time it runs. These hold the
     one-time "absolute" answer instead; recenterView/topDownView read
     from here first and only fall back to a live fit if a ref is
     somehow still null (defensive — Begin Game always populates both
     before either button is ever reachable). Nulled out in handleReset
     so the NEXT game's Begin Game press captures its own fresh
     baseline rather than inheriting the previous game's. */
  const currentPlayerViewRadiusRef = useRef(null);
  const topDownViewRadiusRef = useRef(null);
  /* A performance.now() deadline: while now() is before this, tick()
     uses RESET_CAMERA_DAMPING instead of the normal CAMERA_DAMPING.
     Set once, in handleReset, right when the post-reset camera move
     is kicked off; 0 (its initial value) is always in the past, so
     normal interactive damping is what's active the rest of the time
     with no extra guard needed. */
  const resetTransitionUntilRef = useRef(0);

  const [pieces, setPieces] = useState(createInitialPieces);
  const [currentPlayer, setCurrentPlayer] = useState("dark");
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoverShadow, setHoverShadow] = useState(null);
  const [stepsUsed, setStepsUsed] = useState(0);
  const [turnSnapshot, setTurnSnapshot] = useState(null);
  const [pendingNotation, setPendingNotation] = useState([]);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("playing");
  /* Every completed turn, oldest first, each entry holding full state
     from immediately BEFORE that turn started plus what's needed to
     animate it backward: which piece moved, the direction sequence it
     took, and any piece it crushed (which has to be resurrected, since
     its mesh no longer exists once "build pieces" runs without it).
     Distinct from turnSnapshot, which only covers a turn still in
     progress and is cleared the instant that turn settles.

     This is what powers "Undo Turn": walk back through real game
     history, one full turn at a time, all the way to the start of the
     game if wanted, on either side, against a Human or an AI opponent.
     Captured at every point a turn actually completes (see endTurn,
     and the crush/goal branches in commitRef.current, which bypass
     endTurn entirely) and trimmed from the end as entries are
     consumed by an undo — this is real history, not a single-slot
     snapshot. */
  const [turnHistory, setTurnHistory] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState("");
  /* Opens automatically the moment a game ends (see the effect below),
     not on every render where status happens to already be "finished" —
     the dependency array means it only fires on the actual transition,
     so dismissing the placard (the X, backdrop click, or Escape) sticks
     until New Game, rather than being immediately forced open again. */
  const [showVictoryPlacard, setShowVictoryPlacard] = useState(false);
  useEffect(() => {
    if (status === "finished") setShowVictoryPlacard(true);
  }, [status]);
  /* "Move_Log Copied" feedback after handleCopyLog succeeds — persists
     rather than reverting, so re-opening the Move Log popup later in
     the same game still shows the confirmation from the last copy. */
  const [logCopied, setLogCopied] = useState(false);
  /* Same, for when handleCopyLog's clipboard attempt AND its fallback
     both fail — a visible signal on failure, not just the button
     silently staying at "Copy Move_Log" forever, which reads
     identically to the button being broken. Reverts on its own after a
     couple seconds, since a failure is worth retrying rather than
     permanently displaying. */
  const [logCopyFailed, setLogCopyFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  /* null = two-player. "dark"/"light" = that color is AI-controlled. */
  const [aiPlayer, setAiPlayer] = useState(null);
  /* Which of the opponent row's two sub-views is showing — decoupled
     from aiPlayer itself so the Back control can return to the
     Human/AI-side picker WITHOUT resetting the actual selection. Picking
     an AI side sets this false (collapsing to the Back+Difficulty
     view); Back sets it true again, leaving aiPlayer exactly as it was
     so the picker shows whichever side was actually chosen, still
     selected, letting a player go back purely to CONFIRM the choice
     rather than starting over. */
  const [showOpponentPicker, setShowOpponentPicker] = useState(true);
  /* Null, or "dark"/"light" for ~1.3s right after that side is picked —
     drives the brief confirmation overlay over the dock panel (see its
     own render below) so picking an AI side reads as an obvious,
     unmistakable choice rather than a quiet toggle that only shows up
     as a state change in the collapsed Back+Difficulty row above it. */
  const [aiJustSelected, setAiJustSelected] = useState(null);
  useEffect(() => {
    if (!aiJustSelected) return;
    const timer = setTimeout(() => setAiJustSelected(null), 1300);
    return () => clearTimeout(timer);
  }, [aiJustSelected]);
  /* Which color moves first in Human vs Human games — toggled by
     re-clicking the already-selected Human button (see the opponent
     row below). Only read at New Game, when aiPlayer is guaranteed
     null (New Game always lands back in Human mode), so it never needs
     to be reconciled against an AI-opponent choice; AI games keep
     their existing fixed Dark-first behavior regardless of this. Left
     unreset by New Game itself — it's a standing preference, same as
     aiDifficulty. */
  const [humanStartSide, setHumanStartSide] = useState("dark");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiThinking, setAiThinking] = useState(false);
  /* Every game — Human vs Human included — now needs an explicit Begin
     Game press before anything can move, not just an AI-opponent game.
     Nothing is allowed to act (not the AI, not a human click, not even
     Dark moving first) until the person presses it — see selectOpponent
     and handleReset, which both re-arm this to false, and the Begin
     Game button itself, which is the only thing that sets it true. */
  const [gameArmed, setGameArmed] = useState(false);
  const awaitingBegin = !gameArmed;

  /* Easter egg: clicking the "EL CABEZA" title (only the text itself,
     not the header around it) reveals a small INFO button that fades in
     next to it, stays for 4 seconds, then fades back out — see
     handleTitleClick below and infoBtnTimerRef. Clicking INFO opens the
     about-the-game overlay. */
  const [infoBtnVisible, setInfoBtnVisible] = useState(false);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const infoBtnTimerRef = useRef(null);

  /* --------------------- theme plugin wiring ---------------------- */
  /* Audio: every theme exports createAudio() returning the same fixed
     set of methods (see ARCHITECTURE.md) — Standard's are all no-ops,
     Neon's is the real Web Audio engine. The chassis calls these
     unconditionally at the same game-event sites regardless of which
     theme is mounted. */
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = theme.createAudio();
    // The unified app remounts this whole component (key={themeName})
    // on every theme switch, which would otherwise silently drop the
    // mute preference along with the rest of this component's state —
    // a fresh engine always starts unmuted internally regardless of
    // what initialMuted says, so that has to be applied explicitly
    // here, once, right when the engine is actually created.
    if (initialMuted) audioRef.current.setMuted(true);
  }

  /* Ambient visual FX (title flicker, VHS glitch, arcs, etc. — entirely
     theme-owned, see themes/neon.js's mountAmbientEffects). Standard
     has nothing to attach, so its own mountAmbientEffects returns
     no-ops; the chassis never branches on which theme is active. */
  const ambientRef = useRef(null);

  /* Refs the chassis always creates and passes to theme.mountAmbientEffects
     — a theme with nothing to attach to a given ref simply never reads
     it. Kept in the chassis (not the theme) because these point at DOM
     nodes the chassis itself renders. */
  const titleRef = useRef(null);
  const titleWrapRef = useRef(null);
  // Inner sibling of titleWrapRef, holding just the h1/Info button —
  // themes' glitch effects (jitter, vertical-hold) that animate a CSS
  // `transform` on the masthead target THIS ref, not titleWrapRef.
  // titleWrapRef's own transform is React-controlled (its position/
  // scale for the setup vs. relocated-corner-badge states) and a CSS
  // animation on the SAME property completely overrides an inline
  // style for the animated element — so a jitter used to blow away
  // the corner badge's scale(0.3) for its own duration, snapping the
  // whole badge to full size and back and moving its actual clickable
  // area out from under the cursor. Splitting position and effects
  // across parent/child lets both transforms compose normally instead
  // of fighting over one property on one element.
  const titleFxRef = useRef(null);
  const turnHaloRef = useRef(null);
  const turnLabelRef = useRef(null);
  const cardRef = useRef(null);
  const moveLogScrollRef = useRef(null);
  const fxOverlayRef = useRef(null);

  /* ------------------- Dock piece (idle 3D preview) ------------------
     The dock has three views (dockView): "piece" (a small, always-
     spinning 3D render of that session's randomly-chosen Cabeza-set
     piece — one of the five real piece types, built with the exact
     same theme.buildPieceVisual()/engine proportions the real board
     uses, just standing alone in its own tiny scene), "panel" (today's
     actual controls), and "corner" (the same piece, shrunk and faded
     into a bottom-right watermark once a game is under way). A single
     click/tap on the piece opens "panel" right away in "piece" view;
     in "corner" view that same single click/tap still works, but so
     does a shorter hover/hold (see handleDockPieceHoverStart) so the
     tiny post-game watermark stays reachable without needing a precise
     click. Begin Game reverses that (panel
     -> piece -> corner, on a short delay so the remorph is visible
     before it relocates). A fresh game (awaitingBegin true again) snaps
     straight back to "piece" and re-rolls which piece/color represents
     the new session (see the dockSessionSeed effect below). */
  const [dockView, setDockView] = useState("piece"); // "piece" | "panel" | "corner"
  // Always-fresh reference to dockView, reassigned every render (same
  // pattern as commitRef/beginMoveRef) — read by the dock preview's own
  // mount-once render loop below to skip rendering while "panel" makes
  // that canvas fully invisible (opacity 0, see its own style below)
  // rather than adding dockView to that effect's deps, which would tear
  // down and rebuild the whole mini scene on every dock open/close.
  const dockViewRef = useRef(dockView);
  dockViewRef.current = dockView;
  const dockPieceMountRef = useRef(null);
  const dockPieceRef = useRef(null); // { scene, camera, renderer, pieceGroup, spin, velocity, dragging, bouncing }
  const dockDragRef = useRef({ dragging: false, lastX: 0, lastY: 0, lastT: 0 });
  // Fraction (0.4-1) of the dock frame this session's piece type/
  // orientation actually occupies — see the mesh-building effect
  // below, where it's computed from the piece's own true proportions.
  // Sizes the pointer-hit target (dockHitStyle), not the canvas.
  const [dockHitFraction, setDockHitFraction] = useState(1);
  // Post-Begin-Game, the dock lives as a small corner watermark rather
  // than the pre-game centered piece — opening it there is deliberately
  // gated behind a hover/hold (see handleDockPieceHoverStart) instead of
  // a click, so it can't be triggered by an incidental tap mid-play.
  const dockHoverTimerRef = useRef(null);
  const clearDockHoverTimer = useCallback(() => {
    if (dockHoverTimerRef.current) {
      clearTimeout(dockHoverTimerRef.current);
      dockHoverTimerRef.current = null;
    }
  }, []);

  /* One representative orientation per piece type — just enough to
     render a recognizable, correctly-proportioned standalone model;
     not the full board-placement orientation logic (that stays
     theme-owned for Anomaly). Kept here, theme-agnostic, because
     Standard has no orientation table of its own (no Anomaly button to
     need one) but still needs to render every piece shape in its dock. */
  const DOCK_PIECE_ORIENTATIONS = {
    cabeza: { w: 1, h: 1, z: 1 },
    turrito: { w: 1, h: 1, z: 1 },
    opa: { w: 2, h: 2, z: 2 },
    flaco: { w: 1, h: 1, z: 2 },
    chato: { w: 2, h: 2, z: 1 },
  };
  const DOCK_PIECE_TYPES = Object.keys(DOCK_PIECE_ORIENTATIONS);
  // The single largest dimension any dock piece can ever present (Opa,
  // Flaco, and Chato all tie at 2 units on their longest axis) — see
  // the mesh-building effect below, where this replaces normalizing
  // every piece type to the SAME apparent size regardless of which one
  // got rolled.
  const DOCK_PIECE_LARGEST_DIM = Math.max(
    DISC_DIAM,
    ...Object.values(DOCK_PIECE_ORIENTATIONS).map((o) => Math.max(o.w, o.h, o.z))
  );

  /* That session's randomly-chosen piece type, and which color sits
     closest to the viewer on the pre-game board (see the heading effect
     below) — both re-rolled once per fresh session, not on every
     render. dockSessionColor (for Human-vs-Human, where there's no
     single "your side" to match the dock to) is no longer its own
     independent roll: it's ALWAYS whichever color is NOT sitting near
     the viewer this session, so the dock piece reads as "the far
     side's" — the near/far split is the one thing actually decided at
     random, and the dock just follows it. In an AI-opponent game the
     dock's color instead tracks humanStartSide live (see the mesh-
     building effect below), so dockSessionColor is only ever actually
     used while aiPlayer is null. */
  const [dockSessionPieceType, setDockSessionPieceType] = useState(
    () => DOCK_PIECE_TYPES[Math.floor(Math.random() * DOCK_PIECE_TYPES.length)]
  );
  const [boardNearSide, setBoardNearSide] = useState(
    () => (Math.random() < 0.5 ? "dark" : "light")
  );
  const dockSessionColor = boardNearSide === "dark" ? "light" : "dark";

  /* Orients the pre-game board to match boardNearSide the moment a fresh
     setup screen is shown — theta 0 is Dark-top/Light-bottom (Light
     near the viewer) and Math.PI is the reverse (see recenterView/
     topDownView's own comments on this same convention), so this just
     picks whichever heading puts boardNearSide at the bottom. Written
     directly to both cam.current and its eased view, not just the goal,
     so the very first frame already shows the rolled side near — a
     fresh setup screen should never visibly spin into place. */
  useEffect(() => {
    if (!awaitingBegin) return;
    const theta = boardNearSide === "dark" ? Math.PI : 0;
    cam.current.theta = theta;
    cam.current.view.theta = theta;
  }, [boardNearSide, awaitingBegin]);

  useEffect(() => {
    if (awaitingBegin) setDockView("piece");
  }, [awaitingBegin]);

  // A fresh session (New Game, or switching opponent type) re-rolls
  // which piece type the dock piece represents and which color sits
  // near the viewer, same moment it snaps back to "piece" above. The
  // very first mount already got its roll from the useState initializers
  // above, so this only fires on actual return-to-awaitingBegin transitions.
  const dockSessionMountedRef = useRef(false);
  useEffect(() => {
    if (!dockSessionMountedRef.current) {
      dockSessionMountedRef.current = true;
      return;
    }
    if (!awaitingBegin) return;
    setDockSessionPieceType(DOCK_PIECE_TYPES[Math.floor(Math.random() * DOCK_PIECE_TYPES.length)]);
    setBoardNearSide(Math.random() < 0.5 ? "dark" : "light");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingBegin]);

  useEffect(() => {
    if (awaitingBegin) return; // handled by the effect above instead
    // Begin Game just fired: remorph back to the piece, then — once
    // that's had a moment to actually read as "the panel became the
    // piece again" — relocate it to the corner watermark. Cut from 900ms
    // per feedback that the whole hand-off read as sluggish; see
    // dockPieceStyle below for the matching cut to the move itself.
    setDockView("piece");
    const t = setTimeout(() => setDockView("corner"), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameArmed]);

  const prevDockViewRef = useRef(dockView);
  useEffect(() => {
    const prev = prevDockViewRef.current;
    prevDockViewRef.current = dockView;
    if (prev === dockView) return;
    if (dockView === "panel") audioRef.current.playDockOpen();
    else if (prev === "panel") audioRef.current.playDockClose();
  }, [dockView]);

  // The panel — however it got opened, double-tapping the pre-game
  // piece or the mid-game corner watermark alike — can also be
  // dismissed by clicking anywhere outside it, a lighter-weight way out
  // than Begin Game (which still starts the game, not just closes the
  // panel). Returns to whichever non-panel view was showing before:
  // "piece" pre-game, "corner" once a game is under way.
  useEffect(() => {
    if (dockView !== "panel") return;
    const onPointerDown = (ev) => {
      if (cardRef.current && !cardRef.current.contains(ev.target)) {
        setDockView(awaitingBegin ? "piece" : "corner");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dockView, awaitingBegin]);

  // Bounces the piece (a quick decaying squash/stretch on its group
  // scale), then opens the panel once the bounce settles. Squashes
  // around the piece's own base scale (see pieceBaseScale in the
  // mesh-building effect below) rather than 1 — every piece type is
  // normalized to a consistent apparent size in this tiny preview, so
  // bouncing back to a bare 1 would visibly snap a smaller/larger piece
  // to the wrong size for one frame.
  const triggerDockBounce = useCallback(() => {
    const state = dockPieceRef.current;
    if (!state || state.bouncing) return;
    state.bouncing = true;
    const start = performance.now();
    const DUR = 260;
    const base = state.pieceBaseScale || 1;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const s = 1 + Math.sin(t * Math.PI) * 0.24 * (1 - t);
      state.pieceGroup.scale.set((base / Math.sqrt(s)), base * s, (base / Math.sqrt(s)));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        state.pieceGroup.scale.set(base, base, base);
        state.bouncing = false;
        setDockView("panel");
      }
    };
    requestAnimationFrame(tick);
  }, []);

  // True when ev lands inside a box centered on the mount element,
  // sized to dockHitFraction of its full box — the actual per-piece
  // "trigger" hitbox (see the field comment on dockHitFraction). The
  // mount element itself (and its canvas) stay full-size/undistorted;
  // only which pointer events count as "on the piece" for OPENING the
  // dock shrinks or grows with it. Drag-to-spin deliberately still
  // works from anywhere on the full canvas — this only gates the
  // open-trigger checks below, not the drag physics.
  const isInsideDockHitbox = useCallback((ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const halfW = (rect.width * dockHitFraction) / 2, halfH = (rect.height * dockHitFraction) / 2;
    return Math.abs(ev.clientX - cx) <= halfW && Math.abs(ev.clientY - cy) <= halfH;
  }, [dockHitFraction]);

  // Hovering the corner watermark (mouse) or holding it (touch, which
  // has no hover) for 0.5s opens the dock — see the field comment on
  // dockHoverTimerRef. This is IN ADDITION to a plain single click/tap
  // (see handleDockPiecePointerUp below), not instead of it — the
  // watermark is small, so a quick, deliberate hover/hold is offered as
  // an easier-to-land alternative to hitting its exact hitbox. No-ops
  // outside the "corner" view; a pointerup or pointerleave before the
  // timer fires cancels it (see handleDockPiecePointerUp below).
  // Deliberately NOT gated by isInsideDockHitbox: the corner watermark
  // is already small (100x88) and semi-transparent, so per-piece
  // hitbox precision belongs on the deliberate CLICK (see
  // isInsideDockHitbox) rather than this passive hover trigger —
  // shrinking an already-tiny hover target further for the smallest
  // piece types reintroduces exactly the "too small/sensitive"
  // complaint this gesture exists to avoid.
  const handleDockPieceHoverStart = useCallback((ev) => {
    if (dockView !== "corner" || dockHoverTimerRef.current) return;
    dockHoverTimerRef.current = setTimeout(() => {
      dockHoverTimerRef.current = null;
      triggerDockBounce();
    }, 500);
  }, [dockView, triggerDockBounce]);

  const handleDockPiecePointerDown = useCallback((ev) => {
    const state = dockPieceRef.current;
    if (!state) return;
    state.dragging = true;
    dockDragRef.current = { dragging: true, lastX: ev.clientX, lastY: ev.clientY, lastT: performance.now() };
    if (ev.currentTarget.setPointerCapture) {
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    ev.currentTarget.style.cursor = "grabbing";
    // Touch has no real hover, so pointerdown doubles as the start of
    // the corner watermark's hold-to-open timer (see
    // handleDockPieceHoverStart) — a no-op everywhere else.
    handleDockPieceHoverStart(ev);
  }, [handleDockPieceHoverStart]);

  const handleDockPiecePointerMove = useCallback((ev) => {
    const drag = dockDragRef.current;
    const state = dockPieceRef.current;
    if (!drag.dragging || !state) return;
    const now = performance.now();
    const dt = Math.max((now - drag.lastT) / 1000, 1 / 120);
    const dx = ev.clientX - drag.lastX;
    const dy = ev.clientY - drag.lastY;
    state.pieceGroup.rotation.y += dx * 0.012;
    state.pieceGroup.rotation.x += dy * 0.012;
    // "Speed physics": velocity tracks how fast the drag is actually
    // moving, not just how far — a quick flick keeps spinning briefly
    // after release, a slow drag doesn't.
    state.velocity.y = (dx * 0.012) / dt;
    state.velocity.x = (dy * 0.012) / dt;
    // A real drag (as opposed to the tiny jitter under a stationary
    // tap) shouldn't also count as half of a double-tap — see the
    // guard in handleDockPiecePointerUp.
    if (Math.abs(dx) + Math.abs(dy) > 4) state.draggedFar = true;
    drag.lastX = ev.clientX;
    drag.lastY = ev.clientY;
    drag.lastT = now;
  }, []);

  const handleDockPiecePointerUp = useCallback((ev) => {
    const drag = dockDragRef.current;
    const state = dockPieceRef.current;
    drag.dragging = false;
    if (state) state.dragging = false;
    if (ev.currentTarget.style) ev.currentTarget.style.cursor = "grab";
    // A touch contact ending early (before the hover-hold timer below
    // fires) must not still open the dock later — see
    // handleDockPieceHoverStart.
    clearDockHoverTimer();
    // Single click/tap opens the dock in either "piece" (the pre-game
    // centered piece) or "corner" (the post-Begin-Game watermark) view,
    // but only when it actually lands on the piece's own hitbox (see
    // isInsideDockHitbox) — not anywhere on the fixed-size canvas
    // around it. The corner watermark ALSO opens via a shorter hover/
    // hold (see handleDockPieceHoverStart) for when landing that click
    // precisely is inconvenient mid-play; this is simply the other way
    // in, not a replacement for it. Skipped entirely if this pointer-up
    // ended an actual drag (see handleDockPiecePointerMove).
    if ((!state || !state.draggedFar) && isInsideDockHitbox(ev)) {
      triggerDockBounce();
    }
    if (state) state.draggedFar = false;
  }, [triggerDockBounce, clearDockHoverTimer, isInsideDockHitbox]);

  // Mount-once: the dock piece's own tiny Three.js scene, entirely
  // independent of the main board's renderer/camera.
  useEffect(() => {
    const mount = dockPieceMountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.55, 3.4);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.dataset.testid = "dock-piece-canvas";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-3, 1.5, -2);
    scene.add(fill);

    const pieceGroup = new THREE.Group();
    scene.add(pieceGroup);

    function resize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const state = {
      scene, camera, renderer, pieceGroup,
      // Normalizes whichever piece type this session rolled to a
      // consistent apparent size in this tiny, fixed-camera preview —
      // see the mesh-building effect below, which sets this every time
      // it (re)builds the mesh. Defaults to 1 (the disc's own natural
      // size) until that effect has run at least once.
      pieceBaseScale: 1,
      // Baseline idle angular velocity per axis (rad/s) — re-wandered
      // continuously below rather than held fixed, so the idle spin
      // reads as "meandering" instead of a flat, predictable spin.
      spin: { x: 0.15, y: 0.22, z: 0.08 },
      velocity: { x: 0.15, y: 0.22, z: 0.08 },
      dragging: false,
      bouncing: false,
      draggedFar: false,
    };
    dockPieceRef.current = state;

    let raf;
    let last = performance.now();
    function tick(now) {
      raf = requestAnimationFrame(tick);
      // While the settings panel is open, this canvas sits at opacity 0
      // behind it (see its own style below) — fully invisible, but
      // still a real WebGL render every frame if left running, on top
      // of the main board's own full render loop happening at the same
      // time. Skipping both the physics step and the render call here
      // costs nothing visible (nobody can see it) and resumes cleanly:
      // dt is already clamped below, so however long "panel" was open
      // just becomes one ordinary clamped step once it closes.
      if (dockViewRef.current === "panel") {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      state.spin.x = 0.15 + 0.1 * Math.sin(t * 0.13);
      state.spin.y = 0.22 + 0.12 * Math.sin(t * 0.09 + 1.3);
      state.spin.z = 0.08 + 0.08 * Math.sin(t * 0.17 + 2.6);
      if (!state.dragging) {
        // Decays whatever velocity a drag left behind back toward the
        // idle meander — slow enough that a real flick keeps spinning
        // for a while, rather than snapping back to idle in under a
        // second.
        const decay = Math.exp(-dt * 0.9);
        state.velocity.x = state.spin.x + (state.velocity.x - state.spin.x) * decay;
        state.velocity.y = state.spin.y + (state.velocity.y - state.spin.y) * decay;
        state.velocity.z = state.spin.z + (state.velocity.z - state.spin.z) * decay;
      }
      pieceGroup.rotation.x += state.velocity.x * dt;
      pieceGroup.rotation.y += state.velocity.y * dt;
      pieceGroup.rotation.z += state.velocity.z * dt;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  // Builds (and rebuilds, whenever the session's chosen type/color or
  // the live opponent selection changes) the actual piece mesh — real
  // engine geometry (disc or rounded box, per PIECE_META) through the
  // current theme's own buildPieceVisual(), so whichever piece got
  // rolled for this session is genuinely proportional to how it reads
  // on the real board, not a bespoke decorative model. In an
  // AI-opponent game, color follows whichever side the human actually
  // plays live — the color aiPlayer does NOT control, never
  // humanStartSide (that's a Human-vs-Human-only preference, inactive
  // and not meaningful once an AI opponent is picked). In Human vs
  // Human there's no single "your side" either, so it stays whichever
  // color dockSessionColor derived as the OPPOSITE of this session's
  // randomly-rolled near side (see boardNearSide above).
  useEffect(() => {
    const state = dockPieceRef.current;
    if (!state) return;
    const { pieceGroup } = state;
    while (pieceGroup.children.length) {
      const c = pieceGroup.children.pop();
      c.geometry && c.geometry.dispose();
      c.material && c.material.dispose();
    }
    const side = aiPlayer !== null ? (aiPlayer === "dark" ? "light" : "dark") : dockSessionColor;
    const isDark = side === "dark";
    const meta = PIECE_META[dockSessionPieceType];
    const isDisc = meta.shape === "disc";
    const orientation = DOCK_PIECE_ORIENTATIONS[dockSessionPieceType];
    const geo = isDisc
      ? new THREE.CylinderGeometry(
          (DISC_DIAM * PIECE_SCALE) / 2,
          (DISC_DIAM * PIECE_SCALE) / 2,
          DISC_H * PIECE_SCALE,
          40
        )
      : makeRoundedBox(
          orientation.w * PIECE_SCALE,
          orientation.z * PIECE_SCALE,
          orientation.h * PIECE_SCALE,
          EDGE_RADIUS
        );
    // w/h/z are required here even though `geo` above already has the
    // real dimensions baked in — both themes' buildPieceVisual() read
    // piece.w/h/z directly (not the geo argument) to build each piece's
    // separate outline/glow shell geometry. Omitting them silently
    // passed NaN into that second geometry (piece.w * PIECE_SCALE with
    // piece.w undefined), corrupting its bounding sphere.
    const fakePiece = {
      id: "dock-preview",
      type: dockSessionPieceType,
      owner: isDark ? "dark" : "light",
      w: orientation.w,
      h: orientation.h,
      z: orientation.z,
    };
    const { mesh, shell } = theme.buildPieceVisual({ piece: fakePiece, isDark, isDisc, geo, center: { x: 0, z: 0 }, y: 0 });
    // Neon's body is translucent with depthWrite:false (see
    // buildPieceVisual's own comment on the self-z-fighting bevel
    // bug this avoids), which also means its wireframe shell never
    // gets occluded by the body's own near faces — both the near AND
    // far edges of the box render at once as it tumbles here, reading
    // as a trapezoidal double-image rather than a normal opaque box
    // outline. A depth-only pre-pass (real depth, no color) restores
    // correct occlusion for the shell without reintroducing that bug:
    // color output isn't a factor, so near-coincident bevel seams
    // produce no visible artifact from it. No-ops for Standard, whose
    // piece material is fully opaque already.
    if (mesh.material.transparent && mesh.material.depthWrite === false) {
      const depthMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
      depthMesh.position.copy(mesh.position);
      depthMesh.renderOrder = 0;
      pieceGroup.add(depthMesh);
    }
    pieceGroup.add(mesh, shell);

    // Per feedback, every piece type must render at its own TRUE
    // relative size (Opa correctly bigger than Turrito, etc.), not
    // normalized to a shared apparent size — this used to compute
    // ownMaxDim from whichever piece got rolled THIS session and scale
    // it to fill the same target every time, which is exactly what
    // erased the size difference between types. Basing baseScale on
    // the single LARGEST dimension across every possible dock piece
    // instead (a fixed constant, not per-session) means only the
    // biggest pieces (Opa/Flaco/Chato, tied at 2 units) ever reach the
    // dock's original comfortable-fit target size — the disc and
    // Turrito now render genuinely smaller within the same frame,
    // rather than being stretched to fill it. The frame was tuned
    // around the disc's own footprint, so some overlap with the board
    // when a large piece is showing is expected and fine per feedback
    // ("There can be some overlap with the game board...").
    const targetSize = DISC_DIAM * PIECE_SCALE;
    const ownMaxDim = DOCK_PIECE_LARGEST_DIM * PIECE_SCALE;
    const baseScale = targetSize / ownMaxDim;
    state.pieceBaseScale = baseScale;
    if (!state.bouncing) pieceGroup.scale.set(baseScale, baseScale, baseScale);

    // Per feedback ("hit boxes should be appropriately sized for each
    // piece, custom to that piece's dimensions, not a generic one-
    // size-fits-all, largest to fit everything one"): the fraction of
    // the dock's fixed-size frame this specific piece type/orientation
    // actually occupies, now that sizing above is genuinely
    // proportional rather than every type filling the same footprint.
    // Drives the pointer-hit target's own size below (see
    // dockPieceStyle/dockHitStyle), not the canvas itself — the canvas
    // and its camera/aspect stay fixed so the render never distorts.
    //
    // HIT_TIGHTEN (0.7): even at fraction 1 (the largest piece types,
    // which exactly fill the frame's own longest axis), a square hit
    // target still leaves real slack in its own corners around a
    // rotating 3D piece's actual on-screen silhouette — per feedback
    // that the hitbox read as noticeably bigger than the piece itself,
    // regardless of which piece is showing. A first pass cut this 30%
    // (to 0.7) as an across-the-board guess and was still reported as
    // much too large — measuring the ACTUAL rendered alpha silhouette
    // pixel-by-pixel (getImageData on the dock canvas) rather than
    // guessing again showed why: even the largest piece type's real
    // on-screen width only ever reached ~0.42 of the frame — at the
    // old 0.7 that's a hitbox 65%+ wider than the piece actually is.
    // 0.4 lines up with that same measurement at both ends of the
    // range (the disc's own ~0.51 ratio * 0.4 ≈ 0.2, matching its
    // measured ~0.19-0.21 silhouette width; the largest pieces' 1.0
    // ratio * 0.4 = 0.4, matching their measured ~0.42). Still a
    // single shared width/height fraction, not a true per-axis fit
    // (the measured height ran a bit smaller than width throughout,
    // ~0.11-0.35 across the same pieces), so this errs slightly
    // generous vertically rather than any tighter than the real
    // silhouette on either axis.
    const HIT_TIGHTEN = 0.4;
    const ownFootprint = isDisc ? DISC_DIAM : Math.max(orientation.w, orientation.h, orientation.z);
    setDockHitFraction(HIT_TIGHTEN * Math.max(0.4, ownFootprint / DOCK_PIECE_LARGEST_DIM));
  }, [aiPlayer, dockSessionColor, dockSessionPieceType, theme]);

  /* Mirrors the audio engine's own `windingDown` flag but at the
     component level: flips true once a win or a manual end fires, so
     ambient effects can stop re-arming themselves the same way the
     audio engine's own schedulers do. */
  const windingDownRef = useRef(false);

  /* Mirrors awaitingBegin into a ref for the same reason windingDownRef
     exists: a theme's ambient timers fire from setTimeout callbacks
     scheduled outside React's render cycle, so they need a live read of
     "is a game actually in progress right now" rather than whatever
     awaitingBegin closed over at schedule time. Kept in sync below. */
  const awaitingBeginRef = useRef(awaitingBegin);
  useEffect(() => {
    awaitingBeginRef.current = awaitingBegin;
  }, [awaitingBegin]);

  const [audioMuted, setAudioMuted] = useState(initialMuted);

  /* Audio must fall silent the instant this tab/window isn't the
     active, visible one, independent of the player's own mute
     preference above. Browsers do NOT auto-suspend a running
     AudioContext just because focus moves elsewhere on desktop (unlike
     some mobile lock-screen/background cases the theme's own
     visibilitychange listener already handles by resuming a suspended
     context) — without this, switching tabs or apps left the game
     fully audible to anyone in the room despite the game still
     "running" in the background. Forces the underlying engine silent
     on hide and restores it to whatever audioMuted actually is the
     moment the tab is visible again — never flips an unmuted
     preference to muted, or a muted one to unmuted, just suspends and
     resumes it around the hidden interval. */
  useEffect(() => {
    function onVisibilityChange() {
      audioRef.current.setMuted(document.visibilityState === "visible" ? audioMuted : true);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [audioMuted]);

  /* Full Screen is theme-agnostic browser API — promoted to the
     chassis per ARCHITECTURE.md rather than routed through a theme
     hook, since every theme wants it and none of it depends on visual
     identity. */
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* Per feedback, the native right-click/long-press context menu must
     never appear ANYWHERE in the app, not just on the board (which
     already had its own contextmenu preventDefault — see the pointer-
     handling effect below — since right-click there doubles as a pan
     trigger). This one is document-wide and unconditional: it's the
     only thing standing between a right-click (or the equivalent
     context-menu key, Shift+F10, or a touch/pen long-press — browsers
     dispatch the same "contextmenu" event for all of them, regardless
     of platform or input method) and the native menu anywhere else on
     the page — the dock panel, buttons, the masthead, empty
     background. Mounted once for the component's whole lifetime, not
     tied to any other effect's dependencies. */
  useEffect(() => {
    const onContextMenu = (ev) => ev.preventDefault();
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen && document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  /* The masthead's three-phase lifecycle: full-size and opaque during
     setup; once Begin Game is pressed it fades toward "almost hidden"
     in place first, then — 2s later, its own separate beat — relocates
     to a small badge tucked behind the board in the upper-right. Resets
     the instant awaitingBegin goes true again (a fresh game/reset), so
     the next round gets the same entrance. */
  const [titleRelocated, setTitleRelocated] = useState(false);
  useEffect(() => {
    if (awaitingBegin) {
      setTitleRelocated(false);
      return;
    }
    const t = setTimeout(() => setTitleRelocated(true), 2000);
    return () => clearTimeout(t);
  }, [awaitingBegin]);
  const mastheadPhase = awaitingBegin ? "setup" : titleRelocated ? "relocated" : "fading";

  /* Pre-game framing: while awaiting Begin Game, the camera itself
     (not any DOM clipping — the render layer always stays full
     viewport, see the board's mount div below) pulls back just far
     enough that the board sits fully between the masthead's bottom
     edge and the dock's top edge, with real breathing room on both
     sides. Recomputed on resize/orientation change so it keeps fitting
     as the layout reflows; a settle timer covers the masthead's own
     fonts/animation still resolving their final size right after
     mount. Uses three.current.measureBoardPx (set up in the main
     scene effect) to bisect for the smallest radius — biggest, most
     legible board — whose on-screen height (including the tallest
     piece, so nothing pokes into the masthead/dock) still fits the
     gap; never overrides a game already in progress, and a manual
     wheel/pinch zoom during setup stays in effect until the next
     resize or the next fresh setup screen recomputes it again.

     On leaving setup (Begin Game pressed), the fit is undone — back to
     the normal gameplay default — UNLESS the player zoomed away from
     it manually first, in which case that manual choice carries into
     the game exactly as it always has, unaffected by this feature:
     the masthead and dock both shrink out of the way once play starts,
     so nothing still needs the board held back to fit between them. */
  const preGameFitRadiusRef = useRef(null);
  const preGameFitTargetYRef = useRef(null);
  useEffect(() => {
    if (!awaitingBegin) return;
    const GAP_PADDING_PX = 28;
    // The vertical-gap search alone leaves the board pinned edge-to-edge
    // on a narrow/tall viewport (a perspective camera's on-screen WIDTH
    // isn't part of that search at all) — per feedback/reference
    // screenshot, the setup board should keep real side margins too, so
    // this caps the board at 84% of the viewport's width (~8% margin
    // each side, matching the reference) as a second, independent
    // constraint on top of the gap fit.
    const MAX_BOARD_WIDTH_FRACTION = 0.84;
    function recompute() {
      const titleEl = titleRef.current;
      const dockEl = dockPieceMountRef.current;
      const measure = three.current.measureBoardPx;
      const measureBox = three.current.measureBoxPx;
      const mountSize = three.current.getMountSize && three.current.getMountSize();
      if (!titleEl || !dockEl || !measure || !mountSize) return;
      const gapTop = titleEl.getBoundingClientRect().bottom + GAP_PADDING_PX;
      const gapBottom = dockEl.getBoundingClientRect().top - GAP_PADDING_PX;
      const gapHeight = gapBottom - gapTop;
      if (gapHeight < 40) return;
      const { theta, phi, target } = cam.current;
      // Fresh y=0, not the live target straight from cam.current: a
      // previous run of THIS SAME effect may have left target.y at a
      // nonzero vertical-centering offset (see below), and re-using
      // that stale offset as the radius search's own camera position
      // corrupts the measured span — on a fresh game's second
      // recompute (the 950ms settle pass), this collapsed the fit
      // straight to ZOOM_MIN, reading as the board suddenly zooming
      // in far too close right after New Game. The radius search
      // always wants a clean, uncentered baseline; only the dedicated
      // centering pass below should ever touch target.y.
      const radiusTarget = new THREE.Vector3(target.x, 0, target.z);
      let lo = ZOOM_MIN;
      let hi = ZOOM_MAX_FOR_BOARD;
      // A larger radius always reads as a smaller (or equal) on-screen
      // span, so this is a monotonic search: bisect for the smallest
      // radius whose span still fits, rather than the other direction.
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const m = measure(mid, phi, theta, radiusTarget);
        if (!m) return;
        if (m.span > gapHeight) lo = mid;
        else hi = mid;
      }
      // Second, independent bisection for the width margin — same
      // monotonic search, just against the board's on-screen WIDTH
      // (via measureBoxPx, which — unlike measureBoardPx above —
      // reports both axes) instead of its height.
      if (measureBox) {
        const maxWidthPx = mountSize.w * MAX_BOARD_WIDTH_FRACTION;
        const halfX = SLAB_X / 2, halfZ = SLAB_Z / 2;
        const corners = [[-halfX, -halfZ], [-halfX, halfZ], [halfX, -halfZ], [halfX, halfZ]];
        const heights = [0, 2 * PIECE_SCALE]; // same "tallest piece" reach as measureBoardPx's own TALLEST_PIECE_HEIGHT
        let wLo = ZOOM_MIN;
        let wHi = ZOOM_MAX_FOR_BOARD;
        for (let i = 0; i < 24; i++) {
          const mid = (wLo + wHi) / 2;
          const m = measureBox(mid, phi, theta, radiusTarget, corners, heights);
          if (!m) break;
          if (m.width > maxWidthPx) wLo = mid;
          else wHi = mid;
        }
        // Whichever constraint needs the bigger radius (more zoomed
        // out) wins — the other one still has slack to spare.
        hi = Math.max(hi, wHi);
      }
      cam.current.radius = hi;
      preGameFitRadiusRef.current = hi;

      // Center the fitted board vertically within the SAME masthead-
      // to-dock gap, not just make it fit — a symmetric gapHeight
      // budget doesn't guarantee a viewport-centered render actually
      // lands in the middle of that specific band, since the masthead
      // and dock rarely take up equal space on screen. Solves for the
      // target.y (the camera's own pan/aim offset — see
      // measureBoardPx's own comment on why this must sample absolute
      // world heights to make target.y do anything at all) that puts
      // the board's on-screen vertical midpoint at the gap's midpoint.
      // The relationship between target.y and screen position is very
      // close to linear for a fixed radius/phi, so one secant step
      // plus a single refinement against the real projection is
      // enough — same numeric-over-closed-form philosophy as the rest
      // of this file's camera-fitting code.
      const desiredCenter = (gapTop + gapBottom) / 2;
      const probeTarget = new THREE.Vector3(target.x, 0, target.z);
      const m0 = measure(hi, phi, theta, probeTarget);
      if (m0) {
        const c0 = (m0.top + m0.bottom) / 2;
        const STEP = 2;
        probeTarget.y = STEP;
        const m1 = measure(hi, phi, theta, probeTarget);
        if (m1) {
          const c1 = (m1.top + m1.bottom) / 2;
          const slope = (c1 - c0) / STEP;
          if (Math.abs(slope) > 1e-6) {
            let ty = (desiredCenter - c0) / slope;
            probeTarget.y = ty;
            const mR = measure(hi, phi, theta, probeTarget);
            if (mR) {
              const cR = (mR.top + mR.bottom) / 2;
              ty += (desiredCenter - cR) / slope;
            }
            cam.current.target.y = ty;
            preGameFitTargetYRef.current = ty;
          }
        }
      }
    }
    recompute();
    const settleTimer = setTimeout(recompute, 950);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("resize", recompute);
      if (preGameFitRadiusRef.current != null && cam.current.radius === preGameFitRadiusRef.current) {
        cam.current.radius = 17;
      }
      if (preGameFitTargetYRef.current != null && cam.current.target.y === preGameFitTargetYRef.current) {
        cam.current.target.y = 0;
      }
      preGameFitRadiusRef.current = null;
      preGameFitTargetYRef.current = null;
    };
  }, [awaitingBegin]);

  /* Move Log popup — a chassis-level feature (see ARCHITECTURE.md):
     generic post-game UI with no theme dependency, built once here
     rather than per theme. Replaces what used to be an inline Copy Log
     control in the record section. */
  const [showMoveLog, setShowMoveLog] = useState(false);
  // Per feedback, Copy Move_Log's confirmed state now resets on close
  // (was previously left standing so a later reopen still showed the
  // last copy's confirmation — the opposite of what's wanted here).
  const [moveLogExpanded, setMoveLogExpanded] = useState(false);
  function openMoveLog() {
    setShowMoveLog(true);
  }
  function closeMoveLog() {
    setShowMoveLog(false);
    setLogCopied(false);
    setLogCopyFailed(false);
    setMoveLogExpanded(false);
  }
  // Scrolling to (or near) the bottom of the still-collapsed (5-row)
  // list expands the window to fit 10 more rows. A small pixel
  // tolerance, not an exact max check, since a real scroll gesture
  // rarely lands on the precise boundary pixel. Once expanded, it
  // STAYS expanded for the rest of this popup's open session — per
  // feedback, scrolling back up to the top used to auto-collapse it
  // again, which read as the popup fighting the very scroll gesture
  // that had just been used to read further down the list. closeMoveLog
  // still resets this back to false for the NEXT time the popup opens.
  const MOVE_LOG_ROW_PX = 26;
  const MOVE_LOG_COLLAPSED_ROWS = 5;
  const MOVE_LOG_EXPANDED_ROWS = 15;
  function handleMoveLogScroll(e) {
    const el = e.currentTarget;
    if (!moveLogExpanded && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      setMoveLogExpanded(true);
    }
  }

  /* A theme's pre-game setup screen can need its own local state and
     handlers (Neon's Singularity easter egg: a hover-hold reveal timer,
     an info popup) that call back into chassis state (Neon's Anomaly
     button calls setPieces). Since renderSetupExtras is a plain
     function — not a component — it can't call useState/useRef itself
     without breaking React's rules of hooks the moment it's skipped on
     a render (e.g. once awaitingBegin goes false). useSetupExtras is a
     REAL hook instead, called here unconditionally on every render at
     a fixed position — safe despite the `theme.useSetupExtras ? ... :`
     guard because `theme` is a stable prop that never changes which
     branch it takes for the lifetime of a mounted instance. A theme
     with no setup-screen state of its own (Standard) doesn't export
     this hook at all, and gets `null` here.

     aiPlayer/selectOpponent/aiDifficulty/setAiDifficulty/AI_DIFFICULTY/
     busy/aiThinking/triggerBeginGame are exposed the same additive way
     `cam` was for the collapse camera work — real opponent-picker state
     and the real Begin Game trigger (see triggerBeginGame below), not a
     theme-local reimplementation, so a theme's own Opponent/AI/Begin
     Game controls (Neon's Singularity summary menu) drive the exact
     same game-start path the dock's own buttons do. */
  const setupExtras = theme.useSetupExtras ? theme.useSetupExtras({
    awaitingBegin, pieces, setPieces, audio: audioRef.current, three,
    aiPlayer, selectOpponent, aiDifficulty, setAiDifficulty, AI_DIFFICULTY,
    busy, aiThinking, triggerBeginGame,
  }) : null;

  function handleTitleClick() {
    setInfoBtnVisible(true);
    // Re-clicking the title while the button is already showing just
    // restarts its 4-second clock, rather than letting an earlier timer
    // hide it out from under a still-fresh reveal.
    if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    infoBtnTimerRef.current = setTimeout(() => setInfoBtnVisible(false), 4000);
  }

  function handleInfoButtonClick() {
    if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    setInfoBtnVisible(false);
    setShowInfoOverlay(true);
    // Fired synchronously from the real click, not from the effect
    // below reacting to showInfoOverlay flipping true — some browsers
    // only actually resume/build an AudioContext when that happens
    // inside the original user-gesture call stack, and a React effect
    // runs one tick later, outside it. That gap is almost certainly
    // why this "seems to fail more than works": most calls simply
    // landed silently on a still-suspended context.
    audioRef.current.playMenu();
  }

  useEffect(() => {
    return () => {
      if (infoBtnTimerRef.current) clearTimeout(infoBtnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showInfoOverlay) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowInfoOverlay(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInfoOverlay]);

  // fadeOutMenu fires exactly once per close, regardless of which of
  // the two ways the Info overlay gets closed (Escape, backdrop
  // click) or whether the component unmounts while it's open — this
  // cleanup covers all three. playMenu itself now fires directly from
  // handleInfoButtonClick's own click handler, not from here reacting
  // to showInfoOverlay flipping true (see the comment there for why).
  useEffect(() => {
    if (!showInfoOverlay) return;
    return () => audioRef.current.fadeOutMenu();
  }, [showInfoOverlay]);

  useEffect(() => {
    if (!showVictoryPlacard) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowVictoryPlacard(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showVictoryPlacard]);

  function selectOpponent(value) {
    setAiPlayer(value);
    setGameArmed(false); // switching opponent type always re-requires Begin Game, Human included
  }

  /* The real Begin Game action, hoisted out of the button below so a
     theme-owned trigger (Neon's Singularity summary menu) can fire the
     exact same game-start path as the dock's own button rather than a
     re-implementation that could drift from it. */
  function triggerBeginGame() {
    audioRef.current.beginGameFadeIn();
    audioRef.current.playPowerOn();
    ambientRef.current && ambientRef.current.armOnBegin();
    setGameArmed(true);
    // Captures BOTH views' fixed baselines for the game that's about to
    // start, before actually applying one of them — see
    // captureViewBaselines' own comment for why this has to be eager.
    // Every game now opens in Top-Down View rather than Current Player
    // View, per feedback.
    captureViewBaselines();
    topDownView();
  }

  /* The Human button does double duty: from an AI mode, it switches
     back to Human vs Human (same as selectOpponent(null) always did).
     Already IN Human mode, a re-click has nothing left to "select", so
     it instead toggles which color starts the next game — the button
     being disabled by the same lock condition as the rest of the row
     is what keeps this to "before a game begins". */
  function handleHumanButtonClick() {
    if (aiPlayer !== null) selectOpponent(null);
    else setHumanStartSide((prev) => (prev === "dark" ? "light" : "dark"));
  }

  /* Tapping the status pill during setup flips which side moves first —
     the same preference the Human button's re-click toggle writes, just
     reachable from the thing that actually SHOWS whose turn it is.

     Both pieces of state have to move together: currentPlayer is what
     the pill and its colour dot read, while humanStartSide is what New
     Game restores and what the pre-game camera framing and the dock
     piece's colour track. Setting only one would leave the pill
     disagreeing with the board underneath it. theta is written straight
     onto the camera GOAL (not the rendered view), so the board turns to
     face the new starting side on the usual damping rather than
     snapping — the same thing handleNewGame does. */
  function toggleStartingPlayer() {
    if (!awaitingBegin) return;
    const next = currentPlayer === "dark" ? "light" : "dark";
    setCurrentPlayer(next);
    setHumanStartSide(next);
    cam.current.theta = next === "dark" ? Math.PI : 0;
    audioRef.current.playSelect();
  }

  const isPlaying = status === "playing";
  const turnLocked = stepsUsed > 0;
  /* True from the moment a game is begun (awaitingBegin cleared) until
     it concludes — the window where the Opponent row and the move
     record are hidden to declutter the board, and End Active Game
     relocates up next to Top-Down View. Reverts on its own the instant
     the game ends (isPlaying goes false), bringing both sections and
     the button's original spot back for reviewing the finished game
     and picking a new opponent — no separate state needed. */
  const declutter = !awaitingBegin && isPlaying;
  /* Distinct from declutter above: declutter is specifically about
     hiding the Opponent row and Record section, true only during
     ACTIVE play. This is about whether a live action button sits up
     here next to Top-Down View at all — true for both "playing" (End
     Active Game) and the new "ended" state (Reset Game), but false
     once a game concludes via an actual win. A real win already gets
     its own reset control from the bottom Record row's New Game button
     and the victory placard; showing a second, differently-labeled
     button up here too in that case would just be redundant. */
  const showTopButton = !awaitingBegin && status !== "finished";

  const selectedPiece = pieces.find((p) => p.id === selectedId) || null;
  const hoveredPiece = pieces.find((p) => p.id === hoveredId) || null;
  const activePiece = selectedPiece || hoveredPiece;

  const maxSteps = activePiece ? PIECE_META[activePiece.type].maxSteps : 0;
  const stepsRemaining = activePiece
    ? maxSteps - (activePiece.id === selectedId ? stepsUsed : 0)
    : 0;

  const shadows =
    isPlaying &&
    !busy &&
    activePiece &&
    activePiece.owner === currentPlayer &&
    currentPlayer !== aiPlayer && // the AI moves without narrating its options on the board
    stepsRemaining > 0
      ? legalMovesFor(pieces, activePiece)
      : {};
  const shadowEntries = Object.entries(shadows);

  /* ------------------------- scene setup ------------------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = null;

    /* near raised 0.1 -> 1: a conservative fix for a reported depth-
       sort/z-fighting glitch (a piece briefly rendering in front of
       something it should be behind, most visible during board
       rotation) — nothing here ever needs the camera closer than
       ZOOM_MIN (9) to its target, so this loses no legitimate close-up
       range, while cutting the near:far ratio the depth buffer has to
       resolve by 10x, which is where the spare precision actually goes.
       Doesn't touch any piece material/geometry — see themes/standard.js
       for why that surface was deliberately left alone before. */
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    /* Back to PCFSoftShadowMap after VSMShadowMap turned out to cost
       more than expected. The reasoning that led to VSM undersold what
       "once, in a separate pass" actually meant: that blur pass runs
       every frame the shadow map updates (Three.js defaults to
       recomputing it continuously), not a one-time setup cost — so
       pairing it with mapSize 4096 (4x the texels to blur) and
       blurSamples 16 (2x the samples per texel) meant a real,
       continuous per-frame cost, most visible exactly where it was
       reported: dragging the camera, which forces a fresh render every
       frame with nothing to amortize it against. PCF's softening is
       inline instead — a handful of extra samples taken at the exact
       point being shaded, during the render that's happening anyway —
       which is why it doesn't carry the same recurring full-texture
       cost. mapSize stays at 4096 below; that resolution bump is cheap
       under PCF specifically, since it's still just a depth-only
       render target, not the input to a per-frame blur pass. */
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /* Tone mapping, added after measuring the actual rendered output
       during a roll: the light pieces' lit faces were reaching 255 —
       pure white, and BRIGHTER than the board's own 251 — while no
       tone mapping was configured at all. With NoToneMapping (the
       default) anything the lighting drives above 1.0 is simply
       clamped, so those faces weren't just bright, they were CLIPPED:
       a flat, featureless patch with no shading gradient across it.

       That matters for the deformation problem specifically. Smooth
       shading gradients across a face are the primary cue the eye
       uses to read a solid as rotating rather than changing shape.
       When the face presented to the key light blows out to a flat
       white patch that also matches the board's value, the piece
       loses both its shading cue AND its contrast against the
       background in the same instant, leaving only a thin outline —
       which is exactly the condition under which a geometrically
       correct rigid rotation reads as the object growing or
       deforming. A rough estimate of the top face's irradiance puts
       it near 1.2 against a ceiling of 1.0, so roughly the top 20% of
       the piece's tonal range was being thrown away.

       ACES filmic rolls highlights off smoothly instead of clamping
       them, so that range is preserved as gradient rather than
       flattened. Exposure is lifted slightly above 1 because ACES
       darkens midtones on its own; 1.15 keeps overall brightness
       close to what it was, with the change concentrated where it was
       needed (the highlights). Both lines revert cleanly together if
       the filmic look isn't wanted. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.dataset.testid = "board-canvas";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    /* Ambient light hits every face equally, so it is precisely what
       flattens a cube. Keep it low and let directional lights at
       differing azimuths give each vertical face its own value. None is
       axis-aligned with the grid — a light square-on to the board would
       shade two opposite faces identically.
       History on these two numbers: darkened 15% earlier, then raised
       5% here specifically to lighten shadows — ambient/hemisphere are
       the only lights that reach a square the key light can't see past
       an occluding piece, so they're the correct lever for shadow
       brightness specifically, as opposed to key intensity or shadow
       bias/radius, which would also change how bright the directly-lit
       faces look. Net effect versus the original values: ambient
       0.24 -> 0.2142 (-10.75%), hemisphere 0.34 -> 0.30345 (-10.75%). */
    /* All five lights below scaled down 10% together here — a uniform
       cut, not another shadow-specific lift like the ambient/hemisphere
       change earlier. This compresses the whole range: the brightest lit
       faces aren't as intense, so the shadows read as less severe by
       comparison even though their own absolute level isn't the thing
       being changed this time. Scaling every light by the same factor
       keeps the relative balance between them intact — that balance is
       what makes each face shade distinctly instead of flattening. */
    scene.add(new THREE.AmbientLight(theme.lights.ambient.color, theme.lights.ambient.intensity));
    const hemi = new THREE.HemisphereLight(theme.lights.hemi.sky, theme.lights.hemi.ground, theme.lights.hemi.intensity);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(theme.lights.key.color, theme.lights.key.intensity);
    key.position.set(9, 13, 5);
    key.castShadow = true;
    /* 4096, up from 2048 — this is a depth-only render pass (no
       shading, no textures sampled), so for a scene this simple —
       ten pieces and a board, not an open world — doubling it is a
       trivial GPU cost. Combined with the already-tight ±11 frustum
       below, this is real added texel density, not resolution spent
       on empty space the frustum doesn't even cover. */
    key.shadow.mapSize.set(4096, 4096);
    /* This light and its frustum stay fixed in world space now that the
       board (not the camera) is what turns — see boardGroup below. A
       square board spun to 45° has a bounding diagonal of roughly
       SLAB*sqrt(2) ≈ 16.1, half of that ≈ 8.1, comfortably inside this
       already-existing ±11 margin. Worth knowing before shrinking this:
       it needs to cover the board at every possible heading, not just
       the heading it happens to be at when this is being read. */
    /* Tightened from +/-11 to +/-9.5. This is free resolution, not a
       trade-off: the frustum only has to contain everything that
       casts or receives, and that works out to 9.05 — the slab's
       bounding circle as it rotates about Y (11.4 * sqrt(2) / 2 =
       8.06) plus what the tallest piece adds along the light
       direction (1.6 * sin(38.4 deg) = 0.99). +/-11 was covering
       ~2 units of empty space on every side and paying for it in
       texel size. At 4096 across, +/-11 gives 0.00537 world units per
       texel; +/-9.5 gives 0.00464, a 14% finer shadow map for
       nothing. That headroom is what makes the lower normalBias below
       safe. +/-9.5 keeps 0.45 units of margin over the 9.05
       requirement, so nothing clips. */
    key.shadow.camera.left = -9.5;
    key.shadow.camera.right = 9.5;
    key.shadow.camera.top = 9.5;
    key.shadow.camera.bottom = -9.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.bias = 0;
    /* Zero, not the original -0.0012 — and this is the value that
       actually matters for the white line at a piece's base.

       History worth keeping, because the two knobs below were confused
       with each other for several rounds. bias and normalBias were
       escalated together (-0.0012 -> 0, and 0.02 -> 0.15) while
       chasing that line, then both restored together once a separate
       z-fighting cause was found and fixed via the slab's
       polygonOffset. Restoring both brought the line straight back,
       even though the polygonOffset was UNCHANGED and if anything
       stronger — which isolates the cause cleanly: the line needs both
       the slab offset AND zero depth bias. The z-fighting diagnosis
       was real but only half the story.

       Mechanically these two do different jobs, which is why they
       should never be moved as a pair again. A negative depth bias is
       a flat offset applied to every shadow comparison, so it pushes
       a shadow away from its caster uniformly — classic peter-panning,
       and at a piece's base that reads as exactly this: a thin strip
       of lit board between the piece and where its shadow starts.
       Zero removes that gap. normalBias, below, offsets along the
       surface normal instead and is the correct tool for acne; it was
       the one at fault for shadows detaching at 0.15, not this. */
    key.shadow.normalBias = 0.004;
    /* Lowered from 0.02 after a white line reappeared at piece bases
       specifically when zoomed in with the board panned down.

       normalBias offsets the shadow lookup along the RECEIVING
       surface's normal. On the board that offset is vertical, and with
       the key light at (9, 13, 5) a vertical offset converts to a
       horizontal one at 0.79x — so the shadow retreats from the piece
       casting it by normalBias * 0.79. At 0.02 that is 0.0158 world
       units, about 1.5% of a board square, and it is a FIXED
       world-space distance: invisible at normal zoom because it is a
       fraction of a pixel, but magnified into a several-pixel band of
       fully-lit board once the camera is close. Panning down doesn't
       cause it; it just puts the piece bases where you're looking
       straight at them. Pixel-scanning the reported frames confirmed
       it — full board brightness (215-222) sitting between a piece's
       dark outline and the start of its own shadow.

       0.02 was also simply larger than the job needs. Against this
       shadow map (4096 over a 22-unit frustum, so 0.00537 units per
       texel) it was 3.7 texels of offset, where 1-2 texels is the
       usual range for suppressing acne. 0.008 is 1.5 texels — still
       comfortably in that range, and it cuts the gap by 60% to 0.0063
       units.

       With bias at 0, this still carries the anti-acne job alone. If
       speckle ever appears on lit surfaces (the Cabeza's curved
       cylinder is the likeliest place, since a flat depth bias handles
       continuously-varying normals poorly), raise THIS a little rather
       than reintroducing negative bias — negative bias detaches every
       shadow uniformly and would bring the original white line back
       with it. Note the direct trade-off, now that it is measured:
       every increase here widens the contact gap by 0.79x the amount
       added, so it is worth staying near the low end of what actually
       works.

       Lowered 0.008 -> 0.004 after measuring the remaining line
       directly. Pixel-scanning a close zoom showed the sequence
       piece(156) -> outline(128) -> SPIKE(198-202) -> shadowed
       board(176): a sliver ~25 levels brighter than the board around
       it, 1-2px at ~187 px per world unit, so ~0.008 world units.
       That matched this value's own horizontal shadow retreat
       (0.008 * 0.792 = 0.0063) closely enough to identify it as the
       dominant term — it is a shadow-map contact gap, which is why it
       only shows against shadow, the one place a lit sliver has
       contrast to stand out against. Halving this halves that retreat
       to 0.0032. Safe to go this low only because the shadow camera
       above was tightened at the same time: 0.004 is 0.86 texels at
       the new 0.00464 texel size, versus 0.74 at the old one. */
    /* 1.6, down from 3.5. With the shell now casting and normalBias at
       0.008, this became the dominant remaining term in the white line
       at piece bases. radius is a PCF blur measured in shadow-map
       texels: at 3.5 texels (3.5 * 0.00537 = 0.019 world units) the
       penumbra faded the shadow out before it reached the piece, so
       the board immediately under a piece read as fully lit. Measuring
       a reported frame put the lit gap at ~2px where the scale was
       ~112px per world unit — 0.018 units, matching the blur width
       almost exactly, and roughly 3x the normalBias contribution
       (0.0063). 1.6 texels is 0.0086 units, which brings the penumbra
       under the outline's own width so the shadow meets the piece.

       Why it only ever showed on LIGHT pieces: the gap is identical on
       both, but dark pieces use a mid-grey shell (0x6f6f6f) while
       light pieces use near-black charcoal, so only the light ones
       frame that lit gap at maximum contrast.

       Shadows are correspondingly crisper. If they now read as too
       hard, raise this back toward 2.5 rather than past it — every
       texel added here puts ~0.005 world units of lit board back
       between a piece and its shadow. */
    key.shadow.radius = 1.6;
    scene.add(key);

    /* Fill sits roughly perpendicular to the key in plan, so the two
       faces the key rakes get different values from each other. */
    const fill = new THREE.DirectionalLight(theme.lights.fill.color, theme.lights.fill.intensity);
    fill.position.set(-7, 5, 10);
    scene.add(fill);

    /* A dim back light keeps the two faces turned away from both from
       collapsing into the same silhouette-dark tone. */
    const back = new THREE.DirectionalLight(theme.lights.back.color, theme.lights.back.intensity);
    back.position.set(-5, 4, -11);
    scene.add(back);

    /* Board slab */
    const boardTex = theme.makeBoardTexture();
    boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const slabGeo = new THREE.BoxGeometry(SLAB_X, SLAB_THICKNESS, SLAB_Z);
    const slabMats = theme.buildSlabMaterials(boardTex);
    const slab = new THREE.Mesh(slabGeo, slabMats);
    slab.position.y = -SLAB_THICKNESS / 2;
    slab.receiveShadow = true;

    /* Built explicitly rather than from EdgesGeometry(slabGeo). The
       full box wireframe includes four vertical corner segments that
       run the slab's whole thickness and terminate at exactly y=0 —
       coplanar with the top face. Since three.js enables only
       GL_POLYGON_OFFSET_FILL, those lines never receive the top face's
       polygon offset, so once that face is pushed back they win the
       depth test and appear as short vertical lines through an opaque
       surface at each corner. That was the corner-line bug.

       The verticals are kept (they define the slab's silhouette from
       low camera angles) but stopped VERTICAL_GAP short of the top
       face instead of touching it, which removes the coplanarity
       without removing the visual edge. The top and bottom rings are
       unchanged: the top ring is meant to coincide with the top face's
       perimeter (that's the crisp board border) and reads correctly
       there.

       VERTICAL_GAP raised 0.012 -> 0.06 after the corner lines came
       back. The gap has to beat the top face's polygon offset in WORLD
       units, and that offset is not a fixed distance: polygonOffsetFactor
       multiplies the surface's depth SLOPE, which grows sharply as the
       board is viewed at a shallow angle. So the face is pushed back
       much further when the camera is low than when it is overhead, and
       0.012 only cleared the overhead case. At this camera distance the
       grazing-angle push works out around 0.03 world units, so 0.06
       carries roughly 2x margin across the pitch range. It is 16% of
       SLAB_THICKNESS, so the vertical stops just shy of meeting the top
       ring — not perceptible at play zoom, and only visible at all from
       low angles where the slab's side is in view.

       If this ever recurs, do NOT just raise this number again: the
       better lever is splitting the offset, dropping
       polygonOffsetFactor (the slope-scaled term that misbehaves at
       grazing angles) while raising polygonOffsetUnits (the constant
       term), since the gap this offset actually needs to cover — a
       piece's outline shell dipping below the board — is a roughly
       fixed world-space amount that does not depend on view angle. */
    const halfSlabX = SLAB_X / 2;
    const halfSlabZ = SLAB_Z / 2;
    const topY = SLAB_THICKNESS / 2;
    const botY = -SLAB_THICKNESS / 2;
    const VERTICAL_GAP = 0.06;
    const slabCorners = [
      [-halfSlabX, -halfSlabZ],
      [halfSlabX, -halfSlabZ],
      [halfSlabX, halfSlabZ],
      [-halfSlabX, halfSlabZ],
    ];
    /* The top ring specifically has been through two failed fixes for
       the SAME underlying tension before this one — worth reading if
       this ever needs touching again:

       1. A world-space Y offset (topY + 0.07, matching makeGrid's own
          gridLines/border margins) to stop it losing the depth test
          against the top face's own polygon-offset push. This worked
          for the depth test, but the offset perspective-foreshortens
          into a visibly floating line at grazing camera angles — small
          in world space, but on-screen size grows the more edge-on the
          view gets, since foreshortening compresses the surrounding
          depth cues while the vertical gap itself doesn't shrink.

       2. depthTest:false on a zero-offset ring — no foreshortening
          (nothing is geometrically displaced), but disabling the depth
          test means it also draws over opaque PIECES near the edge at
          completely ordinary angles, not just grazing ones, which is a
          more common and more objectionable bug than the one it fixed.

       Both failed for the same reason: LineBasicMaterial can't carry a
       real GPU polygon offset in WebGL — three.js only ever enables
       GL_POLYGON_OFFSET_FILL (filled polygons), never the LINE
       variant, so `polygonOffset` on a Line material is silently a
       no-op. That ruled out the standard, purpose-built tool for
       "two coincident surfaces, make THIS one win the depth test
       without moving it" — which is exactly this problem.

       The actual fix: render the top ring as a thin quad-frame MESH
       instead of a Line, positioned at EXACTLY topY (zero geometric
       offset — no foreshortening possible at any angle), with a real
       negative polygonOffset. Meshes get genuine hardware polygon
       offset support, so this wins the depth test against the
       coincident top face by a tiny, fixed NDC-depth bias — not a
       world-space displacement — while remaining fully depth-TESTED
       against everything else, so a piece that's actually in front of
       it (a real, much larger depth difference than this bias) still
       correctly occludes it. See buildTopRingFrame below. */
    const edgePts = [];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = slabCorners[i];
      const [x2, z2] = slabCorners[(i + 1) % 4];
      // bottom ring
      edgePts.push(x1, botY, z1, x2, botY, z2);
      // vertical, stopping short of the top face
      edgePts.push(x1, botY, z1, x1, topY - VERTICAL_GAP, z1);
    }
    const slabEdgeGeo = new THREE.BufferGeometry();
    slabEdgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePts, 3));
    const slabEdges = new THREE.LineSegments(
      slabEdgeGeo,
      new THREE.LineBasicMaterial({ color: HEX.charcoal, transparent: true, opacity: 0.45 })
    );
    slabEdges.position.copy(slab.position);

    /* Thin quad-frame mesh for the top ring — see the long comment
       above slabEdgeGeo for why this needs to be a Mesh (real polygon
       offset support) rather than a Line (silently no-op in WebGL).
       `y` is a LOCAL coordinate in the same space as topY/botY above;
       `position.copy(slab.position)` below lands it at world y=0,
       exactly coincident with the slab's own top face, matching how
       slabEdges' own top-ring-turned-bottom-ring math already works. */
    // Takes both half-extents, not one: the plate is only square at a
    // square board size, and a single value would draw the ring to the
    // wrong depth on every other one.
    function buildTopRingFrame(halfX, halfZ, y, width, color, opacity) {
      const innerX = halfX - width;
      const innerZ = halfZ - width;
      const outer = [
        [-halfX, -halfZ], [halfX, -halfZ],
        [halfX, halfZ], [-halfX, halfZ],
      ];
      const inn = [
        [-innerX, -innerZ], [innerX, -innerZ],
        [innerX, innerZ], [-innerX, innerZ],
      ];
      const positions = [];
      const indices = [];
      for (let i = 0; i < 4; i++) {
        const [ox1, oz1] = outer[i];
        const [ox2, oz2] = outer[(i + 1) % 4];
        const [ix1, iz1] = inn[i];
        const [ix2, iz2] = inn[(i + 1) % 4];
        const vi = i * 4;
        positions.push(ox1, y, oz1, ox2, y, oz2, ix2, y, iz2, ix1, y, iz1);
        indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 0,
        // Negative pulls this surface's depth-buffer value CLOSER to
        // camera (the opposite direction from the top face's own +3,
        // which pushes IT back) — real hardware depth-test margin
        // against the coincident face, not a vertex displacement, so
        // it costs nothing in on-screen position at any camera angle.
        polygonOffsetUnits: -4,
      });
      return new THREE.Mesh(geo, mat);
    }
    const TOP_RING_WIDTH = 0.025;
    const topRing = buildTopRingFrame(halfSlabX, halfSlabZ, topY, TOP_RING_WIDTH, HEX.charcoal, 0.45);
    topRing.position.copy(slab.position);

    const pieceGroup = new THREE.Group();
    const ghostGroup = new THREE.Group();

    /* Everything that should turn together — the slab, the grid, every
       piece, every footprint indicator — lives under one group. Camera
       and lights are NOT children of it: the viewer and the lamp stay
       put in world space, and this group spins beneath them, which is
       what makes each piece's shadow sweep as its facing to the fixed
       light changes, the way a lazy Susan looks under a fixed lamp. */
    const boardGroup = new THREE.Group();
    boardGroup.add(slab, slabEdges, topRing, theme.makeGrid(), pieceGroup, ghostGroup);
    scene.add(boardGroup);

    three.current = {
      scene,
      camera,
      renderer,
      boardGroup,
      pieceGroup,
      ghostGroup,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
    };

    /* Theme-owned ambient visual FX lifecycle — see ARCHITECTURE.md.
       `helpers.three` and `helpers.windingDownRef` let a theme's own
       schedulers read live scene state (e.g. picking two on-board piece
       meshes for an arc effect) without the chassis needing to know
       what any given theme's effects actually do. */
    ambientRef.current = theme.mountAmbientEffects(
      { titleRef, titleWrapRef, titleFxRef, turnHaloRef, turnLabelRef, cardRef, fxOverlayRef },
      { three, windingDownRef, awaitingBeginRef, audio: audioRef.current }
    );

    /* ---- camera positioning ---- */
    /* Reads the DAMPED view, never the raw input goal — see cam.current
       above. Called once per frame from tick(), after the goal has been
       eased toward.
       The camera itself only ever has two real degrees of freedom now:
       pitch (phi, how steeply you're looking down) and distance
       (radius) — its compass bearing is permanently fixed, always due
       "south" of the target. What used to be the camera's orbit angle
       (theta) now drives boardGroup.rotation.y instead, so heading
       changes turn the board rather than moving the viewer. The
       negation is not arbitrary: rotating the scene by +a with a fixed
       camera produces the same image as the old camera-orbits-by-(-a)
       formula did, so this preserves the exact drag direction that was
       already tuned — if it ever feels backwards, this one sign is the
       whole fix. */
    function applyCamera() {
      const { phi, radius, target, theta } = cam.current.view;
      camera.position.set(target.x, target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi));
      camera.lookAt(target);
      boardGroup.rotation.y = -theta;
    }
    three.current.applyCamera = applyCamera;
    applyCamera();

    /* Lets the pre-game framing effect (outside this mount-once effect
       — it reacts to titleRef/dockPieceMountRef layout instead, see
       near the masthead state below) measure how tall the board reads
       on screen at a hypothetical radius, without disturbing the LIVE
       camera: tick() re-derives camera.position from cam.current.view
       every frame regardless, so a transient position/lookAt set here
       is overwritten on the very next frame and never actually renders.
       Includes the tallest real piece (Opa, h * PIECE_SCALE = 2 * 0.8)
       at every corner, not just the bare board plate, since a piece
       standing on the near or far edge is what would actually clip
       into the masthead or dock first. */
    const TALLEST_PIECE_HEIGHT = 2 * PIECE_SCALE;
    three.current.measureBoardPx = function (radius, phi, theta, target) {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return null;
      camera.position.set(target.x, target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi));
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const halfX = SLAB_X / 2, halfZ = SLAB_Z / 2;
      const cosT = Math.cos(-theta);
      const sinT = Math.sin(-theta);
      let minY = Infinity;
      let maxY = -Infinity;
      for (const x of [-halfX, halfX]) {
        for (const z of [-halfZ, halfZ]) {
          const rx = target.x + x * cosT + z * sinT;
          const rz = target.z + -x * sinT + z * cosT;
          // Absolute world Y (the board's real, fixed resting height and
          // the tallest piece above it) — NOT offset by target.y. The
          // board itself never moves; target.y is only ever the
          // camera's own pan/aim offset (see fitRadiusToBoard's sibling
          // measureBoxPx, which already takes heights as absolute
          // values for exactly this reason).
          // Adding target.y here used to translate the camera AND the
          // sampled points by the same amount, which cancels out in
          // the projection entirely — silently making target.y a
          // no-op for this function specifically, which is what let
          // the pre-game vertical-centering fix below appear to do
          // nothing until this was corrected.
          for (const y of [0, TALLEST_PIECE_HEIGHT]) {
            const v = new THREE.Vector3(rx, y, rz).project(camera);
            const py = (1 - (v.y * 0.5 + 0.5)) * h;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      return { top: minY, bottom: maxY, span: maxY - minY };
    };

    /* General-purpose sibling to measureBoardPx above, for fitting the
       camera to an arbitrary set of board-local (x,z) corners — used by
       fitRadiusToBoard (the SLAB's own corners), which both Current
       Player View and Top-Down View call to zoom to the whole board
       plate at their own respective pitch and margin/overflow. Returns
       BOTH the horizontal and vertical on-screen span, since a
       near-top-down view (Top-Down View's shallow phi) can be
       width-bound on a narrow viewport just as easily as a perspective
       view can be height-bound. */
    three.current.measureBoxPx = function (radius, phi, theta, target, corners, heights) {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return null;
      camera.position.set(target.x, target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi));
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const cosT = Math.cos(-theta);
      const sinT = Math.sin(-theta);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, z] of corners) {
        const rx = target.x + x * cosT + z * sinT;
        const rz = target.z + -x * sinT + z * cosT;
        for (const y of heights) {
          const v = new THREE.Vector3(rx, y, rz).project(camera);
          const px = (v.x * 0.5 + 0.5) * w;
          const py = (1 - (v.y * 0.5 + 0.5)) * h;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      return { width: maxX - minX, height: maxY - minY };
    };
    three.current.getMountSize = function () {
      const w = mount.clientWidth, h = mount.clientHeight;
      return w && h ? { w, h } : null;
    };

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      /* No trailing `false` here: that argument tells three.js to skip
         setting the canvas's CSS width/height, leaving them driven by
         its width/height attributes instead — which setSize scales by
         devicePixelRatio for a sharp drawing buffer. Nothing else in
         this component sets the canvas's CSS size, so on any display
         where devicePixelRatio isn't exactly 1 (most screens today),
         the canvas was rendering at up to 2x its container's size and
         getting cropped to the top-left by this element's
         overflow: hidden — which reads as the board being shifted
         out of center, even though the camera was aiming at the exact
         center of its own (oversized) frame the whole time. */
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- render loop ---- */
    let raf;
    let last = performance.now();
    function tick(now) {
      /* Clamped, not raw. The AI's move search runs synchronously and can
         block the main thread for hundreds of milliseconds — JS is
         single-threaded, so this loop simply can't tick at all while
         that's happening. The instant it finishes and starts the AI's
         first roll, the next frame's raw (now - last) would be the
         entire blocked duration, which is already bigger than the
         roll's whole 300ms — so the animation would complete on its
         first processed frame instead of playing. It wouldn't look
         unsmooth so much as not happen at all, just jump to the end.
         Capping dt at a generous 100ms (well above any normal frame,
         comfortably below any real animation's duration) fixes this
         and any other cause of a stalled frame the same way, not just
         this one call site. */
      const dt = Math.min(now - last, 100);
      last = now;

      const goal = cam.current;
      const view = goal.view;

      /* At least 20% of the board must always stay within the visible
         frame, at any pan position, any zoom level, any camera tilt,
         and any spin — a fixed, unconditional floor, not just a limit
         on how far a single drag can go. Enforced on the GOAL here,
         every frame, rather than only at the moment of a pan: radius
         and phi can change independently afterward (wheel, pinch,
         drag-to-tilt), and a pan that satisfied this at one zoom/tilt
         could otherwise become invalid at another without ever being
         re-checked.

         The two axes are each solved independently below, but their
         RESULTS are combined into one shared elliptical budget (see
         the joint scaling after the vertical solve) rather than kept
         as fully separate allowances. A real diagonal drag — the
         common case, not the exception — used to be able to walk
         each axis right up to its own independent 100% limit at the
         same time, and satisfying "board visible" on the horizontal
         axis alone and again on the vertical axis alone does not
         imply the board stays visible under BOTH offsets at once.
         Confirmed by instrumenting cam.current live during a
         diagonal alt-drag: horizontal landed exactly on its clamp
         boundary as intended, but vertical — evaluated as if
         horizontal were still zero — kept climbing drag after drag to
         several times the board's own half-extent, because a
         wide-open frustum at that tilt reports high "overlap" on the
         board's forward/back span regardless of how far the view has
         already drifted sideways. The board ended up almost entirely
         off-screen despite both individual checks reporting success.
         The elliptical coupling below is the fix: once horizontal has
         used up its own budget, vertical's independent limit is
         scaled toward zero by the same amount, and vice versa is left
         alone deliberately (horizontal keeps its full independent
         limit unconditionally, since it was already correct in
         isolation) — asymmetric, but minimal against a confirmed bug
         rather than a symmetric rewrite of code that already worked.

         HORIZONTAL (XZ): a circular clamp on the goal's distance from
         the board's own center, which is the origin — the board is
         square and centered there, so a symmetric radius is the
         natural fit.

         groundHalfSpan approximates the ground-plane distance from
         dead-center-of-view to the edge of the vertical FOV as if the
         camera were looking straight down (radius * tan(halfFOV)).
         That's the SMALLEST such span across the actual pitch range —
         a grazing view shows MORE ground in the far direction, not
         less — so applying it uniformly in every horizontal direction
         is deliberately conservative: it can be somewhat stricter than
         strictly necessary in some directions, but can never let the
         board go further off-screen than intended in any of them.

         maxPanDistance is solved from requiring the overlap between
         the board's own span and the visible span to be at least
         MIN_VISIBLE_FRACTION of the board's width:
         boardHalfExtent*(1-2*MIN_VISIBLE_FRACTION), plus the visible
         half-span itself.

         Raised from 0.2 to 0.5 per feedback that the board was still
         very easy to pan almost entirely out of view — confirmed via
         a real alt-drag test: at 0.2, a sustained pan left barely a
         sliver of the board in frame, which is exactly what "at least
         20% visible" actually permits, just far too permissive to feel
         like a floor at all. The vertical clamp below got the
         equivalent tightening (0.45/0.15 -> a uniform 0.75) in an
         earlier round of feedback; this axis was simply never brought
         up to match. 0.5 specifically because it's the value at which
         this formula's own boardHalfExtent term vanishes to exactly
         zero (1 - 2*0.5 = 0) rather than going negative — the clamp
         distance becomes purely groundHalfSpan, i.e. the visible
         window's center can never leave the board's own silhouette,
         which stays well-behaved at every zoom level without needing
         a separate floor on the result. Matching the vertical case's
         0.75 exactly was checked and would still stay positive across
         the real zoom range (barely — 0.6 world units at the closest
         zoom), but 0.5 leaves headroom against the same kind of edge
         case rather than sitting right at the boundary of it. */
      const MIN_VISIBLE_FRACTION = 0.5;
      /* Per feedback, no more than 25% of the board may ever be fully
         out of viewing range in the vertical direction, at ANY tilt
         angle — so both vertical floors are now 0.75 (== 25% max out
         of view), same value in both directions rather than the
         previous asymmetric 0.45/0.15 split, which still let up to
         85% of the board pan out of view toward the top. This calls
         the exact numerically-validated model below (clampVerticalTarget)
         at every phi, so the 75% floor holds across the whole tilt
         range, not just at whatever angles were spot-checked before. */
      const BOTTOM_MIN_VISIBLE_FRACTION = 0.75;
      const TOP_MIN_VISIBLE_FRACTION = 0.75;
      const halfFovRad = (camera.fov / 2) * (Math.PI / 180);
      /* groundHalfSpan below must stay safe regardless of which way the
         camera is currently oriented (theta) — a world-space XZ pan can
         land on screen as a purely sideways, purely depth-wise, or
         diagonal motion depending on heading, so "safe in every
         direction" has to mean safe against the narrower of the two
         on-screen axes. camera.fov is Three's VERTICAL fov; on a
         narrow/tall viewport (aspect < 1 — a phone held in portrait,
         the common case) the true horizontal fov is smaller than that,
         so deriving groundHalfSpan from the vertical fov alone silently
         permits far more pan than keeps the board's on-screen width
         within the guaranteed fraction. Confirmed against a captured
         mobile-portrait recording: a horizontal drag pushed the board
         fully off-screen despite this clamp, on a device narrow enough
         (aspect ~0.45) that the gap between the two fovs is large.
         Taking the smaller of the two keeps the circle conservative on
         any aspect ratio, the same way it's already deliberately
         conservative across the pitch range (see above). */
      const halfHFovRad = Math.atan(Math.tan(halfFovRad) * camera.aspect);
      const groundHalfSpan = goal.radius * Math.tan(Math.min(halfFovRad, halfHFovRad));
      const maxPanDistance = (SLAB_MIN / 2) * (1 - 2 * MIN_VISIBLE_FRACTION) + groundHalfSpan;
      const panDistSq = goal.target.x * goal.target.x + goal.target.z * goal.target.z;
      if (panDistSq > maxPanDistance * maxPanDistance) {
        const panK = maxPanDistance / Math.sqrt(panDistSq);
        goal.target.x *= panK;
        goal.target.z *= panK;
      }
      /* How much of the horizontal budget the current position already
         spends, 0 (dead center) to 1 (right at the circular clamp
         above) — fed into the vertical solve below to couple the two
         axes. maxPanDistance is 0 only in a degenerate zero-radius
         case that never occurs in practice, but the guard keeps this
         finite regardless. */
      const horizUsage =
        maxPanDistance > 0
          ? Math.min(1, Math.sqrt(goal.target.x * goal.target.x + goal.target.z * goal.target.z) / maxPanDistance)
          : 0;

      /* VERTICAL (Y): panBy's vertical drag component moves target
         along the camera's own tilted up-vector, not world-up, so it
         can carry target.y off the board's actual plane (y=0) — a
         failure mode the horizontal clamp above cannot see at all,
         since it only looks at x/z.

         This calls the exact, numerically-validated model (see
         boardVerticalOverlapFraction / clampVerticalTarget, defined
         near pivotFor) rather than a closed-form approximation. That
         matters here specifically: an earlier attempt at a simple
         formula (maxPanDistance / sin(phi), on the theory that a
         vertical drift's on-screen effect scales with sin(phi)) was
         checked against the real ray-plane geometry across a full
         radius/phi grid and failed EVERY test — panning down always
         reported 0% board visibility while the formula still called it
         safe, because it had no way to notice the camera itself
         descending to or below board level. The true relationship is
         asymmetric between panning up and down and doesn't reduce to
         one clean expression, which is exactly why this is solved
         numerically per-frame against the actual geometry (24
         bisection steps against a couple of trig calls each — trivial
         cost) instead of approximated.

         The required visible fraction is ALSO asymmetric, deliberately
         — confirmed by directly projecting the board's center to
         screen space: positive target.y moves the board toward the
         BOTTOM of frame, negative toward the TOP.

         TOP_MIN_VISIBLE_FRACTION (15%) replaces what used to be an
         artificial camera-height floor. That floor was a workaround
         for a genuine bug in rayHitBoardPlaneY0 (see its own comment):
         at near-top-down pitch with a sufficiently negative target.y,
         two failure modes that needed to be treated oppositely — a ray
         genuinely reaching the horizon, versus a ray whose camera has
         already passed below the board and is looking away from it —
         were being conflated, which could make the board register as
         100% visible while the camera looked directly away from it.
         With that fixed at the root, the camera is free to go to or
         below board level (confirmed acceptable), governed by nothing
         but this function's own, now-correct output — no artificial
         floor needed or present. BOTTOM_MIN_VISIBLE_FRACTION (45%)
         applies only to the bottom direction, unchanged from before. */
      const verticalMinFraction = goal.target.y > 0 ? BOTTOM_MIN_VISIBLE_FRACTION : TOP_MIN_VISIBLE_FRACTION;
      /* clampVerticalTarget(goal.target.y, ...) would only clamp when
         goal.target.y ITSELF already fails the visibility check — a
         no-op whenever it's still within its own independent bound,
         which is exactly the case a diagonal drag hits (see the joint
         elliptical comment above): vertical looks individually fine
         while horizontal is already maxed out. Probing with a value
         far outside any real range instead (same sign as the current
         target, since the two directions are asymmetric) finds the
         TRUE independent boundary regardless of where goal.target.y
         currently sits, so it can be scaled down by horizUsage below
         rather than only being checked in isolation. 1000 world units
         is far past anything boardVerticalOverlapFraction could ever
         call visible at any real radius/phi, and 0 is always the
         known-safe other end of the search per clampVerticalTarget's
         own invariant, so the bisection still converges correctly. */
      const verticalSign = goal.target.y >= 0 ? 1 : -1;
      const verticalMaxMag = Math.abs(
        clampVerticalTarget(verticalSign * 1000, goal.radius, goal.phi, halfFovRad, verticalMinFraction)
      );
      const verticalBudget = Math.sqrt(Math.max(0, 1 - horizUsage * horizUsage));
      const verticalAllowedMag = verticalMaxMag * verticalBudget;
      goal.target.y = verticalSign * Math.min(Math.abs(goal.target.y), verticalAllowedMag);

      /* Ease the rendered camera toward wherever input currently wants it.
         1 - e^(-dt/1000 * damping) is frame-rate independent: the same
         visual catch-up speed whether the tab is doing 30fps or 120fps,
         rather than a per-frame constant that would feel different
         across devices. damping itself isn't always the same constant
         — see RESET_CAMERA_DAMPING above for why a reset briefly uses a
         slower one. */
      const damping = now < resetTransitionUntilRef.current ? RESET_CAMERA_DAMPING : CAMERA_DAMPING;
      const k = 1 - Math.exp((-dt / 1000) * damping);
      /* Theta accumulates without bound as the board is spun, so a
         plain (goal - view) difference could be several full turns —
         e.g. recentring after a long session would spin past the target
         several times before settling. Wrapping the difference into
         [-PI, PI) always takes the short way round instead. */
      const rawDiff = goal.theta - view.theta;
      const wrapped = ((rawDiff % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      view.theta += wrapped * k;
      view.phi += (goal.phi - view.phi) * k;
      view.radius += (goal.radius - view.radius) * k;
      view.target.lerp(goal.target, k);
      applyCamera();

      // Reuses the exact same zoom bounds the camera clamp already
      // uses, so a theme's ambient audio can never disagree with what
      // "fully zoomed in" actually means. A no-op for a theme whose
      // audio doesn't react to zoom.
      audioRef.current.setZoom((ZOOM_MAX_FOR_BOARD - view.radius) / (ZOOM_MAX_FOR_BOARD - ZOOM_MIN));

      const a = anim.current;
      if (a) {
        a.elapsed += dt;
        const t = Math.min(a.elapsed / a.duration, 1);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        /* Residual eased separately from rotation, but — critically —
           on a curve that ARRIVES AT ZERO VELOCITY, same as rotation
           does. This is the fix for pieces appearing to spring or snap
           to a slightly longer shape just after landing.

           The residual is a horizontal "catch-up" slide needed only
           because a piece's own size (PIECE_SCALE) is deliberately
           smaller than the square grid it moves across (SQUARE_SIZE);
           it is roughly a third of a piece's own size, so how it
           arrives is very visible. It was moved off rotation's curve
           to concentrate it toward landing, which helped — but the
           curves used (t^3, then t^2) both have MAXIMUM velocity at
           t=1. Both endpoints reached 1, so the piece landed in the
           right place, but it was still travelling at full speed the
           instant the animation ended and then stopped dead. A
           velocity discontinuity along the direction of travel reads
           exactly as a snap to a longer shape at the moment of
           landing.

           That also explains why only rolling pieces showed it and the
           Cabeza never did: the Cabeza slides via lerpVectors on the
           rotation easing below, whose velocity decays to zero, and it
           has no residual at all. Only rolls carry one.

           smoothstep(t)^2 keeps the backloading exactly — it is 0.25
           at the midpoint, identical to t^2 — while its derivative at
           t=1 is 0, matching rotation's. Same distance, same
           destination, same duration, same late-weighting; the only
           thing that changes is that it decelerates into the landing
           instead of slamming into it. Any future curve here must
           satisfy f(0)=0, f(1)=1, and f'(1)=0. */
        const smoothstep = t * t * (3 - 2 * t);
        const residualE = smoothstep * smoothstep;

        if (a.kind === "roll") {
          a.pivot.setRotationFromAxisAngle(a.axis, a.angle * e);
          a.pivot.position.copy(a.base).addScaledVector(a.dirVec, a.residual * residualE);
        } else {
          /* Flat glide, no vertical arc — the Cabeza slides rather than
             rolls, so it has no physical reason to lift off the board. */
          a.carrier.position.lerpVectors(a.from, a.to, e);
        }

        if (t >= 1) {
          const done = a.onComplete;
          anim.current = null;
          done && done();
        }
      }

      /* Ghost (move-indicator) opacity fades — a fixed GHOST_FADE_MS
         transition toward whatever userData.opacityTo currently is,
         driven by the same clamped `now` used everywhere else in this
         loop. Both directions are handled the same way: appearing
         (opacityFrom 0 -> a hot/cold target) and disappearing
         (whatever it currently is -> 0), and re-targeting mid-fade
         (hover moving to a different direction before the previous
         target was ever reached) works for free, since this always
         re-reads elapsed time against opacityStart rather than
         assuming a fade runs to completion uninterrupted. A handful of
         objects at most (one per legal-move direction), so this is
         cheap even though it runs every frame. The actual opacity
         value is applied via the theme's own setOpacity() — see
         theme.buildMoveIndicator — rather than touching .material
         directly, since Neon's indicator is a multi-mesh Group with no
         single material of its own; indicator.tick() separately drives
         Neon's own entrance-animation position/depth on top of this,
         entirely independent of the opacity fade. */
      if (ghostGroup) {
        for (let i = ghostGroup.children.length - 1; i >= 0; i--) {
          const c = ghostGroup.children[i];
          if (c.userData.kind !== "ghostLine") continue;
          const { opacityFrom, opacityTo, opacityStart, fadingOut, indicator } = c.userData;
          if (opacityStart === undefined) continue;
          const e = Math.min((now - opacityStart) / GHOST_FADE_MS, 1);
          const opacity = opacityFrom + (opacityTo - opacityFrom) * e;
          c.userData.currentOpacity = opacity;
          indicator.setOpacity(opacity);
          indicator.tick(now);
          if (fadingOut && e >= 1) {
            ghostGroup.remove(c);
            indicator.dispose();
          }
        }
      }

      ambientRef.current && ambientRef.current.tick(now);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      ambientRef.current && ambientRef.current.dispose();
      audioRef.current.dispose();
    };
  }, []);

  /* ------------------------ build pieces ------------------------- */
  // Keyed diff, not a full tear-down/rebuild: a piece whose object
  // reference is unchanged since the last time this ran had nothing
  // about it change (see commitRef's own comment on why that identity
  // holds for every piece a move didn't touch), so its existing mesh+
  // shell are already correct and are left alone — no dispose, no
  // rebuild, no repositioning. Only a piece that is new, whose reference
  // changed (moved/grew/shrunk), or that no longer exists gets touched.
  // This must keep every invariant the rest of the file depends on:
  // exactly one mesh (userData.kind "piece") and one shell (userData.kind
  // "shell") per live piece id, both live children of t.pieceGroup once
  // this effect finishes, since animateStep (userData.pieceId lookups),
  // hit-testing (userData.kind === "piece") and hover/selection all read
  // pieceGroup's children directly rather than through this cache.
  useEffect(() => {
    const t = three.current;
    if (!t.pieceGroup) return;
    if (anim.current) return; // mid-animation the moving mesh is live

    const group = t.pieceGroup;
    const cache = pieceMeshCacheRef.current;
    const seen = new Set();

    const disposeEntry = (entry) => {
      group.remove(entry.mesh, entry.shell);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      entry.shell.geometry.dispose();
      entry.shell.material.dispose();
    };

    pieces.forEach((p) => {
      seen.add(p.id);
      const cached = cache.get(p.id);
      if (cached && cached.pieceRef === p) return; // untouched since last render

      if (cached) disposeEntry(cached);

      const meta = PIECE_META[p.type];
      const isDark = p.owner === "dark";
      const isDisc = meta.shape === "disc";
      const center = pieceCenter(p);
      const y = restingY(p);

      const geo = isDisc
        ? new THREE.CylinderGeometry(
            (DISC_DIAM * PIECE_SCALE) / 2,
            (DISC_DIAM * PIECE_SCALE) / 2,
            DISC_H * PIECE_SCALE,
            40
          )
        : makeRoundedBox(
            p.w * PIECE_SCALE,
            p.z * PIECE_SCALE,
            p.h * PIECE_SCALE,
            EDGE_RADIUS
          );

      // Everything about HOW a piece is materialized and outlined is
      // theme-owned (see ARCHITECTURE.md) — Standard and Neon use
      // genuinely different rendering techniques here, not the same
      // function with different colors.
      const { mesh, shell } = theme.buildPieceVisual({ piece: p, isDark, isDisc, geo, center, y });
      group.add(mesh);
      group.add(shell);
      cache.set(p.id, { pieceRef: p, mesh, shell });
    });

    // Anything left in the cache but not in `pieces` was captured,
    // resurrected away, or otherwise removed from play — dispose it so
    // it doesn't leak, and drop it from the cache.
    cache.forEach((entry, id) => {
      if (!seen.has(id)) {
        disposeEntry(entry);
        cache.delete(id);
      }
    });
  }, [pieces]);

  /* Feeds the current position's "tension" to the audio engine, purely
     atmospheric (reads pieces, never writes game state). Standard's
     theme has no computeTension, so this is a no-op for it — the
     optional-chaining guard is metadata about which hooks a theme
     declares, not a chassis branch on which theme is active. */
  useEffect(() => {
    if (theme.computeTension) audioRef.current.setTension(theme.computeTension(pieces));
  }, [pieces]);

  /* ------------------------ build ghosts ------------------------- */
  /* A content signature for the current landing set. Rebuilding on
     entry count alone was both flickery and wrong: hovering a different
     piece with the same number of legal moves would have left stale
     footprints on the board. */
  const shadowSig = shadowEntries
    .map(([dir, m]) => {
      const c = m.candidate;
      return `${dir}:${c.row},${c.col},${c.w},${c.h},${c.z}${m.crushes ? "!" : ""}`;
    })
    .join("|");

  useEffect(() => {
    const t = three.current;
    if (!t.ghostGroup) return;

    const group = t.ghostGroup;
    /* Hit-planes (invisible raycast targets) are removed immediately,
       always — regardless of whether the visual line for the same
       direction is about to fade out below. They exist purely for
       picking, and a stale one left interactive during a fade would
       mean the board could still respond to clicking/hovering a target
       that no longer corresponds to the current selection or hover —
       exactly the class of bug this whole feature is fixing. */
    group.children
      .filter((c) => c.userData.kind === "ghost")
      .forEach((c) => {
        group.remove(c);
        c.geometry && c.geometry.dispose();
        c.material && c.material.dispose();
      });

    /* Existing ghostLines are never reused by matching `dir` across a
       shadowSig change — a "N" ghost for one piece and a "N" ghost for
       a different piece sit at entirely different candidate squares,
       so treating them as the same object would risk visibly snapping
       a line to a new position instead of cross-fading. Every existing
       line is retargeted to fade OUT here, unconditionally, and every
       entry below always creates a brand-new line to fade IN — a
       coincidental exact repeat would at worst cross-fade a line with
       an identical one sitting on top of it, which is invisible. */
    group.children
      .filter((c) => c.userData.kind === "ghostLine")
      .forEach((c) => setGhostLineTarget(c, 0, true));

    shadowEntries.forEach(([dir, move]) => {
      const cand = move.candidate;
      const isCrush = !!move.crushes;
      const cx = (cand.col + cand.w / 2) * SQUARE_SIZE - OFF_X;
      const cz = (cand.row + cand.h / 2) * SQUARE_SIZE - OFF_Z;

      /* Invisible hit target. A dashed line is a poor raycast target —
         thin, and full of gaps — so picking is done against a plane
         that is present but draws nothing. */
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(
          cand.w * SQUARE_SIZE * GHOST_SCALE,
          cand.h * SQUARE_SIZE * GHOST_SCALE
        ),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      hit.rotation.x = -Math.PI / 2;
      hit.position.set(cx, 0.02, cz);
      hit.userData = { dir, kind: "ghost", isCrush };
      group.add(hit);

      /* Move-indicator visual: entirely theme-owned (see
         theme.buildMoveIndicator in themes/standard.js and
         themes/neon.js) — Standard's own dashed square and Neon's
         animated corner-bracket reticle are genuinely different
         objects, not the same shape recolored. The chassis only owns
         WHEN this fades in/out or brightens on hover (below), via the
         returned setOpacity(); everything about HOW it looks and
         animates is the theme's call. */
      const hx = (cand.w * SQUARE_SIZE * GHOST_SCALE) / 2;
      const hz = (cand.h * SQUARE_SIZE * GHOST_SCALE) / 2;
      const indicator = theme.buildMoveIndicator({ cx, cz, hx, hz, isCrush, dir });
      indicator.root.userData = { dir, kind: "ghostLine", isCrush, indicator };
      /* Starts invisible and is immediately targeted to fade up to its
         real (hot/cold) opacity — see the hover-emphasis effect just
         below, which computes that value the same way it always has.
         This is what makes a newly-hovered or newly-selected piece's
         indicators fade IN instead of appearing instantly. Neon's own
         indicator additionally runs its own entrance animation on top
         of this opacity fade (see its tick()), driven independently. */
      setGhostLineTarget(indicator.root, isCrush ? 0.8 : 0.5, false);
      group.add(indicator.root);
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [shadowSig]);

  /* Hover emphasis retargets the fade rather than setting opacity
     directly — sliding between footprints must not re-create meshes,
     and must not pop straight to the new value either, now that this
     is animated. Skips any line already fading out (from the effect
     above): its target is 0 regardless of hover state, since it no
     longer belongs to the current selection/hover at all. */
  useEffect(() => {
    const t = three.current;
    if (!t.ghostGroup) return;
    t.ghostGroup.children.forEach((c) => {
      if (c.userData.kind !== "ghostLine" || c.userData.fadingOut) return;
      const isHot = c.userData.dir === hoverShadow;
      const target = c.userData.isCrush ? (isHot ? 1 : 0.8) : isHot ? 0.95 : 0.5;
      if (c.userData.opacityTo !== target) setGhostLineTarget(c, target, false);
    });
  }, [hoverShadow, shadowSig]);

  /* --------------------------- moves ----------------------------- */
  const makeEntry = useCallback(
    (piece, dirs, mark) => ({
      player: piece.owner,
      notation: `${PIECE_META[piece.type].label}: ${dirs.join(".")}`,
      mark: mark || "",
    }),
    []
  );

  const endTurn = useCallback((nextLog, turnEntry) => {
    if (turnEntry) setTurnHistory((prev) => [...prev, turnEntry]);
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    setCurrentPlayer((prev) => (prev === "dark" ? "light" : "dark"));
    if (nextLog) setLog(nextLog);
  }, []);

  /* A piece that rolls out and back — E then W, N then S, or a Cabeza
     stepping out and returning — lands on exactly the square and
     orientation it started the turn in. That's not a move, it's the
     turn's starting position with extra steps spent getting nowhere, so
     it doesn't get logged and the turn does not pass. Every OTHER
     two-step combination (same direction twice, or mixing row/col axes
     via a diagonal-ish corner turn) genuinely changes at least one of
     row/col/w/h/z, so this check only ever fires on a true round trip —
     see rollBlock: E followed by W is the one pairing that's a literal
     algebraic inverse of itself. sameState itself now lives at module
     scope, alongside the other pure rules functions — the AI's turn
     generator (below) needs the exact same definition of "not a move"
     that the game engine enforces here, not a second copy that could
     drift out of sync with it. */
  function settleTurn(currentPieceState, notation) {
    const origin = turnSnapshot && turnSnapshot.find((p) => p.id === currentPieceState.id);
    aiDirsRef.current = null; // whichever branch below runs, this turn is over
    pendingIntentRef.current = null; // and so is any queued continuation for it
    if (origin && sameState(origin, currentPieceState)) {
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      return; // currentPlayer untouched, log untouched — as if this turn never happened
    }
    endTurn([...log, makeEntry(currentPieceState, notation)], {
      pieces: turnSnapshot || pieces,
      currentPlayer,
      log,
      status: "playing",
      winner: null,
      winReason: "",
      pieceId: currentPieceState.id,
      dirs: notation,
      crushedPiece: null,
    });
  }

  /* Commit runs after the animation lands, so board state and the
     rendered pose never disagree. */
  commitRef.current = (piece, dir, move) => {
    const notation = [...(piece.id === selectedId ? pendingNotation : []), dir];
    let nextPieces = pieces.map((p) => (p.id === piece.id ? move.candidate : p));

    if (move.crushes) {
      // Only a Cabeza can ever be `crushes` (see evaluateBlockLanding),
      // so reaching this branch always ends the game.
      audioRef.current.playCapture();
      windingDownRef.current = true;
      audioRef.current.playWin();
      audioRef.current.playPowerOff(); // any game ending plays Begin Game's reverse, not just a manual End Active Game
      audioRef.current.beginFadeOut(3);
      nextPieces = nextPieces.filter((p) => p.id !== move.crushes.id);
      setPieces(nextPieces);
      setLog([...log, makeEntry(piece, notation, "\u00d7")]);
      setTurnHistory((prev) => [
        ...prev,
        {
          pieces: turnSnapshot || pieces,
          currentPlayer,
          log,
          status: "playing",
          winner: null,
          winReason: "",
          pieceId: piece.id,
          dirs: notation,
          crushedPiece: move.crushes,
        },
      ]);
      setStatus("finished");
      setWinner(currentPlayer);
      setWinReason("Cabeza crushed");
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setBusy(false);
      aiDirsRef.current = null;
      return;
    }

    if (piece.type === "cabeza" && move.candidate.row === GOAL_ROW[piece.owner]) {
      windingDownRef.current = true;
      audioRef.current.playWin();
      audioRef.current.playPowerOff();
      audioRef.current.beginFadeOut(3);
      setPieces(nextPieces);
      setLog([...log, makeEntry(piece, notation, "\u2726")]);
      setTurnHistory((prev) => [
        ...prev,
        {
          pieces: turnSnapshot || pieces,
          currentPlayer,
          log,
          status: "playing",
          winner: null,
          winReason: "",
          pieceId: piece.id,
          dirs: notation,
          crushedPiece: null,
        },
      ]);
      setStatus("finished");
      setWinner(currentPlayer);
      setWinReason("Cabeza reached the far edge");
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setBusy(false);
      aiDirsRef.current = null;
      return;
    }

    audioRef.current.playLanding(piece.w * piece.h * piece.z);
    setPieces(nextPieces);
    setTurnSnapshot(turnSnapshot || pieces);
    setPendingNotation(notation);
    setHoverShadow(null);

    const used = (piece.id === selectedId ? stepsUsed : 0) + 1;
    const stillHasMoves = Object.keys(legalMovesFor(nextPieces, move.candidate)).length > 0;

    if (used >= PIECE_META[piece.type].maxSteps || !stillHasMoves) {
      settleTurn(move.candidate, notation);
    } else {
      setSelectedId(piece.id);
      setHoveredId(piece.id);
      setStepsUsed(used);
    }
    setBusy(false);
  };

  /* Animates one step from an explicit piece state. Kept separate from
     the rules so it can drive playback in either direction — forward for
     a move, inverted for an undo. On completion the parts are re-attached
     to the piece group with their world pose preserved, which is what
     lets steps be chained without a rebuild in between. */
  const animateStep = useCallback((state, dir, onDone) => {
    const t = three.current;
    const parts = t.pieceGroup.children.filter((c) => c.userData.pieceId === state.id);
    if (!parts.length) {
      onDone();
      return;
    }

    /* The motion is starting right now, for exactly `duration` ms — the
       one moment a theme's own audio can sync a rolling/tumbling cue to
       the actual animation, as opposed to playLanding below (fired only
       once the animation completes, i.e. already too late to sound like
       it accompanied the motion itself). Same shape/kind distinction as
       the branch below: the disc slides (SLIDE_MS) rather than rolls
       (ROLL_MS), though both constants share one value today. */
    audioRef.current.playRollStart(
      state.w * state.h * state.z,
      PIECE_META[state.type].shape === "disc" ? SLIDE_MS : ROLL_MS
    );

    /* Move-triggered ambient FX (weight lifting/landing glow, glitch
       bursts, landing shockwave) — entirely theme-owned. These
       properties only exist on three.current when a theme's own
       mountAmbientEffects put them there (see themes/neon.js); the
       `&&` guards make every one of these calls a no-op for a theme
       that never sets them, same as the original per-theme sources
       did before this component was shared. */
    const accentColor = state.owner === "dark" ? HEX.glowCyan : HEX.glowAmber;
    const originCenter = pieceCenter(state);
    t.pulseSquare && t.pulseSquare(state.row, state.col, state.w, state.h, "release");
    // Per feedback, the Cabeza never gets this either (same reasoning
    // as the landing shockwave/particles below): it rolls as a low
    // disc rather than tumbling, so the burst's particles — spawned
    // right at its own center — read as stray specks appearing inside
    // its body as it rolls, rather than a burst beside/behind it like
    // every other piece shape shows.
    if (state.type !== "cabeza") {
      t.spawnGlitchBurst && t.spawnGlitchBurst(new THREE.Vector3(originCenter.x, 0, originCenter.z), HEX.structureEdge);
    }

    /* Reparented onto boardGroup, not scene: the temporary pivot/carrier
       must inherit the board's current rotation, or a piece mid-animation
       while the board is spun to some heading would ignore that heading
       entirely and animate as if the board were still at zero. attach()
       in bake() already accounts for whatever transform boardGroup has
       at completion time, since attach() preserves world pose across a
       reparent regardless of the new parent's transform.

       A later attempt tried explicitly snapping each part's rotation to
       (0,0,0) and position to freshly-computed values here, reasoning
       it would eliminate tiny floating-point drift from attach()'s
       matrix math. That was wrong, and visibly so: the mesh's actual
       geometry isn't rebuilt with the piece's new, post-roll dimensions
       until the next "build pieces" React cycle runs — the 90° pivot
       rotation IS the mechanism making the old, still-unswapped-
       dimension geometry visually read as the new orientation in the
       meantime. Zeroing that rotation stripped away the only thing
       making the shape correct, leaving a piece that looked flattened
       — a real, confirmed regression, reverted outright. Whatever is
       causing the edge-flash-near-landing artifact this was trying to
       fix, it isn't this. */
    const bake = (carrier, landingFootprint, landingCenter) => {
      carrier.updateMatrixWorld(true);
      parts.forEach((c) => t.pieceGroup.attach(c));
      t.boardGroup.remove(carrier);
      if (landingFootprint) {
        t.pulseSquare && t.pulseSquare(landingFootprint.row, landingFootprint.col, landingFootprint.w, landingFootprint.h, "apply", accentColor);
        // Per Neon's own design, the Cabeza never gets the landing
        // shockwave (or the landing-impact particle shed below) — it
        // rolls as a disc, not a tumbling polyhedron; every other
        // piece type still gets both.
        if (state.type !== "cabeza") {
          t.spawnLandingShockwave && t.spawnLandingShockwave(
            landingFootprint.row, landingFootprint.col, landingFootprint.w, landingFootprint.h, landingFootprint.z, accentColor
          );
          t.spawnLandingParticles && t.spawnLandingParticles(
            landingFootprint.row, landingFootprint.col, landingFootprint.w, landingFootprint.h, landingFootprint.z, accentColor
          );
        }
      }
      if (landingCenter && state.type !== "cabeza") {
        t.spawnGlitchBurst && t.spawnGlitchBurst(new THREE.Vector3(landingCenter.x, 0, landingCenter.z), accentColor);
      }
      onDone();
    };

    if (PIECE_META[state.type].shape === "disc") {
      const [dr, dc] = STEP_DIRS[dir];
      const landing = { ...state, row: state.row + dr, col: state.col + dc };
      const from = pieceCenter(state);
      const to = pieceCenter(landing);
      const fromVec = new THREE.Vector3(from.x, 0, from.z);

      const carrier = new THREE.Object3D();
      carrier.position.copy(fromVec);
      t.boardGroup.add(carrier);
      parts.forEach((c) => {
        c.position.sub(fromVec);
        carrier.add(c);
      });

      anim.current = {
        kind: "slide",
        carrier,
        from: fromVec.clone(),
        to: new THREE.Vector3(to.x, 0, to.z),
        elapsed: 0,
        duration: SLIDE_MS,
        onComplete: () => bake(carrier, landing, to),
      };
      return;
    }

    const landing = rollBlock(state, dir);
    const landingCenter = pieceCenter(landing);
    const pv = pivotFor(state, dir);
    const pivot = new THREE.Object3D();
    pivot.position.copy(pv.point);
    t.boardGroup.add(pivot);
    parts.forEach((c) => {
      if (c.userData.kind === "shell") {
        /* Strip the at-rest +OUTLINE_T offset before this shell enters
           the roll. That offset is correct for a piece sitting still
           (see build-pieces, shell.position.set) — but this object
           already carries it from the moment the previous "build
           pieces" pass created it, and reparenting onto the pivot
           below would rotate that offset along with the piece for the
           whole animation. A rigidity simulation of this exact pivot
           math already proved what that does: the shell dips as far as
           -OUTLINE_T below the board, worse the closer the animation
           gets to landing — the original edge-flash bug this offset
           was reverted for once before. Restoring the offset at rest
           didn't reintroduce that bug at the FINAL frame (the shell is
           always discarded and rebuilt fresh once a roll completes),
           but it does reappear DURING the roll, since animateStep
           picks up whatever offset the shell already has at the
           moment the roll starts. Subtracting it here makes the shell
           enter the rotation symmetric — matching the mesh, safe
           through any rotation — and "build pieces" gives it back the
           correct offset fresh once this roll ends and rebuilds at
           rest. */
        c.position.y -= theme.outlineYOffset ?? 0;
      }
      c.position.sub(pv.point);
      pivot.add(c);
    });

    anim.current = {
      kind: "roll",
      pivot,
      base: pv.point.clone(),
      dirVec: pv.dirVec,
      residual: pv.residual,
      axis: pv.axis,
      angle: pv.angle,
      elapsed: 0,
      duration: ROLL_MS,
      onComplete: () => bake(pivot, landing, landingCenter),
    };
  }, []);

  const beginMove = useCallback(
    (piece, dir) => {
      if (!piece || anim.current || busy) return;
      const move = legalMovesFor(pieces, piece)[dir];
      if (!move) return;

      const t = three.current;
      setBusy(true);
      while (t.ghostGroup.children.length) t.ghostGroup.children.pop();

      // A fresh turn (this piece's first step) always starts with a
      // clean slate — any intent queued during a PREVIOUS turn's
      // animation has already either been consumed or is now moot.
      const isFirstStep = !(piece.id === selectedId && stepsUsed > 0);
      if (isFirstStep) pendingIntentRef.current = null;

      // Whether a second step could follow this one, and if so, what it
      // would be allowed to be — see inFlightRef's own field comment.
      // Computed up front, synchronously, from data this closure already
      // has, so a tap arriving mid-animation has something to match
      // against without waiting for the animation to actually finish.
      const usedAfter = (piece.id === selectedId ? stepsUsed : 0) + 1;
      const terminal =
        !!move.crushes || (piece.type === "cabeza" && move.candidate.row === GOAL_ROW[piece.owner]);
      const canContinue = !terminal && usedAfter < PIECE_META[piece.type].maxSteps;
      if (canContinue) {
        let afterStep = pieces.map((p) => (p.id === piece.id ? move.candidate : p));
        if (move.crushes) afterStep = afterStep.filter((p) => p.id !== move.crushes.id);
        inFlightRef.current = {
          pieceId: piece.id,
          landing: move.candidate,
          secondMoves: legalMovesFor(afterStep, move.candidate),
        };
      } else {
        inFlightRef.current = null;
      }

      animateStep(piece, dir, () => commitRef.current(piece, dir, move));
    },
    [pieces, busy, selectedId, stepsUsed, animateStep]
  );
  beginMoveRef.current = beginMove;

  /* Runs findBestAiTurn on a dedicated Worker thread (see engine/ai-
     worker.js and build/build.js's own comments on how it gets
     embedded) instead of the main one — a Hard-tier search can occupy
     a thread for its FULL time budget (up to 4.3s) in one synchronous
     stretch; findBestAiTurn's own yield-between-depths only ever gave
     other main-thread work a chance BETWEEN completed depths, never
     during the depth actually in progress, so the page (camera easing,
     ambient FX, any input) could still visibly lock up for a stretch
     right as a deep search ran. A real Worker removes the main thread
     from that path entirely. Mount-once: the worker's own lifetime
     matches this component instance's, not any single search. */
  const aiWorkerRef = useRef(null);
  const aiRequestsRef = useRef(new Map());
  const aiRequestIdRef = useRef(0);
  useEffect(() => {
    const scriptEl = document.getElementById("ai-worker-src");
    if (!scriptEl || !scriptEl.textContent) return; // no bundled worker (e.g. running from source) — runAiSearch below falls back to in-thread
    const blob = new Blob([scriptEl.textContent], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = (ev) => {
      const { requestId, turn, error } = ev.data;
      const pending = aiRequestsRef.current.get(requestId);
      if (!pending) return; // already handled, or this component instance is on its way out
      aiRequestsRef.current.delete(requestId);
      if (error) pending.reject(new Error(error));
      else pending.resolve(turn);
    };
    aiWorkerRef.current = worker;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
      aiWorkerRef.current = null;
    };
  }, []);
  function runAiSearch(pieces, aiPlayer, config, cabezaStreak, turnIndex) {
    const worker = aiWorkerRef.current;
    if (!worker) return findBestAiTurn(pieces, aiPlayer, config, cabezaStreak, turnIndex);
    const requestId = ++aiRequestIdRef.current;
    return new Promise((resolve, reject) => {
      aiRequestsRef.current.set(requestId, { resolve, reject });
      // `board` carries the current dimensions across the thread
      // boundary — the worker's own copy of engine/constants.js is a
      // separate module instance that this thread's setBoardDimensions()
      // can't reach. See engine/ai-worker.js.
      worker.postMessage({
        requestId, pieces, aiPlayer, config, cabezaStreak, turnIndex,
        board: getBoardDimensions(),
      });
    });
  }

  /* Drives the AI's entire turn from the outside, without commitRef.current
     needing to know AI exists at all. Two situations, both handled by
     the same effect since they share every guard:

     1. It just became the AI's turn (stepsUsed === 0, nothing queued):
        run the search, remember the whole chosen turn, and kick off its
        first step through the exact same beginMove a click would use.

     2. A step the AI already started just finished animating and the
        engine left the turn open (stepsUsed > 0, something queued):
        either continue to the AI's next queued direction, or — if the
        AI's plan only called for what's already been played, even
        though a second step is physically available — end the turn
        right there, the same way a human pressing "Stop here" would.

     Both branches defer through setTimeout + beginMoveRef/settleTurn
     rather than acting immediately: busy is still true from the step
     that just committed (state updates aren't visible synchronously
     within the same callback that triggered them), so calling beginMove
     directly here would hit its own guard and silently do nothing. The
     delay also happens to be exactly what keeps the AI's moves from
     feeling instant and robotic. */
  useEffect(() => {
    if (!isPlaying || busy || anim.current || currentPlayer !== aiPlayer || awaitingBegin) return;

    if (stepsUsed === 0 && !aiDirsRef.current) {
      setAiThinking(true);
      // Runs on the AI worker thread now (see runAiSearch above) — the
      // main thread stays fully responsive for the entire search,
      // including within a single depth, not just between completed
      // ones. `cancelled` guards against this timer's own 500ms delay
      // or the search's own duration outliving this effect run (a
      // fresh dependency change, e.g. a reset) — clearTimeout alone
      // can't cancel a Promise already in flight.
      let cancelled = false;
      const timer = setTimeout(async () => {
        const turn = await runAiSearch(
          pieces,
          aiPlayer,
          AI_DIFFICULTY[aiDifficulty],
          aiCabezaStreakRef.current,
          log.length // turns played so far — drives the opening jitter boost
        );
        if (cancelled) return;
        setAiThinking(false);
        if (!turn) return; // no legal turn at all — shouldn't normally happen
        aiDirsRef.current = turn;
        const piece = pieces.find((p) => p.id === turn.pieceId);
        if (piece) {
          aiCabezaStreakRef.current = piece.type === "cabeza" ? aiCabezaStreakRef.current + 1 : 0;
          beginMoveRef.current(piece, turn.dirs[0]);
        }
      }, 500);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    if (stepsUsed > 0 && aiDirsRef.current) {
      const { pieceId, dirs } = aiDirsRef.current;
      if (stepsUsed < dirs.length) {
        const timer = setTimeout(() => {
          const piece = pieces.find((p) => p.id === pieceId);
          if (piece) beginMoveRef.current(piece, dirs[stepsUsed]);
        }, 500);
        return () => clearTimeout(timer);
      }
      const piece = pieces.find((p) => p.id === pieceId);
      aiDirsRef.current = null;
      if (piece) settleTurn(piece, pendingNotation);
    }
  }, [currentPlayer, aiPlayer, isPlaying, busy, stepsUsed, pieces, aiDifficulty, pendingNotation, awaitingBegin, log]);

  /* Drains a human's queued continuation (see pendingIntentRef/onUp's
     busy branch above) the instant the step it was waiting on actually
     commits — mirrors the AI orchestration effect just above (same
     "busy/anim.current just cleared, act now" shape), but for a human's
     own already-decided next input instead of a fresh AI search. Only
     fires mid-turn (stepsUsed > 0); a turn that just settled already
     cleared pendingIntentRef itself (see settleTurn), so there's nothing
     left to drain once stepsUsed resets to 0. */
  useEffect(() => {
    if (busy || anim.current || !isPlaying || awaitingBegin || currentPlayer === aiPlayer) return;
    if (stepsUsed === 0) return;
    const intent = pendingIntentRef.current;
    if (!intent) return;
    pendingIntentRef.current = null;
    const piece = pieces.find((p) => p.id === intent.pieceId);
    if (!piece || piece.id !== selectedId) return;
    if (intent.kind === "stop") handleStopHere();
    else if (intent.kind === "move") beginMoveRef.current(piece, intent.dir);
  }, [busy, stepsUsed, isPlaying, awaitingBegin, currentPlayer, aiPlayer, pieces, selectedId]);

  /* --------------------------- input ----------------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t.renderer) return;
    const el = t.renderer.domElement;

    /* One input model. Touch fires BOTH pointer and touch events, so
       handling pinch on touchmove while rotate ran on pointermove meant
       a two-finger gesture rotated and zoomed at once from conflicting
       deltas — the artifacting. Tracking live pointers here makes the
       two gestures mutually exclusive. */
    const active = new Map();
    let dragging = false;
    /* Stays false until cumulative pointer travel since the down event
       crosses DRAG_DEAD_ZONE_PX — see onMove. Every touch carries a few
       pixels of contact-point jitter even when the finger is meant to be
       held still, and without a dead zone that jitter was reaching
       cam.current directly, so the board visibly rotated on almost every
       tap. Below the threshold, moves are tracked (moved still
       accumulates, for wasDrag below) but never reach the camera at all. */
    let dragArmed = false;
    /* Latched at pointerdown when Option/Alt is held, and held for the
       whole gesture rather than re-read on every move. Re-reading would
       let the mode flip mid-drag if the key were released, which reads
       as the board jumping between panning and rotating. Latching means
       a gesture is decided the moment it starts and stays that way
       until release, which is what makes it feel predictable. */
    let altPanning = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let pinchDist = 0;
    let panAnchor = null;
    /* Two-finger gesture recognition — a double-tap toggles full screen,
       a fast mostly-vertical swipe jumps to Current Player View (up) or
       Top-Down View (down) — layers on top of the pinch/pan handling
       above rather than replacing it: every two-finger contact still
       pinches and pans live exactly as before (see onMove), and is
       ADDITIONALLY classified as a tap or a swipe once it ends (see
       onUp), using the start time/position recorded here and in onDown.
       A genuine pinch-zoom or a slower deliberate pan naturally fails
       both the tap and swipe thresholds below and is simply left as the
       live pinch/pan it already performed — nothing needs to actively
       rule those out. */
    const TWO_FINGER_TAP_MAX_MS = 300; // a two-finger contact shorter than this, with barely any movement, is a tap
    const TWO_FINGER_TAP_MOVE_PX = 12; // max cumulative midpoint travel still counted as a tap, not a drag
    const TWO_FINGER_DOUBLE_TAP_MS = 400; // max gap between two taps to count as a double-tap
    const TWO_FINGER_SWIPE_MAX_MS = 700; // longer than this reads as a deliberate pan, not a flick
    const TWO_FINGER_SWIPE_MIN_PX = 60; // minimum net vertical travel to count as a swipe
    let twoFingerStartTime = 0;
    let twoFingerStartMid = null; // null whenever the current gesture isn't a clean two-finger contact (see onDown)
    let twoFingerLastMid = null;
    let twoFingerMoved = 0; // cumulative midpoint travel this gesture, for tap-vs-swipe
    let lastTwoFingerTapAt = 0; // wall-clock time of the previous qualifying tap, for double-tap detection
    /* Set at pointerdown when the contact starts directly on the
       currently mid-turn piece (turnLocked, hit.id === selectedId):
       the normalized on-screen direction from that piece's CURRENT
       position back to where it started this turn. onMove compares the
       gesture's own net drag direction against this — see "Undo Move"
       there — instead of orbiting the camera, for exactly this one
       gesture. null the rest of the time, which is what keeps every
       other drag (empty board, a different piece, a piece not yet
       moved) behaving exactly as before. */
    let undoDragTarget = null;
    let undoDownX = 0;
    let undoDownY = 0;
    // Projects a boardGroup-local (x, z) point (piece centers are
    // stored in the board's own local space, since pieceGroup is a
    // child of boardGroup and turns with it) to CSS pixel coordinates,
    // for comparing on-screen drag direction against a piece's own
    // on-screen position.
    function worldToScreen(x, z) {
      const v = new THREE.Vector3(x, 0, z);
      t.boardGroup.localToWorld(v);
      v.project(t.camera);
      const rect = el.getBoundingClientRect();
      return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
    }

    /* worldToScreen's inverse-ish counterpart, used ONLY for resolving a
       tap that arrives mid-animation (see onUp's busy branch below) —
       real ghost meshes don't exist yet at that point (beginMove clears
       them the instant a step starts), so there's nothing for the
       normal pick()/raycaster-vs-objects path to hit. This instead
       raycasts against the board's own (flat, always-present) surface
       plane and converts the hit into fractional board coordinates,
       independent of whatever meshes do or don't currently exist —
       exactly the row/col a real ghost for that square would occupy,
       just computed rather than picked. */
    function screenToBoardCell(ev) {
      const rect = el.getBoundingClientRect();
      t.pointer.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      t.raycaster.setFromCamera(t.pointer, t.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (!t.raycaster.ray.intersectPlane(plane, hit)) return null;
      const local = t.boardGroup.worldToLocal(hit.clone());
      return { col: (local.x + OFF_X) / SQUARE_SIZE, row: (local.z + OFF_Z) / SQUARE_SIZE };
    }
    // Whether a (fractional) board cell falls within a candidate
    // piece-state's footprint — the same rectangle a real ghost's hit-
    // plane would cover for that candidate, just tested by containment
    // instead of by raycasting an actual mesh.
    function cellInFootprint(cell, cand) {
      return (
        cell.col >= cand.col && cell.col <= cand.col + cand.w &&
        cell.row >= cand.row && cell.row <= cand.row + cand.h
      );
    }

    /* Latched at pointerdown, same as altPanning: whether the drag
       started above or below the canvas's own vertical midpoint. The
       board is viewed from an oblique angle, so a grab point on the
       visually "far" (upper-screen) half of it behaves like grabbing
       the far side of a physical turntable — dragging right there
       reads as the opposite rotation from grabbing the near (lower-
       screen) half, even though theta's own sign never changes. This
       flips theta's sign for an upper-half-started drag so both
       halves feel consistent with each other. */
    let dragFlipTheta = false;

    function pick(ev, opts = {}) {
      const rect = el.getBoundingClientRect();
      t.pointer.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      t.raycaster.setFromCamera(t.pointer, t.camera);

      const ghostHits = t.raycaster.intersectObjects(
        t.ghostGroup.children.filter((c) => c.userData.kind === "ghost"),
        false
      );
      const pieceHits = t.raycaster.intersectObjects(
        t.pieceGroup.children.filter((c) => c.userData.kind === "piece"),
        false
      );
      const nearestGhost = ghostHits[0];
      const nearestPiece = pieceHits[0];

      /* opts.respectDepth is for HOVER only (see onMove) — whichever
         hit is genuinely nearer the camera wins, instead of a ghost
         always taking priority regardless of what's actually on top.
         That's what makes a previously-hovered piece's ghosts
         correctly clear the instant the cursor is actually over
         something else, including a crush target sitting right on the
         ghost's own square.

         The default (used by CLICK, below) deliberately keeps the
         older "ghost always wins" behavior instead. A ghost's
         hit-plane sits almost exactly on its candidate square
         (GHOST_SCALE = 0.94), and for a crush move that square is
         occupied by the piece about to be crushed — clicking directly
         on that piece is the natural way to confirm "crush this one",
         and it has to keep registering as hitting the ghost and
         executing the move, not as trying to select an enemy piece and
         silently doing nothing. Depth-correctness fixes a hover bug;
         it would break this if applied to clicking too. */
      if (opts.respectDepth) {
        if (nearestGhost && (!nearestPiece || nearestGhost.distance < nearestPiece.distance)) {
          return { type: "ghost", dir: nearestGhost.object.userData.dir };
        }
        if (nearestPiece) return { type: "piece", id: nearestPiece.object.userData.pieceId };
        return null;
      }

      if (nearestGhost) return { type: "ghost", dir: nearestGhost.object.userData.dir };
      if (nearestPiece) return { type: "piece", id: nearestPiece.object.userData.pieceId };
      return null;
    }

    function pinchSpan() {
      const pts = [...active.values()];
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    function pinchMid() {
      const pts = [...active.values()];
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }

    /* Translates the orbit target across the camera's own screen plane,
       so two fingers moving together (rather than apart) slide the whole
       board rather than rotating or zooming it. Distance scales with how
       far the camera already is, so panning feels the same whether
       zoomed in tight or pulled back. */
    /* Reads the camera's own matrix, not the board's — correct as-is
       even with a spinning board, since the camera (unlike boardGroup)
       never rotates with heading anymore. Panning always shifts the
       fixed viewer's own screen-relative aim point, independent of
       whatever heading the board currently happens to be at. */
    function panBy(dxPx, dyPx) {
      const { camera } = t;
      const dist =
        cam.current.radius * Math.tan((camera.fov / 2) * (Math.PI / 180));
      const scale = (2 * dist) / el.clientHeight;

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);

      cam.current.target
        .addScaledVector(right, -dxPx * scale)
        .addScaledVector(up, dyPx * scale);
    }

    function onDown(ev) {
      // Audio must only ever start from the Begin Game button (see
      // beginGameFadeIn), never from an incidental camera-pan gesture
      // on the board before the game has begun. Once it has, this is
      // just a cheap suspended-context resume on later gestures.
      if (!awaitingBegin) audioRef.current.ensureStarted();
      active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      el.setPointerCapture && el.setPointerCapture(ev.pointerId);

      if (active.size === 1) {
        dragging = true;
        dragArmed = false;
        /* pointerType check is belt-and-braces: a touch contact won't
           carry altKey anyway, so excluding it here simply guarantees
           the touch paths below are reached in exactly the same states
           they were before this existed.

           Right-click (button 2) is a second, independent trigger for
           the exact same pan mode as Alt+left-click — both are decided
           right here, once, at the start of the gesture, into the same
           boolean. Nothing downstream (onMove's pan branch, onUp's
           click suppression, onCancel's cleanup) re-derives this from
           ev.altKey or ev.button again; they only ever read the
           latched value, so extending what sets it to true is the only
           change this needs — the rest of the pan behavior (including
           bypassing the drag dead zone in onMove) is inherited for
           free, identically to how Alt-drag already works. */
        altPanning = (!!ev.altKey || ev.button === 2) && ev.pointerType !== "touch";
        moved = 0;
        lastX = ev.clientX;
        lastY = ev.clientY;
        const rect = el.getBoundingClientRect();
        dragFlipTheta = ev.clientY - rect.top < rect.height / 2;
        el.style.cursor = "grabbing";

        // "Undo Move": dragging the piece that has already made a step
        // this turn back toward where it started undoes the turn, same
        // as clicking the Undo Move button — see the alignment check
        // in onMove. Only armed when a contact starts directly on that
        // exact piece, mid-turn, on the human's own turn.
        undoDragTarget = null;
        if (!altPanning && turnLocked && selectedId != null && !busy && !anim.current && currentPlayer !== aiPlayer && !awaitingBegin) {
          const hit = pick(ev);
          if (hit && hit.type === "piece" && hit.id === selectedId) {
            const origin = turnSnapshot && turnSnapshot.find((p) => p.id === selectedId);
            const current = pieces.find((p) => p.id === selectedId);
            if (origin && current) {
              const originScreen = worldToScreen(pieceCenter(origin).x, pieceCenter(origin).z);
              const currentScreen = worldToScreen(pieceCenter(current).x, pieceCenter(current).z);
              const ddx = originScreen.x - currentScreen.x;
              const ddy = originScreen.y - currentScreen.y;
              const dlen = Math.hypot(ddx, ddy);
              if (dlen > 1) {
                undoDragTarget = { dirX: ddx / dlen, dirY: ddy / dlen };
                undoDownX = ev.clientX;
                undoDownY = ev.clientY;
              }
            }
          }
        }
      } else {
        /* A second finger cancels the rotate outright rather than
           blending into it. */
        dragging = false;
        altPanning = false;
        pinchDist = active.size === 2 ? pinchSpan() : 0;
        panAnchor = active.size === 2 ? pinchMid() : null;
        if (active.size === 2) {
          // A clean two-finger contact starts here — see the field
          // comments above for how this feeds the tap/swipe
          // classification in onUp.
          twoFingerStartTime = performance.now();
          twoFingerStartMid = panAnchor;
          twoFingerLastMid = panAnchor;
          twoFingerMoved = 0;
        } else {
          // A third (or more) simultaneous contact is no longer a
          // clean two-finger gesture — never classify it as a tap or
          // swipe (see onUp).
          twoFingerStartMid = null;
        }
      }
    }

    function onMove(ev) {
      if (active.has(ev.pointerId)) {
        active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }

      if (active.size >= 2) {
        if (active.size === 2) {
          const d = pinchSpan();
          if (pinchDist && d > 0) {
            cam.current.radius = Math.max(
              ZOOM_MIN,
              Math.min(ZOOM_MAX_FOR_BOARD, cam.current.radius * (pinchDist / d))
            );
          }
          pinchDist = d;

          const mid = pinchMid();
          if (panAnchor) {
            panBy(mid.x - panAnchor.x, mid.y - panAnchor.y);
          }
          panAnchor = mid;

          // Tracks how far the two-finger midpoint has actually
          // traveled this gesture, independent of the live pan above —
          // see TWO_FINGER_TAP_MOVE_PX in onUp, which uses this to tell
          // a held-still tap apart from an intentional drag.
          if (twoFingerLastMid) {
            twoFingerMoved += Math.hypot(mid.x - twoFingerLastMid.x, mid.y - twoFingerLastMid.y);
          }
          twoFingerLastMid = mid;
        }
        return;
      }

      if (dragging) {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        lastX = ev.clientX;
        lastY = ev.clientY;

        if (undoDragTarget) {
          // Compares the gesture's NET drag (from the original
          // pointerdown, not this frame's delta) against the direction
          // captured at pointerdown, so a curved drag is judged by
          // where it ended up pointing overall, not each jittery step.
          // Never falls through to camera-rotate below while this
          // gesture is live — see the field comment on undoDragTarget.
          const totalDx = ev.clientX - undoDownX;
          const totalDy = ev.clientY - undoDownY;
          const totalLen = Math.hypot(totalDx, totalDy);
          if (totalLen > DRAG_DEAD_ZONE_PX) {
            const dot = (totalDx / totalLen) * undoDragTarget.dirX + (totalDy / totalLen) * undoDragTarget.dirY;
            if (dot > 0.55) {
              // Within ~56 degrees of dead-on toward the origin square.
              undoDragTarget = null;
              dragging = false;
              handleUndoTurn();
            }
          }
          return;
        }

        if (altPanning) {
          /* Same panBy the two-finger touch gesture uses, with the raw
             deltas passed through identically, so a mouse pan and a
             touch pan move the board the same distance in the same
             direction — the board follows the pointer. It writes to
             cam.current.target, the damped GOAL, so this inherits the
             render loop's existing easing and the pan feels like every
             other camera move rather than a separate mechanism.

             Intentionally ahead of the dragArmed dead zone below: that
             threshold exists to reject contact-point jitter from a
             finger meant to be held still, which cannot apply to a
             deliberate modifier-held mouse drag. Skipping it means the
             board tracks the cursor from the very first pixel of
             movement instead of swallowing the first ~10px. `moved`
             still accumulates, so the release path below still sees
             this as a drag and suppresses the click.

             Rotation (theta/phi) is never touched on this branch, and
             zoom/radius is not referenced at all, so a pan cannot
             disturb either. */
          panBy(dx, dy);
          return;
        }

        if (!dragArmed) {
          // Still inside the dead zone — this is contact-point jitter
          // from a held-still touch, not an intentional drag, so it
          // never reaches the camera. The first move that finally
          // crosses the threshold is swallowed too rather than applied
          // as a catch-up jump; rotation starts cleanly from wherever
          // the finger is the moment it's actually dragging.
          if (moved > DRAG_DEAD_ZONE_PX) dragArmed = true;
          return;
        }
        /* These only move the GOAL (cam.current); the render loop damps
           the actual view toward it every frame, which is what removes
           the raw, sample-for-sample twitchiness a direct 1:1 mapping had.
           theta here still uses the same sign it always did — dragging
           right still decreases it. What changed is downstream, in
           applyCamera: theta used to swing the camera around the board,
           now it spins the board itself (with a sign flip there), which
           is what reproduces the identical drag-right-feels-right
           direction players already learned, just via a fixed camera and
           a turning board instead of the other way around. */
        cam.current.theta -= dx * ORBIT_SENS_THETA * (dragFlipTheta ? -1 : 1);
        /* Lower bound is a hair above zero rather than zero itself: at
           exactly vertical the view direction is parallel to the camera's
           up vector and lookAt has no defined roll, which snaps the view.
           Upper bound pulled in from 1.45 (~83deg, nearly edge-on) after
           it turned out reachable at all: Neon's translucent pieces
           (depthWrite:false, an accepted trade-off — see buildPieceVisual's
           own comment on the rolling-piece z-fighting bug that traded
           for) sort by draw order rather than true depth at that shape,
           and a grazing enough view of several overlapping translucent
           pieces plus the grid produced a visibly wrong dark band, which
           Standard (opaque pieces) never showed at the identical angle —
           confirmed by removing slabEdges and the grid in turn and
           finding the artifact persisted in Neon regardless, then
           checking Standard at the same angle and finding nothing.
           1.25 (~72deg) stays low/dramatic while keeping clear of the
           angles where that showed up in testing. */
        cam.current.phi = Math.max(
          0.012,
          Math.min(1.25, cam.current.phi - dy * ORBIT_SENS_PHI)
        );
        return;
      }

      if (busy || !isPlaying || currentPlayer === aiPlayer || awaitingBegin) return;
      const hit = pick(ev, { respectDepth: true });
      if (hit && hit.type === "ghost") {
        el.style.cursor = "pointer";
        setHoverShadow((prev) => (prev === hit.dir ? prev : hit.dir));
        /* This was the actual bug: hitting a ghost returned here
           without ever touching hoveredId, so whatever piece was
           hovered before stayed hovered — and its whole preview stayed
           visible — for as long as the cursor remained anywhere inside
           that ghost's hit-plane, including areas the piece's own body
           doesn't cover. The fix isn't which hit wins (that's what
           respectDepth above already addresses, for when a DIFFERENT
           piece occludes a ghost) — it's that touching a ghost at all,
           on its own, was never a reason to keep hoveredId as it was.
           Only literal, direct contact with a piece's own mesh should
           keep its preview alive; leaving the piece for ANYTHING else
           — a different piece, empty board, or the piece's own ghost
           tiles — clears it, matching "leaving the piece, at all,
           should make the indicators disappear" exactly. Harmless to
           apply unconditionally (not just when nothing is selected):
           once a piece IS selected, hoveredId no longer affects what's
           shown at all, since selectedPiece already takes priority —
           see activePiece — so clearing it here has no visible effect
           in that case either way. */
        if (!turnLocked) setHoveredId((prev) => (prev === null ? prev : null));
        return;
      }
      setHoverShadow((prev) => (prev === null ? prev : null));

      if (hit && hit.type === "piece") {
        const p = pieces.find((x) => x.id === hit.id);
        const hoverable = !turnLocked && p && p.owner === currentPlayer;
        el.style.cursor = hoverable ? "pointer" : "grab";
        /* Resolves to the correct target every time a piece is hit —
           this piece if it's hoverable, otherwise null — rather than
           only ever setting hoveredId and silently leaving a stale
           value in place the rest of the time. That gap is what let a
           previously-hovered piece's ghosts keep showing after the
           mouse moved onto some other, non-hoverable piece. Guarded on
           !turnLocked to match the no-hit fallback below: once a piece
           is actually selected, hoveredId no longer affects what's
           shown (selectedPiece already takes priority — see
           activePiece), so there's nothing to correct while locked. */
        if (!turnLocked) {
          setHoveredId((prev) => {
            const next = hoverable ? p.id : null;
            return prev === next ? prev : next;
          });
        }
        return;
      }

      el.style.cursor = "grab";
      if (!turnLocked) setHoveredId((prev) => (prev === null ? prev : null));
    }

    function onUp(ev) {
      const wasMulti = active.size >= 2;
      // Exactly two, not "two or more" — a third contact having ever
      // joined this gesture already nulled twoFingerStartMid in onDown,
      // so classification below only ever fires for a clean two-finger
      // contact dropping back to one (or zero) fingers.
      const wasExactlyTwo = active.size === 2;
      const wasAltPan = altPanning;
      active.delete(ev.pointerId);
      el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
      el.style.cursor = "grab";

      /* Lifting one finger of a pinch must not resume a rotate from a
         stale anchor — that produced a jump. */
      if (active.size < 2) {
        pinchDist = 0;
        panAnchor = null;
      }
      if (active.size === 0) {
        dragging = false;
        altPanning = false;
      }

      /* Two-finger tap (toggles full screen on the SECOND qualifying
         tap within TWO_FINGER_DOUBLE_TAP_MS) and a fast, mostly-
         vertical two-finger swipe (Current Player View on an upswipe,
         Top-Down View on a downswipe) are classified right here, the
         moment a clean two-finger gesture drops back below two
         contacts — see the field comments where these are tracked, in
         onDown/onMove above. A genuine pinch-zoom or a slower two-
         finger pan simply fails both checks below and is left exactly
         as the live pinch/pan it already performed. */
      if (wasExactlyTwo && twoFingerStartMid) {
        const elapsed = performance.now() - twoFingerStartTime;
        const mid = twoFingerLastMid || twoFingerStartMid;
        const netDx = mid.x - twoFingerStartMid.x;
        const netDy = mid.y - twoFingerStartMid.y;

        if (elapsed < TWO_FINGER_TAP_MAX_MS && twoFingerMoved < TWO_FINGER_TAP_MOVE_PX) {
          const now = performance.now();
          if (now - lastTwoFingerTapAt < TWO_FINGER_DOUBLE_TAP_MS) {
            lastTwoFingerTapAt = 0;
            toggleFullscreen();
          } else {
            lastTwoFingerTapAt = now;
          }
        } else if (
          elapsed < TWO_FINGER_SWIPE_MAX_MS &&
          Math.abs(netDy) >= TWO_FINGER_SWIPE_MIN_PX &&
          Math.abs(netDy) > Math.abs(netDx) * 1.5
        ) {
          // Screen-space Y grows downward, so a positive netDy is a
          // downswipe (-> Top-Down View) and a negative one is an
          // upswipe (-> Current Player View) — both of these already
          // re-center the pan target themselves (see snapToCenter), so
          // whatever this gesture's own live two-finger pan did to
          // cam.current.target is simply overwritten, not restored.
          if (netDy > 0) topDownView();
          else recenterView();
        }
        twoFingerStartMid = null;
      }

      if (wasMulti) return;

      const wasDrag = moved > DRAG_DEAD_ZONE_PX;
      dragging = false;
      /* wasAltPan is checked explicitly rather than leaning on wasDrag:
         a deliberate but very short pan can finish under the movement
         threshold, and without this it would fall through and
         select/deselect a piece on release. An Option/Alt drag is never
         a click. */
      if (wasAltPan || wasDrag || !isPlaying || currentPlayer === aiPlayer || awaitingBegin) return;

      /* A step is currently animating: real ghost meshes don't exist to
         pick() against (beginMove already cleared them), so a tap here
         is resolved against the PROJECTED next-step candidates instead
         (see inFlightRef/screenToBoardCell/cellInFootprint above) and
         queued rather than acted on immediately — the effect that
         drains pendingIntentRef fires the instant this step's own
         animation actually commits, no further tap required. Per
         feedback that a player who already knows their whole turn
         shouldn't have to wait for each roll to finish before
         indicating the next one. */
      if (busy || anim.current) {
        const inFlight = inFlightRef.current;
        if (inFlight) {
          const cell = screenToBoardCell(ev);
          if (cell) {
            if (cellInFootprint(cell, inFlight.landing)) {
              // Tapping the square the piece is headed for — same
              // gesture as tapping the piece itself once it's actually
              // there (see the turnLocked branch below) — means "stop
              // here," don't chain a second step.
              pendingIntentRef.current = { pieceId: inFlight.pieceId, kind: "stop" };
            } else {
              for (const [dir2, move2] of Object.entries(inFlight.secondMoves)) {
                if (cellInFootprint(cell, move2.candidate)) {
                  pendingIntentRef.current = { pieceId: inFlight.pieceId, kind: "move", dir: dir2 };
                  break;
                }
              }
            }
          }
        }
        return;
      }

      const hit = pick(ev);
      if (hit && hit.type === "ghost" && activePiece) {
        beginMove(activePiece, hit.dir);
      } else if (hit && hit.type === "piece" && turnLocked && hit.id === selectedId) {
        // Tapping directly on the piece that's already made a step this
        // turn stops here, same as the "Stop here" button — handleStopHere
        // re-checks stepsUsed/etc. itself, so this is a no-op the one
        // frame the piece is mid-animation and not yet actually stoppable.
        handleStopHere();
      } else if (hit && hit.type === "piece" && !turnLocked) {
        const p = pieces.find((x) => x.id === hit.id);
        if (p && p.owner === currentPlayer) {
          const willSelect = selectedId !== p.id;
          willSelect ? audioRef.current.playSelect() : audioRef.current.playDeselect();
          setSelectedId((prev) => (prev === p.id ? null : p.id));
        }
      } else if (!hit && !turnLocked) {
        setSelectedId(null);
      }
    }

    function onCancel(ev) {
      active.delete(ev.pointerId);
      if (active.size < 2) {
        pinchDist = 0;
        panAnchor = null;
        // An interrupted two-finger gesture must never be classified
        // as a tap or swipe on some later, unrelated release.
        twoFingerStartMid = null;
      }
      if (active.size === 0) {
        dragging = false;
        altPanning = false; // an interrupted gesture must not leave the board latched in pan mode
      }
      el.style.cursor = "grab";
    }

    /* Laptop trackpad equivalents of the touch-only two-finger gestures
       above. Two of the four already work on a trackpad with no changes
       at all: a single-finger click-drag is just a mouse drag (orbit),
       and a trackpad's own pinch gesture reaches the browser as this
       same wheel event with an inflated deltaY, so it already zooms.
       The other two have no raw multi-touch events to read on a
       trackpad — the OS/driver consumes them and only ever hands the
       browser a wheel event (for a two-finger scroll) or a contextmenu
       event (the standard "two-finger tap = right-click" convention),
       never individual per-finger pointer events the way a touchscreen
       does — so they're recovered here from those two events instead. */
    let wheelBurstDy = 0;
    let wheelBurstDx = 0;
    let wheelBurstStart = 0;
    let wheelSwipeCooldownUntil = 0;
    const WHEEL_SWIPE_WINDOW_MS = 160; // how long a burst of wheel events is treated as one gesture
    const WHEEL_SWIPE_MIN_DY = 320; // net deltaY within that window to count as a flick, not a scroll/zoom
    const WHEEL_SWIPE_COOLDOWN_MS = 500; // guards against the same flick re-triggering as it decays

    function onWheel(ev) {
      ev.preventDefault();
      const now = performance.now();
      if (now - wheelBurstStart > WHEEL_SWIPE_WINDOW_MS) {
        wheelBurstStart = now;
        wheelBurstDy = 0;
        wheelBurstDx = 0;
      }
      wheelBurstDy += ev.deltaY;
      wheelBurstDx += ev.deltaX;
      /* A trackpad flick piles up far more distance far faster than
         either turning a mouse wheel or nudging the trackpad to zoom —
         that gap is what tells the two apart here, the same way
         TWO_FINGER_SWIPE_MIN_PX/MAX_MS do for an actual touchscreen.
         Below this threshold every event still falls through and zooms
         exactly as before, so ordinary scrolling is untouched. */
      if (
        now >= wheelSwipeCooldownUntil &&
        Math.abs(wheelBurstDy) >= WHEEL_SWIPE_MIN_DY &&
        Math.abs(wheelBurstDy) > Math.abs(wheelBurstDx) * 1.5
      ) {
        if (wheelBurstDy > 0) topDownView();
        else recenterView();
        wheelSwipeCooldownUntil = now + WHEEL_SWIPE_COOLDOWN_MS;
        wheelBurstDy = 0;
        wheelBurstDx = 0;
        return;
      }
      cam.current.radius = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX_FOR_BOARD, cam.current.radius + ev.deltaY * 0.014)
      );
    }

    /* Right-click is now a pan trigger (see onDown), so the browser's
       native context menu must never appear on this element at all —
       unconditionally, not just while a drag is in progress. preventDefault()
       on the contextmenu event itself is the standard, sufficient way
       to suppress it; it doesn't depend on which mouse button pattern
       or platform triggered the menu.

       It doubles as the trackpad's two-finger-tap gesture (see above):
       a second one arriving within TWO_FINGER_DOUBLE_TAP_MS of the
       first toggles full screen, the same trigger and the same window
       touch's own two-finger double-tap uses. */
    let lastContextMenuAt = 0;
    function onContextMenu(ev) {
      ev.preventDefault();
      const now = performance.now();
      if (now - lastContextMenuAt < TWO_FINGER_DOUBLE_TAP_MS) {
        lastContextMenuAt = 0;
        toggleFullscreen();
      } else {
        lastContextMenuAt = now;
      }
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [pieces, currentPlayer, turnLocked, activePiece, busy, isPlaying, beginMove, aiPlayer, awaitingBegin, selectedId, turnSnapshot]);

  /* --------------------------- actions --------------------------- */
  /* With the standalone rotate buttons gone, this is the only reset
     affordance left, so it clears everything a drag or pinch could have
     changed: heading, pitch, distance, and any pan offset. */
  /* Snaps the pan target to board-center on both the input goal and the
     rendered view, bypassing the usual damping. Centering is a
     correction, not a camera move — it should be true the instant the
     button is pressed, not something that eases into place over the
     next few frames while a prior pan is still visibly off-center. */
  function snapToCenter() {
    cam.current.target.set(0, 0, 0);
    cam.current.view.target.set(0, 0, 0);
  }

  /* Shared bisection core behind fitRadiusToBoard below: smallest
     radius, at the given heading/pitch, whose on-screen
     projection of an arbitrary set of board-local (x,z) corners still
     fits inside most of the viewport. Same technique as the pre-game
     masthead/dock framing above (see measureBoxPx). Returns null when
     the mount/measure helpers aren't ready yet — callers fall back to
     their own fixed radius in that case. */
  function fitRadiusToCorners(theta, phi, corners, heights, fitFraction = 0.82) {
    const measure = three.current.measureBoxPx;
    const getSize = three.current.getMountSize;
    if (!measure || !getSize) return null;
    const size = getSize();
    if (!size) return null;

    // Fit within most of the viewport, not edge-to-edge — leaves a
    // visible margin around the fitted box on every side, the same
    // spirit as the pre-game framing's own GAP_PADDING_PX. Callers that
    // want the fitted box to instead OVERFLOW the viewport (Current
    // Player View — see recenterView) pass a fraction above 1 here;
    // the bisection below is agnostic to which side of 1.0 this lands on.
    const availW = size.w * fitFraction;
    const availH = size.h * fitFraction;
    // Must be a real THREE.Vector3, not a plain {x,y,z} object: camera
    // .lookAt() checks target.isVector3 and silently corrupts its own
    // matrix with NaN (via Vector3.set(target, undefined, undefined))
    // when that check fails, which is what made every measure() call
    // below return {width: -Infinity, height: -Infinity} — read by the
    // bisection as "always fits," collapsing the result straight to
    // ZOOM_MIN regardless of the box's real size. That was the actual
    // cause of both views reading as far too zoomed in.
    const target = new THREE.Vector3(0, 0, 0);

    let lo = ZOOM_MIN, hi = ZOOM_MAX_FOR_BOARD;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const m = measure(mid, phi, theta, target, corners, heights);
      if (!m) return null;
      // Larger radius -> smaller on-screen size -> more likely to fit —
      // same monotonic bisection as measureBoardPx's own caller.
      if (m.width <= availW && m.height <= availH) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /* Smallest radius fitting the WHOLE board plate (the fixed SLAB
     footprint, same extent measureBoardPx uses) — both Top-Down View
     and Current Player View frame the entire board, not just wherever
     pieces happen to currently be clustered; they differ in pitch and
     in how much margin/overflow fitFraction asks for (see their own
     call sites). */
  function fitRadiusToBoard(theta, phi, fitFraction) {
    const halfX = SLAB_X / 2, halfZ = SLAB_Z / 2;
    const corners = [
      [-halfX, -halfZ], [-halfX, halfZ], [halfX, -halfZ], [halfX, halfZ],
    ];
    return fitRadiusToCorners(theta, phi, corners, [0, 2 * PIECE_SCALE], fitFraction);
  }

  // Standard media-query way to tell a touch-primary device (phone/
  // tablet) from a mouse/trackpad-primary one (laptop/desktop) — no
  // existing device-type check to reuse elsewhere in the chassis, so
  // this is intentionally the one place that needs it (see
  // captureViewBaselines' own desktop-only zoom-out).
  function isCoarsePointer() {
    return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }

  /* Computes and caches the ONE fit radius each of Current Player View
     and Top-Down View will use for the rest of this game — see the
     refs' own comment for why this exists (a resize between two
     presses of the same button used to reframe it, since the live fit
     re-measures the current canvas every time it runs). Called once,
     right when Begin Game is pressed (see its onClick), rather than
     lazily on first use of either button specifically so Top-Down
     View's own baseline is still pinned to game-start's window size
     even if the player never opens it until after a later resize.
     theta is irrelevant to the fit itself (a square board's corners
     measure identically at any 180°-symmetric heading), so 0 is used
     for both regardless of which side is actually about to move. */
  function captureViewBaselines() {
    const CURRENT_PLAYER_FIT_FRACTION = 1.1;
    const fittedCPV = fitRadiusToBoard(0, 0.86, CURRENT_PLAYER_FIT_FRACTION);
    // Per feedback, Current Player View reads too zoomed in specifically
    // on laptop/desktop — mobile was explicitly excluded. A 1.4x on the
    // fitted radius is a 40% reduction in zoom (farther away = less
    // zoomed in), baked into the captured baseline itself rather than
    // reapplied on every later read, since the baseline IS the fixed
    // answer for the rest of the game either way.
    const desktopZoomOutFactor = isCoarsePointer() ? 1 : 1.4;
    currentPlayerViewRadiusRef.current = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX_FOR_BOARD, (fittedCPV ?? 12.5) * desktopZoomOutFactor)
    );
    const ZOOM_PCT = 0.7;
    const fallback = ZOOM_MAX_FOR_BOARD - ZOOM_PCT * (ZOOM_MAX_FOR_BOARD - ZOOM_MIN);
    topDownViewRadiusRef.current = fitRadiusToBoard(0, 0.012) ?? fallback;
  }

  function recenterView() {
    /* Pitch and distance are still camera moves. Heading (theta) is now
       applied to the board's own rotation instead of the camera's orbit
       — see applyCamera — so setting it here spins the board to bring
       the current player's home edge toward the fixed viewer, rather
       than swinging the viewer around a fixed board. Either way, all
       three still glide through the render loop's damping; only
       centering (snapToCenter) is instant. */
    cam.current.theta = currentPlayer === "dark" ? Math.PI : 0;
    cam.current.phi = 0.86;
    // Reads the ONE radius captured at this game's Begin Game press
    // (see captureViewBaselines) rather than re-fitting live against
    // the current window size — per feedback, a resize between two
    // presses of this button should never change what it resets to.
    // The live-fit fallback only matters if this is somehow ever
    // reached before that capture has run once.
    if (currentPlayerViewRadiusRef.current == null) captureViewBaselines();
    cam.current.radius = currentPlayerViewRadiusRef.current;
    snapToCenter();
  }

  function topDownView(facePlayer = currentPlayer) {
    /* Same heading rule as Current Player View: snap to whichever of the
       two canonical facings — Dark-top/Light-bottom (0) or
       Light-top/Dark-bottom (π) — puts facePlayer's own edge toward the
       fixed viewer, never some arbitrary in-between angle left over
       from free dragging. Defaults to currentPlayer for the button's
       own click handler (unchanged behavior there), but takes an
       explicit override for handleReset: currentPlayer there is still
       the PREVIOUS game's value the instant this runs — setCurrentPlayer
       is async, so reading the closure directly would target whichever
       side finished last game, not whichever side (humanStartSide) the
       fresh one is actually about to start with. The render loop's
       existing shortest-path wrapping (see tick()) still animates the
       turn via whichever direction is shorter, so this never spins
       further than it has to to reach the correct side. Pitch is what
       actually distinguishes this button from Current Player View; zoom
       now fits the WHOLE board plate (see fitRadiusToBoard) — per
       feedback this view should always show the entire board, not
       zoom to wherever pieces currently happen to be clustered —
       falling back to the old fixed 70%-zoomed default only when
       there's nothing to fit against yet. */
    cam.current.theta = facePlayer === "dark" ? Math.PI : 0;
    cam.current.phi = 0.012; // matches the drag clamp's near-vertical limit
    // Reads the ONE radius captured at this game's Begin Game press
    // (see captureViewBaselines) — same reasoning as recenterView's
    // own comment: a resize between two presses must never change
    // what this button resets to.
    if (topDownViewRadiusRef.current == null) captureViewBaselines();
    cam.current.radius = topDownViewRadiusRef.current;
    snapToCenter();
  }

  function handleStopHere() {
    // Guards the human-facing entry point only — the AI's own orchestration
    // effect calls settleTurn directly, bypassing this, so its own
    // deliberate "stop after one step" still works during its turn.
    // busy/anim.current guard added to match handleUndoTurn right below —
    // without it, this button is visible and clickable during the SECOND
    // roll of a two-step turn (stepsUsed > 0 by then), and clicking it
    // ends the turn while that roll's own animation is still in flight,
    // before its own commit logic has had a chance to run.
    if (!selectedPiece || stepsUsed === 0 || busy || anim.current || currentPlayer === aiPlayer || awaitingBegin) return;
    settleTurn(selectedPiece, pendingNotation);
  }
  function handleUndoTurn() {
    if (!turnSnapshot || busy || anim.current || currentPlayer === aiPlayer || awaitingBegin) return;
    pendingIntentRef.current = null; // whatever was queued for this turn no longer applies

    const restore = () => {
      setPieces(turnSnapshot);
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      setSelectedId(null);
      setHoveredId(null);
      setHoverShadow(null);
      setBusy(false);
    };

    const moving = pieces.find((p) => p.id === selectedId);
    if (!moving || pendingNotation.length === 0) {
      restore();
      return;
    }

    const t = three.current;
    setBusy(true);
    while (t.ghostGroup.children.length) t.ghostGroup.children.pop();
    setHoverShadow(null);

    /* Walk the turn backwards, inverting each recorded direction. */
    const steps = [...pendingNotation].reverse().map((d) => INVERSE_DIR[d]);

    const run = (i, state) => {
      if (i >= steps.length) {
        restore();
        return;
      }
      const dir = steps[i];
      animateStep(state, dir, () => {
        const next =
          PIECE_META[state.type].shape === "disc"
            ? {
                ...state,
                row: state.row + STEP_DIRS[dir][0],
                col: state.col + STEP_DIRS[dir][1],
              }
            : rollBlock(state, dir);
        run(i + 1, next);
      });
    };

    run(0, moving);
  }
  function handleUndoLastTurn() {
    if (turnHistory.length === 0 || busy || aiThinking || turnLocked || anim.current || awaitingBegin) return;

    /* Collect the batch of entries to undo, most recent first. Against
       an AI opponent, keep walking past any entry the AI itself played
       — the point of this button is recovering from the HUMAN's own
       careless move, and landing on "it's the AI's turn again" without
       having touched the human's actual last decision wouldn't do
       that; it would just hand the human a turn they didn't ask to
       take back. Walking further back until an entry the human
       actually played is found means one click always lands at a
       point where it's genuinely the human's turn to decide again.
       Against a Human opponent (aiPlayer === null) every entry already
       satisfies this on the first check, so this reduces to a plain
       single-turn undo — there's no one to skip past. */
    const stack = [...turnHistory];
    const batch = [];
    while (stack.length > 0) {
      const entry = stack.pop();
      batch.push(entry);
      if (aiPlayer === null || entry.currentPlayer !== aiPlayer) break;
    }
    if (batch.length === 0) return;
    const target = batch[batch.length - 1]; // oldest entry in the batch — final restore target

    const t = three.current;
    setBusy(true);
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    while (t.ghostGroup.children.length) t.ghostGroup.children.pop();

    const finish = () => {
      // Undoing the winning move brings the game back to "playing" —
      // bring ambient audio/effects wind-down back with it, same as a
      // full reset (see handleReset).
      if (windingDownRef.current && target.status === "playing") {
        windingDownRef.current = false;
        // true: unlike a brand-new game, undoing back into active play
        // has no Begin Game button ahead of it to restore volume
        // through — this caller needs the opposite default.
        audioRef.current.resetWindDown(true);
        ambientRef.current && ambientRef.current.restart();
      }
      setPieces(target.pieces);
      setCurrentPlayer(target.currentPlayer);
      setLog(target.log);
      setStatus(target.status);
      setWinner(target.winner);
      setWinReason(target.winReason);
      setShowVictoryPlacard(false); // only ever auto-shown on finish, never auto-hidden
      setStepsUsed(0);
      setTurnSnapshot(null);
      setPendingNotation([]);
      aiDirsRef.current = null;
      setTurnHistory(stack); // whatever's left once the whole batch is removed
      setBusy(false);
    };

    /* Processes one batch entry's turn backward, then recurses to the
       next (older) one. workingPieces is threaded through explicitly,
       same reasoning as handleUndoTurn's run() above: mid-chain state
       updates exist to keep the THREE.js scene in sync via the
       "build pieces" effect, never to be read back as the source of
       truth for what happens next. */
    const processEntry = (idx, workingPieces) => {
      if (idx >= batch.length) {
        finish();
        return;
      }
      const entry = batch[idx];
      const steps = [...entry.dirs].reverse().map((d) => INVERSE_DIR[d]);

      const animateBack = (basePieces) => {
        const moving = basePieces.find((p) => p.id === entry.pieceId);
        if (!moving) {
          // Should not happen for a well-formed history, but fail soft
          // rather than throw if it ever does.
          processEntry(idx + 1, basePieces);
          return;
        }
        const runStep = (i, state) => {
          if (i >= steps.length) {
            processEntry(idx + 1, basePieces.map((p) => (p.id === state.id ? state : p)));
            return;
          }
          const dir = steps[i];
          animateStep(state, dir, () => {
            const next =
              PIECE_META[state.type].shape === "disc"
                ? { ...state, row: state.row + STEP_DIRS[dir][0], col: state.col + STEP_DIRS[dir][1] }
                : rollBlock(state, dir);
            runStep(i + 1, next);
          });
        };
        runStep(0, moving);
      };

      if (entry.crushedPiece) {
        /* The crushed piece's mesh was disposed the moment "build
           pieces" last ran without it — animateStep can't roll a piece
           back that has no mesh to find (see its own !parts.length
           guard, which would silently no-op). Add it back to React
           state first and let that same effect rebuild it, THEN
           animate the crushing piece's own reversal. The short delay
           is the same deferred-continuation pattern the AI
           orchestration effect already uses elsewhere in this file —
           a state update from synchronous code is reliably flushed
           and rendered before a setTimeout callback fires, so the
           rebuild is done well before this continues. */
        const withResurrected = [...workingPieces, entry.crushedPiece];
        setPieces(withResurrected);
        setTimeout(() => animateBack(withResurrected), 60);
      } else {
        animateBack(workingPieces);
      }
    };

    processEntry(0, pieces);
  }
  function handleReset() {
    // Invalidates both views' cached fit baselines — see the refs' own
    // comment. The NEXT Begin Game press (captureViewBaselines) recaptures
    // both fresh against whatever the window measures at that moment,
    // rather than this new game silently inheriting the previous one's.
    currentPlayerViewRadiusRef.current = null;
    topDownViewRadiusRef.current = null;
    // Undo a previous win's audio/visual wind-down, if any, so a new
    // game gets the ambient effects back rather than staying
    // permanently silent and static for the rest of the session.
    // "sfxOnly" restores one-off UI cues (dock open/close etc.)
    // immediately on the new setup screen, matching a fresh page load,
    // while keeping the ambient bed itself silent until Begin Game is
    // pressed again — see resetWindDown's own comment.
    if (windingDownRef.current) {
      windingDownRef.current = false;
      audioRef.current.resetWindDown("sfxOnly");
      ambientRef.current && ambientRef.current.restart();
    }
    /* If a roll or slide is mid-flight, force it to a clean stop before
       anything else. Without this: anim.current stays set through the
       setPieces call below, so the "build pieces" effect's own guard
       (mid-animation the moving mesh is live) skips its rebuild — but
       the interrupted animation is still running and will still reach
       its own completion callback moments later, which then calls
       commitRef.current using piece/move references captured back when
       THIS move began, before the reset. That splices one leftover
       piece, at a stale position, into what should have been a clean
       fresh board — not merely a visual gap, but New Game silently not
       actually resetting everything it claims to. Tearing the carrier
       down directly here (rather than just blocking the click) is what
       keeps New Game working as an immediate escape hatch regardless of
       what's happening on the board the instant it's pressed. */
    if (anim.current) {
      const t = three.current;
      const carrier = anim.current.pivot || anim.current.carrier;
      if (carrier && t.boardGroup) {
        carrier.children.forEach((c) => {
          c.geometry && c.geometry.dispose();
          c.material && c.material.dispose();
        });
        t.boardGroup.remove(carrier);
      }
      anim.current = null;
    }
    setPieces(createInitialPieces());
    setCurrentPlayer(humanStartSide); // New Game always lands in Human mode, so this is always the relevant preference
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    setTurnHistory([]);
    setLog([]);
    setStatus("playing");
    setWinner(null);
    setWinReason("");
    setShowVictoryPlacard(false);
    setLogCopied(false);
    setLogCopyFailed(false);
    setShowMoveLog(false);
    aiDirsRef.current = null;
    aiCabezaStreakRef.current = 0;
    setAiThinking(false);
    setAiPlayer(null); // New Game always starts back at Human vs Human
    setShowOpponentPicker(true); // and back to the picker view, not a stale Back+Difficulty view
    setGameArmed(false); // every fresh game — Human included — now waits on Begin Game
    resetTransitionUntilRef.current = performance.now() + RESET_TRANSITION_MS;
    // Faces the side about to move first, at the SAME oblique pitch
    // the setup screen always starts at (cam's own initial phi:0.86)
    // — NOT topDownView's near-vertical 0.012. This now goes back to
    // awaitingBegin's own pre-game framing effect (see it below,
    // watching [awaitingBegin]) to fit the radius/vertical centering
    // once the DOM has settled, the exact same path the very first
    // page load takes. Using topDownView here left phi at 0.012, which
    // that effect's bisection then (mis)used as if it were the normal
    // setup pitch, computing the fit for entirely the wrong camera
    // angle — this is what read as the board suddenly zooming in far
    // too close right after New Game.
    cam.current.theta = humanStartSide === "dark" ? Math.PI : 0;
    cam.current.phi = 0.86;
    snapToCenter();
  }

  /* Plain-text export of the move log, for copying out of the game
     entirely — e.g. pasting a completed game elsewhere for analysis.
     Reuses pairLog exactly as the display table does, so the exported
     text and what's on screen can never drift apart into two separate
     formats. Deliberately simple (one line per turn, minimal
     punctuation) rather than a structured format — nothing currently
     reads this back into the game, so there's no parser to satisfy,
     just a person or a paste target reading plain lines. */
  function handleCopyLog() {
    const rows = pairLog(log);
    const lines = rows.map((row) => {
      const dark = row.dark ? `${row.dark.notation}${row.dark.mark ? " " + row.dark.mark : ""}` : "\u2014";
      const light = row.light ? `${row.light.notation}${row.light.mark ? " " + row.light.mark : ""}` : "\u2014";
      return `${row.n}. Dark: ${dark} | Light: ${light}`;
    });
    const summary =
      status === "finished" && winner
        ? `Result: ${winner === "dark" ? "Dark" : "Light"} wins${winReason ? " \u2014 " + winReason : ""}`
        : status === "ended"
        ? "Game ended manually, no winner"
        : "";
    const text = [summary, "", ...lines].join("\n");

    function announce(ok) {
      if (ok) {
        setLogCopied(true);
      } else {
        setLogCopyFailed(true);
        setTimeout(() => setLogCopyFailed(false), 2500);
      }
    }

    /* execCommand("copy") fallback. Deprecated, but deliberately kept:
       it works by selecting real DOM text and asking the browser to
       copy the current selection, which generally only needs a user
       gesture — it doesn't depend on the clipboard-write permissions
       policy the modern async API requires, which is exactly the grant
       a sandboxed embed (this artifact's own iframe) may not have. */
    function fallbackCopy() {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    /* The actual bug that made this button do nothing: navigator.clipboard
       can be undefined entirely in a sandboxed iframe (which is how this
       artifact runs) if clipboard-write isn't granted by the host's
       permissions policy — not merely reject, but be missing outright.
       Accessing .writeText on undefined throws SYNCHRONOUSLY, before any
       Promise exists, so a .catch() on the end of the chain never runs;
       the throw happens before that chain is even built. This whole
       attempt needs its own try/catch to see that failure at all, which
       the previous version didn't have. */
    try {
      navigator.clipboard.writeText(text).then(
        () => announce(true),
        () => announce(fallbackCopy())
      );
    } catch (e) {
      announce(fallbackCopy());
    }
  }

  /* Distinct from handleReset on purpose: this stops the game — no
     further moves, matching the same isPlaying gate every other
     interaction guard already checks — WITHOUT wiping pieces, the
     move log, or the opponent/difficulty settings. The board stays
     exactly as it stood, and status:"ended" is what brings the
     Opponent row and Record section back (see declutter, which keys
     off isPlaying and doesn't care which non-"playing" state this is)
     so the game just played is still there to review. Only actually
     pressing Reset Game (handleReset, unchanged) clears any of that.
     Guarded the same way Stop Here / Undo Turn already are — a click
     mid-animation is simply ignored rather than freezing a half-rolled
     piece. */
  function handleEndActiveGame() {
    if (!isPlaying || busy || anim.current) return;
    // Manually ending the game winds everything down just like a win
    // does (see the two windingDownRef sites in commitRef.current).
    windingDownRef.current = true;
    // Plays the reverse of Begin Game's power-on chime, immediately —
    // same as the power-on chime does on the way in — then rides the
    // fade-out below along with everything else.
    audioRef.current.playPowerOff();
    audioRef.current.beginFadeOut(2);
    setSelectedId(null);
    setHoveredId(null);
    setHoverShadow(null);
    setStepsUsed(0);
    setTurnSnapshot(null);
    setPendingNotation([]);
    // A pending AI "thinking" timer gets cleared automatically once
    // isPlaying flips (its own effect's cleanup handles that — see the
    // orchestration effect), but the timer never gets to run its own
    // setAiThinking(false) when that happens, so it's cleared here
    // explicitly to avoid a stuck "(AI) thinking…" status.
    setAiThinking(false);
    aiDirsRef.current = null;
    setStatus("ended");
  }

  const statusText = status === "finished"
    ? `${winner === "dark" ? "Dark" : "Light"} wins \u00b7 ${winReason}`
    : status === "ended"
    ? "Game ended"
    : aiThinking
    ? `${currentPlayer === "dark" ? "Dark" : "Light"} (AI) thinking\u2026`
    : activePiece && activePiece.owner === currentPlayer
    ? `${PIECE_META[activePiece.type].name} \u00b7 ${stepsRemaining} ${
        activePiece.type === "cabeza" ? "step" : "roll"
      }${stepsRemaining === 1 ? "" : "s"} left`
    : currentPlayer === "dark"
    ? "Dark to move"
    : "Light to move";

  // One consistent property set across all three dockView values (no
  // switching between left/right or adding/removing properties) is
  // what lets every transition between them — piece <-> panel via
  // opacity/scale, piece <-> corner via left/bottom/size — actually
  // animate instead of snapping.
  const dockPieceIsCorner = dockView === "corner";
  const dockPieceStyle = {
    position: "fixed",
    // Corner offset scales with the piece's own size below (same ~1.18x
    // ratio kept at every size change) so it sits the same visual
    // distance in from the edge relative to its own footprint. Went
    // 118 -> 59 (halved) then, per feedback that read as "way too
    // small," back up to 177 (300% of that halved size — 50*3=150,
    // 150*1.18=177).
    left: dockPieceIsCorner ? "calc(100% - 142px)" : "50%",
    // Piece-view (pre-game) bottom lowered from 20 -> 8 per feedback that
    // it sat slightly too high; corner (post-game watermark) is unrelated
    // and keeps its own value. Corner size went 100x88 -> 50x44 (halved)
    // -> 150x132 (300% of the halved size) per feedback that the halved
    // size read as "way too small" — then cut 20% (150x132 * 0.8 =
    // 120x105.6) per feedback that the corner badge had grown too large
    // again. left's offset scales with it (~1.18x ratio kept at every
    // size change, see comment below) — 120 * 1.18 = 141.6, rounded.
    bottom: dockPieceIsCorner ? 18 : 8,
    width: dockPieceIsCorner ? 120 : 260,
    height: dockPieceIsCorner ? 106 : 220,
    transform: dockPieceIsCorner ? "translateX(0) scale(1)" : "translateX(-50%) scale(1)",
    opacity: dockView === "panel" ? 0 : dockPieceIsCorner ? 0.35 : 1,
    pointerEvents: dockView === "panel" ? "none" : "auto",
    zIndex: dockPieceIsCorner ? 2 : 15,
    /* Position/size cut from 900ms linear-feeling ease to a shorter,
       snappier curve with a touch of overshoot — per feedback that the
       move into the corner read as "almost zero animation." A slower
       symmetric ease and a same-duration opacity fade running at the
       same time were masking each other: the piece was shrinking AND
       fading out over the exact span it was also supposed to visibly
       slide across the screen, so the fade ate the one cue that would
       have read as motion. Keyed on the DESTINATION being "corner"
       specifically (not on dockView, which would misfire for
       corner->panel — that transition needs the position move too, not
       just an opacity fade): arriving at the corner delays opacity so
       the piece stays fully visible while it actually moves and only
       dims once it's essentially arrived; every other transition (which
       never has this masking problem, since piece<->panel never
       actually moves position) keeps a quick, undelayed fade. */
    transition: dockPieceIsCorner
      ? "left 480ms cubic-bezier(0.34,1.56,0.64,1), bottom 480ms cubic-bezier(0.34,1.56,0.64,1), width 480ms cubic-bezier(0.34,1.56,0.64,1), height 480ms cubic-bezier(0.34,1.56,0.64,1), transform 480ms cubic-bezier(0.34,1.56,0.64,1), opacity 350ms ease 380ms"
      : "opacity 320ms ease, left 480ms cubic-bezier(0.34,1.56,0.64,1), bottom 480ms cubic-bezier(0.34,1.56,0.64,1), width 480ms cubic-bezier(0.34,1.56,0.64,1), height 480ms cubic-bezier(0.34,1.56,0.64,1), transform 480ms cubic-bezier(0.34,1.56,0.64,1)",
    touchAction: "none",
    cursor: "grab",
  };

  return (
    <div
      style={{
        /* dvh, not vh: accounts for mobile browsers showing/hiding
           their own address-bar chrome dynamically, so this is always
           the actual visible height, not occasionally too tall (vh on
           iOS Safari famously counts space the address bar is
           currently covering). Exactly this height, not just a
           minimum — see alignItems below for why. */
        height: "100dvh",
        width: "100%",
        display: "flex",
        /* stretch, not center: the card now fills this exact height
           (see its own flexDirection:"column" below) and its ONE
           flex-grow child — the canvas — absorbs whatever space is
           actually left after every other section's natural size is
           accounted for. That's what makes "maximize the playing
           area" and "reflow without clipping" the same mechanism
           instead of two separate problems: nothing here ever needs
           to shrink-to-fit-content vertically, so there's nothing left
           to clip. (This also retires the old "safe center" workaround
           for exactly that clipping failure mode — once nothing is
           sized by centering a taller-than-container box, that failure
           mode no longer exists to guard against.) overflowY stays on
           as the last-resort fallback for a genuinely impossible
           combination — every section at its natural size plus the
           canvas at its own minHeight floor still exceeding a very
           short viewport — where the whole page scrolls rather than
           anything clipping silently. */
        alignItems: "stretch",
        justifyContent: "center",
        overflowY: "auto",
        padding: "12px 16px",
        background: `linear-gradient(160deg, ${COLORS.pageBg} 0%, ${COLORS.pageBgDeep} 100%)`,
        fontFamily: "'IBM Plex Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      {theme.renderGlobalDefs && theme.renderGlobalDefs()}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        /* Text selection off everywhere, not just on individual
           buttons — this is a game board, not a document, and a press-
           and-hold gesture (the dock piece's hover/hold, the masthead's
           multi-second hold-to-transition in the unified app) landing
           on ordinary text anywhere on the page must never trigger the
           browser's native word-select or, on iOS, its press-and-hold
           copy/lookup callout menu instead. No <input> or other real
           text-entry element exists anywhere in this app, so there's
           nothing this could break by being unconditional. A global
           rule here covers the whole document regardless of which
           component's <style> tag defines it — themes' own stylesheets
           and the unified app's overlay elements don't need their own
           copies, though a couple already had one for other reasons. */
        * {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        .ec-btn:focus-visible { outline: 2px solid ${COLORS.slate}; outline-offset: 2px; }
        .ec-btn { transition: background-color 0.15s ease, color 0.15s ease; }
        @media (prefers-reduced-motion: reduce) { .ec-btn { transition: none !important; } }
        /* Pure-CSS hover-invert for the New Game / End Active Game
           button — replaces a prior onMouseEnter/onMouseLeave approach
           that mutated the DOM directly, which could desync from
           React's own style bookkeeping across the Begin Game <->
           New Game/End Active Game swap (same element position, no
           key) and leave a stale, mismatched style stuck in place. */
        .ec-btn-invert:hover { background: ${COLORS.charcoal}; color: ${COLORS.cream}; }
      `}</style>
      {theme.styleSheet && <style>{theme.styleSheet}</style>}

      {/* Board — a fixed full-viewport base layer, not another section
         boxed in alongside the title/buttons. Everything else (masthead,
         dock) floats above it at its own z-index. Both the outer layer
         and mountRef (the actual canvas-holding box the renderer sizes
         itself to) always span the full viewport — no windowing/framing
         of any kind, at any time. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: `radial-gradient(circle at 50% 35%, ${canvasGradientStart} 0%, ${COLORS.creamAlt} 70%, ${canvasGradientEnd} 100%)`,
        }}
      >
        <div
          ref={mountRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        />
        {/* Generic FX-overlay slot, always mounted so a theme's own
           CSS/JS can decorate it (e.g. Neon's scanline/static
           overlay) without the chassis knowing what any given theme
           puts here. Inert by construction for a theme that never
           styles it. */}
        <div
          ref={fxOverlayRef}
          className="ec-fx-overlay"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
        >
          <div className="ec-fx-overlay-inner" style={{ position: "absolute", inset: 0 }} />
        </div>
      </div>

      {/* Masthead — floats independently of the dock below. Three
         phases (see mastheadPhase above): full-size and opaque during
         setup; faded toward "almost hidden" in place once Begin Game
         is pressed; then, 2s later, shrunk and moved to a small badge
         tucked behind the board (z-index below it) in the upper-right,
         reading as a lingering logo rather than active UI. The same
         `transition` string across all three phases is what makes
         switching between them animate instead of jumping. */}
      <div
        ref={titleWrapRef}
        className={mastheadPhase === "relocated" ? "ec-masthead-relocated" : undefined}
        style={
          mastheadPhase === "relocated"
            ? {
                position: "fixed",
                top: 14,
                right: 18,
                left: "auto",
                // Several passes of "too small"/"too big" feedback (0.3
                // -> 0.15 -> 0.45 -> a mobile-only 5x -> half that back
                // down -> a flat scale(0.4)) all read fine on a wide
                // desktop viewport and unreadably tiny on a narrow one —
                // because EVERY one of them was a transform:scale() on
                // this wrapper, which shrinks the h1's own font-size
                // clamp() *floor* right along with everything else
                // (its 20px minimum became 8px at 0.4x) — exactly the
                // narrow-viewport case the clamp's floor exists to
                // protect. No scale() here at all now; the h1 below
                // gets its OWN clamp() for this phase instead, with a
                // floor sized for legibility on its own terms rather
                // than inheriting a fraction of the (much larger)
                // pre-game floor. transformOrigin stays for the
                // fade/position transition group below, but there's no
                // actual scale in it to anchor.
                transformOrigin: "top right",
                opacity: 0.22,
                /* "Behind the board" in spirit, not literal z-order —
                   the 3D canvas paints as one flat layer, so nothing
                   can sit behind its meshes while staying in front of
                   its own background. 1 (just above the board's own
                   zIndex 0, still well under the dock's 10) is the
                   practical equivalent: a small, faded watermark the
                   board reads as sitting in front of, rather than a
                   truly occluded logo. */
                zIndex: 1,
                transition: "opacity 1.1s ease, transform 1.1s ease, top 1.1s ease, right 1.1s ease",
                textAlign: "center",
              }
            : {
                position: "fixed",
                top: "6vh",
                left: "50%",
                right: "auto",
                transform: "translateX(-50%) scale(1)",
                transformOrigin: "top center",
                opacity: mastheadPhase === "setup" ? 1 : 0.16,
                zIndex: 20,
                transition: "opacity 1.1s ease, transform 1.1s ease, top 1.1s ease, right 1.1s ease",
                textAlign: "center",
              }
        }
      >
        {/* Plain (unpositioned) inner wrapper — see titleFxRef's own
           comment above for why the glitch effects animate THIS
           element's transform, not titleWrapRef's. The Info button's
           position:absolute still resolves against titleWrapRef (the
           nearest positioned ancestor), skipping straight past this
           div, so nothing about its placement changes. */}
        <div ref={titleFxRef}>
        {/* Hidden trigger: only a tight box around the glyphs themselves
            is clickable — deliberately no cursor/hover change, so
            there's no visual hint this does anything. The h1 itself is
            block-level and carries its own padding below the text for
            layout spacing, so the click handler goes on an inline span
            instead: an inline element's hit box only ever covers its
            actual text run, not the row or the padding around it. */}
        <h1
          style={{
            margin: 0,
            fontFamily: titleFontFamily,
            fontWeight: 600,
            /* Large and responsive to actual screen real estate now
               that it's not boxed into a ~780px card — scales from a
               readable floor on narrow phones up to a genuinely large
               display size on a wide desktop/fullscreen viewport. vw
               alone can't account for how wide "EL CABEZA" actually
               renders in a given font (Neon's Chakra Petch runs wider
               per-character than Standard's Fraunces), so this pairs
               the vw scaling with a hard width ceiling on the wrapper
               below and lets the title wrap to two lines rather than
               overflow off-screen on any viewport/font combination
               narrower than expected. All three numbers cut 22% from
               their prior values (26/9/168) per feedback that the
               whole scale — especially the top end a wide/fullscreen
               viewport actually reaches — had grown too large. Cut a
               further 40% (all three numbers * 0.6) specifically
               while in full screen — a fullscreen viewport is where
               7vw actually reaches, and stays pinned near, the 131px
               ceiling, which read as oversized per feedback. Windowed
               play keeps the larger clamp — a prior pass had Standard
               opt into the smaller fullscreen-only formula even while
               windowed (theme.mastheadCompact, reasoning Standard's
               own display face, Fraunces, a serif, renders visually
               larger than Neon's Chakra Petch at the exact same clamp
               values), but per feedback that read as the pre-game
               masthead being too small — both themes now share this
               one baseline formula.

               BUT per further feedback, the pre-game masthead
               specifically (mastheadPhase === "setup") must never
               shrink for fullscreen at all — the fullscreen-only
               smaller clamp only ever applies once a game is actually
               under way (the "fading" phase, before the corner-badge
               relocation), not before Begin Game is pressed. isFullscreen
               is checked at all only in that one remaining phase — see
               below for "relocated", which has its own dedicated
               clamp regardless of fullscreen.

               The tiny corner badge (mastheadPhase === "relocated")
               gets its OWN clamp() rather than a transform:scale() of
               this one: a scale() shrinks this formula's own 20px
               floor right along with everything else, so on a narrow
               phone (where 7vw is already near that floor) the badge
               came out at ~8px — illegible, and the actual bug behind
               "still very very small" even after several scale-factor
               passes. 16px is its own floor, sized for the badge's own
               legibility rather than inherited as a fraction of the
               much-larger pre-game floor; the vw slope and ceiling
               (2.8vw, 52px) still land at roughly 40% of the pre-game
               formula's own for a viewport wide enough to reach them.

               theme.mastheadScale (see mastheadClamp) scales the
               REGULAR (non-relocated) formula's own numbers directly,
               same reasoning as the corner badge's dedicated clamp()
               just above: a transform:scale() here would shrink this
               formula's own floor right along with the rest, hitting
               the exact same narrow-viewport illegibility bug on any
               theme whose multiplier pushes it down instead of up.
               Applied per-theme (Neon at 1.25 per feedback that its
               own regular masthead read small) rather than baked into
               the shared numbers, which both themes still default to
               unscaled (Standard has no mastheadScale export, so
               `|| 1`). */
            fontSize:
              mastheadPhase === "relocated"
                ? "clamp(16px, 2.8vw, 52px)"
                : mastheadPhase === "setup"
                  ? mastheadClamp(20, 7, 131, theme.mastheadScale)
                  : isFullscreen
                    ? mastheadClamp(12, 4.2, 79, theme.mastheadScale)
                    : mastheadClamp(20, 7, 131, theme.mastheadScale),
            lineHeight: 1.05,
            letterSpacing: "0.02em",
            color: COLORS.charcoal,
            paddingBottom: 8,
            /* nowrap, not a maxWidth-driven wrap: Neon splits this text
               into one inline-block span per letter (see
               splitTitleIntoLetters in themes/neon.js, for the raster-
               tear effect), and inline-block siblings are valid
               wrap points to a browser's line-breaker even mid-word —
               a width-based wrap safety net here reliably produced
               ugly, arbitrary mid-word breaks instead of a clean
               two-line fallback. Fitting reliably is the font-size
               formula's job instead (see above). */
            whiteSpace: "nowrap",
          }}
        >
          <span ref={titleRef} className="ec-title" onClick={handleTitleClick}>EL CABEZA</span>
        </h1>
        <button
          className="ec-btn"
          onClick={handleInfoButtonClick}
          style={{
            ...ghostButtonStyle(),
            // ghostButtonStyle's own size (fontSize 10, padding 6px
            // 10px) is MINI_BUTTON_BASE's shared dock-button size —
            // appropriate for the dock, but oversized sitting directly
            // under the masthead specifically, which no longer shares
            // MINI_BUTTON_BASE's own sizing scale. Scoped down here
            // only, not on the shared base (other buttons using it
            // still want the original size).
            fontSize: 8,
            padding: "4px 7px",
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            opacity: infoBtnVisible ? 1 : 0,
            pointerEvents: infoBtnVisible ? "auto" : "none",
            transition: "opacity 0.3s ease, background-color 0.15s ease, color 0.15s ease",
          }}
        >
          Info
        </button>
        </div>
      </div>

      {/* Full Screen toggle — the ONLY way to enter or exit full screen
         now (the dock's own "Full Screen" text button is gone; see the
         ghost-button row and declutter column above). A single small,
         permanently ghosted icon fixed to the bottom-left corner, out
         of the way of everything else, for players who need a click-
         based toggle but can't or don't want to use the two-finger
         double-tap gesture (see TWO_FINGER_DOUBLE_TAP_MS above).

         Same button, same position, same style in both states —
         entering and exiting are the same action from opposite sides,
         so this is one continuous control rather than a control that
         appears only once already in full screen. The glyph is the
         standard "maximize"/"minimize" diagonal-corner-arrows pair:
         identical configuration, just pointing outward (toward the
         corners — "expand") when not yet full screen, inward (toward
         center — "restore") once already there. Same opacity/transform
         transition timing as the masthead's own fade above, so it
         settles in rather than popping. */}
      {(document.fullscreenEnabled || document.documentElement.requestFullscreen) && (
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          title={isFullscreen ? "Exit full screen" : "Enter full screen"}
          style={{
            position: "fixed",
            left: 18,
            bottom: 18,
            zIndex: 12,
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: COLORS.slate,
            opacity: 0.35,
            cursor: "pointer",
            transition: "opacity 1.1s ease, transform 1.1s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.35; }}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      )}

      {/* Dock piece — an idle, physically-interactive 3D preview of the
         player's own Cabeza (see the effects above), standing in for
         the panel below whenever dockView isn't "panel". Always
         mounted — its own Three.js scene/render loop never tears down
         across a view switch, only this wrapper's position/size/
         opacity change — so the idle spin and any in-flight drag
         momentum are never reset by opening or closing the dock. */}
      <div
        ref={dockPieceMountRef}
        onPointerDown={handleDockPiecePointerDown}
        onPointerMove={handleDockPiecePointerMove}
        onPointerUp={handleDockPiecePointerUp}
        onPointerLeave={handleDockPiecePointerUp}
        onPointerEnter={handleDockPieceHoverStart}
        style={dockPieceStyle}
      />

      {/* The dock — every non-board control, floating as one compact
         panel instead of a full-height card. Removing the canvas (now
         a fixed sibling above) and the masthead (now its own floating
         element above) from this element's children is the entire
         change: everything below still lays out exactly as it did
         inside the old card, it just now sizes to its own content
         instead of stretching to fill the viewport.
         Shorter but wider than its first version, per feedback, and
         only actually visible/interactive while dockView is "panel" —
         opening/closing crossfades against the dock piece above via
         the shared 320ms transition on opacity/scale, rather than the
         two ever being shown at literally the same instant. */}
      <div
        ref={cardRef}
        data-testid="dock-panel"
        data-open={dockView === "panel"}
        style={{
          position: "fixed",
          left: "50%",
          bottom: 20,
          transform: `translateX(-50%) scale(${dockView === "panel" ? 1 : 0.92})`,
          // Per feedback, the pre-game panel (Sound/Full Screen/
          // Opponent/Anomaly/Begin Game only — see maxHeight's own
          // pre-game comment below) reads as unnecessarily wide at the
          // full gameplay/post-game width, which exists for the wider
          // status bar and Move Log content those states actually
          // have. Shared chassis markup, so this narrows it identically
          // for every theme. Fixed at 480px pre-game regardless of
          // aiPlayer now — the Opponent picker and Difficulty no longer
          // ever share one line (picking an AI side collapses the
          // former into a compact Back control, handing Difficulty the
          // freed space — see that row's own comment), so there is no
          // longer a wider "both on one line" case to make room for.
          // Widening it there used to also visibly resize the whole
          // dock the instant an AI side was picked, which read as an
          // unexplained jump per feedback — fixed by simply not doing
          // that anymore, not by re-deriving a new width. Mid-game
          // (declutter) is its own case too, per feedback — its content
          // (the status bar, the two view buttons, End Active Game) is
          // far sparser than the post-game Move Log panel that also
          // uses this "not setup" branch, and read as unnecessarily
          // large at the full 880px.
          width: awaitingBegin
            ? "min(480px, 92vw)"
            : declutter
            ? "min(560px, 92vw)"
            : "min(880px, 96vw)",
          /* Pre-game only: shrunk by roughly the row (button + its
             marginTop/paddingTop/border) that Begin Game and Neon's
             Anomaly used to occupy on their own line below the Opponent
             row, before both moved up into it (see there). Every other
             state keeps the original cap — the post-game Move Log/New
             Game row still uses that same bottom row. */
          maxHeight: awaitingBegin ? "calc(42vh - 56px)" : "42vh",
          overflowY: "auto",
          zIndex: 10,
          opacity: dockView === "panel" ? 1 : 0,
          pointerEvents: dockView === "panel" ? "auto" : "none",
          // 500ms per feedback ("click outside...closing it, with .5
          // second fade-out") — was 320ms.
          transition: "opacity 500ms ease, transform 500ms ease",
          background: hexToRgba(COLORS.cream, 0.82),
          border: `1px solid ${COLORS.slateSoft}`,
          borderRadius: 14,
          boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          // Extra bottom padding reserves a dedicated footer strip for
          // the Sound On/Off icon (see it near this div's own closing
          // tag) — every row above sits inside the ORIGINAL 16px
          // bottom padding same as before, so the icon's corner spot
          // never overlaps whichever row currently happens to end at
          // the panel's own right edge (e.g. Full Screen during
          // declutter), regardless of which rows are showing.
          padding: theme.hasAudio ? "14px 20px 40px" : "14px 20px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >

        {/* Brief, obtrusive confirmation the instant an AI side is
           picked — per feedback, the collapsed Back+Difficulty row
           above shows the choice was REGISTERED, but not clearly WHICH
           side, unless a player thinks to press Back and check. This
           sits on top of the whole panel (position:absolute, not a
           flex child, so it doesn't participate in — or disturb — the
           column layout of everything else in here) rather than
           quietly updating in place, then fades itself out on its own
           — see aiJustSelected's own comment for the timing. Uses
           playerButtonStyle's own bodyDark/bodyLight convention so
           "which side" reads instantly from color alone, the same cue
           every other player-color chip in this UI already uses. */}
        <div
          aria-hidden={aiJustSelected == null}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10, 12, 16, 0.55)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            borderRadius: 14,
            opacity: aiJustSelected ? 1 : 0,
            pointerEvents: "none",
            transition: aiJustSelected ? "opacity 160ms ease" : "opacity 500ms ease 250ms",
          }}
        >
          {aiJustSelected && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 22px",
                borderRadius: 999,
                background: aiJustSelected === "dark" ? COLORS.bodyDark : COLORS.bodyLight,
                color: aiJustSelected === "dark" ? COLORS.bodyLight : COLORS.bodyDark,
                boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  // The actual player color (dark piece = a dark dot,
                  // light piece = a light dot), not currentColor — that
                  // tracked the pill's TEXT color instead, which is
                  // chosen for contrast against the pill's own
                  // background and so is the opposite of the color this
                  // dot is supposed to represent (came out as a black
                  // dot for "Light" and a white dot for "Dark"). The
                  // pill's own background is this same player color, so
                  // a border in the (contrasting) text color keeps the
                  // dot visible as its own distinct shape rather than
                  // blending into the pill it sits on.
                  background: aiJustSelected === "dark" ? COLORS.bodyDark : COLORS.bodyLight,
                  border: "1.5px solid currentColor",
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 13,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                AI Opponent: {aiJustSelected === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            /* Fixed height, not padding-driven. The Stop here / Undo turn
               buttons are taller than the status text, so without this
               the row would grow when they appeared mid-turn and shrink
               when the turn ended. That no longer risks shifting the
               whole page the way it used to (the card doesn't resize
               based on its own content anymore — see the flex
               architecture above), but it would still mean the canvas
               below quietly resizing on almost every turn as this row's
               height flickered, which is its own small distraction
               worth avoiding during normal play. */
            height: 36,
            padding: "0 14px",
            marginBottom: 6,
            border: `1px solid ${isPlaying ? COLORS.slateSoft : COLORS.charcoal}`,
            background: COLORS.creamAlt,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <div
            // Only a control while a game hasn't begun — mid-game this
            // is a plain readout again, and toggleStartingPlayer no-ops.
            role={awaitingBegin ? "button" : undefined}
            tabIndex={awaitingBegin ? 0 : undefined}
            data-testid="turn-status"
            title={awaitingBegin ? "Tap to switch which side moves first" : undefined}
            onClick={toggleStartingPlayer}
            onKeyDown={(e) => {
              if (!awaitingBegin) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleStartingPlayer();
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              cursor: awaitingBegin ? "pointer" : "default",
              // Keeps the tap target a comfortable size without changing
              // the row's own fixed height or the text's position.
              alignSelf: "stretch",
              userSelect: "none",
            }}
          >
            <span
              ref={turnHaloRef}
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                flexShrink: 0,
                borderRadius: "50%",
                // bodyDark/bodyLight, not the raw charcoal/cream ink
                // tokens — see the same fix on the move-log column
                // headers below for why (Neon's charcoal/cream are
                // inverted for its own dark UI).
                background: currentPlayer === "dark" ? COLORS.bodyDark : COLORS.bodyLight,
                border: `1.5px solid ${COLORS.charcoal}`,
              }}
            />
            <span
              ref={turnLabelRef}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {statusText}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexShrink: 0,
              /* Reserved width: these buttons appear and disappear mid-turn,
                 and without a fixed slot their arrival resizes the card and
                 shifts the canvas. Zero pre-game specifically — none of
                 Stop here/Undo move/Undo turn can ever render while
                 awaitingBegin (all three require a game already under
                 way or turn history to exist), so reserving 186px then
                 was pure dead space squeezing the turn-status text on
                 the left into truncating ("DARK TO MOVE" clipped to
                 "DAR…") on a narrow phone — confirmed via screenshot. */
              minWidth: awaitingBegin
                ? 0
                : isPlaying && turnLocked && currentPlayer !== aiPlayer
                ? 186
                : !turnLocked && turnHistory.length > 0
                ? 104
                : 0,
              justifyContent: "flex-end",
            }}
          >
            {isPlaying && turnLocked && currentPlayer !== aiPlayer && shadowEntries.length > 0 && (
              <button className="ec-btn" onClick={handleStopHere} style={playerButtonStyle(currentPlayer)}>
                Stop here
              </button>
            )}
            {isPlaying && turnLocked && currentPlayer !== aiPlayer && (
              <button className="ec-btn" onClick={handleUndoTurn} style={ghostButtonStyle()}>
                Undo move
              </button>
            )}
            {!turnLocked && !awaitingBegin && turnHistory.length > 0 && (
              <button
                className="ec-btn"
                onClick={handleUndoLastTurn}
                disabled={busy || aiThinking || !!anim.current}
                style={{
                  ...ghostButtonStyle(),
                  opacity: busy || aiThinking || anim.current ? 0.5 : 1,
                  cursor: busy || aiThinking || anim.current ? "default" : "pointer",
                }}
              >
                Undo turn
              </button>
            )}
          </div>
        </div>

        {/* View controls — entirely empty (and so entirely skipped) pre-
           game: the two view buttons below require !awaitingBegin, Full
           Screen no longer lives here at all (it's the floating corner
           icon now, see near the masthead above), and showTopButton is
           unconditionally false while awaitingBegin (see its own
           definition). Without this guard the row would still render as
           an empty, marginTop:8-tall gap between the status bar and the
           Opponent row below, pre-game only. */}
        {!awaitingBegin && (
        <div
          style={{
            display: "grid",
            /* Single column normally; a second auto-sized one opens up
               whenever showTopButton has a live action button to show
               here (End Active Game while playing, Reset Game once
               manually ended — see declutter/showTopButton above for
               why those aren't quite the same condition). Grid over
               absolute positioning specifically because grid cells
               can't overlap by construction — an absolutely positioned
               button vertically centered via top:50% reads its
               position off the row's OWN height, which changes if
               Current Player View / Top-Down View ever wrap onto two
               lines on a narrow screen, and centering against a moving
               target is exactly how "zero overlap" stops being
               guaranteed. A grid's second column simply reserves this
               button its own space up front instead. */
            gridTemplateColumns: showTopButton ? "1fr auto" : "1fr",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {/* Per feedback, the dock's INITIAL (pre-game) button set is
               exactly Sound/Full Screen/Opponent/Anomaly/Begin Game
               (plus the hidden Singularity) — these two camera-view
               buttons have nothing to act on yet (no piece has ever
               moved, there's no "current player's" board state worth
               a dedicated view), so they wait for Begin Game same as
               the Opponent row already does via declutter below. */}
            {!awaitingBegin && (
              <>
                <button className="ec-btn" onClick={recenterView} style={ghostButtonStyle()}>
                  Current Player View
                </button>
                <button className="ec-btn" onClick={() => topDownView()} style={ghostButtonStyle()}>
                  Top-Down View
                </button>
              </>
            )}
          </div>
          {showTopButton && (
            /* Relocated from the Record row below (hidden while
               declutter is true — see there). The grid's second
               column lands it at the row's right edge, the same
               horizontal endpoint the Record row's own
               justifyContent:"space-between" always gave it — a
               vertical relocation, not a horizontal one. Stays in this
               same spot through both "playing" and "ended" — it's the
               SAME button morphing from one action to the next, not a
               different control appearing — only actually
               disappearing once a real win hands the reset action off
               to the bottom row + victory placard instead.

               Full Screen used to relocate to sit directly under this
               button during declutter — now that entering/exiting full
               screen is always the floating corner icon (see near the
               masthead above), this button stands alone in both
               "playing" and "ended," same shape as Reset Game below. */
            declutter ? (
              <button
                className="ec-btn ec-btn-invert"
                onClick={handleEndActiveGame}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: COLORS.charcoal,
                  background: "transparent",
                  border: `1.5px solid ${COLORS.charcoal}`,
                  padding: "9px 16px",
                  cursor: "pointer",
                  justifySelf: "end",
                }}
              >
                End Active Game
              </button>
            ) : (
              <button
                className="ec-btn ec-btn-invert"
                onClick={handleReset}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: COLORS.charcoal,
                  background: "transparent",
                  border: `1.5px solid ${COLORS.charcoal}`,
                  padding: "9px 16px",
                  cursor: "pointer",
                  justifySelf: "end",
                }}
              >
                Reset Game
              </button>
            )
          )}
        </div>
        )}

        {/* Opponent settings — hidden while declutter is true, see there */}
        {!declutter && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          {/* Opponent selection is a two-state sequential flow, not a
             single crowded line: picking an AI side collapses the
             Human/AI-dark/AI-light picker into a compact Back control
             (curved arrow) and hands its freed space to Difficulty,
             rather than cramming both groups onto one row behind a
             horizontal scrollbar. Only one of the two branches below
             is ever mounted, so there's no width for either state to
             overflow — no overflowX/scroll needed. */}
          {/* gap trimmed 8 -> 5 per feedback that Easy/Medium/Hard could
             wrap onto a second line on a narrow real device (this
             sandbox's own test render, lacking network access to load
             the real IBM Plex Mono face, under-measures this row's
             true width — see the Difficulty buttons' own padding/
             letter-spacing trims below for the same reason: several
             small margin cuts here rather than chasing one exact
             pixel threshold that isn't reliably measurable locally). */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, maxWidth: "100%" }}>
          {showOpponentPicker ? (
            <>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  marginRight: 2,
                  flexShrink: 0,
                }}
              >
                Opponent
              </span>
              <button
                className="ec-btn"
                disabled={busy || aiThinking || turnLocked}
                onClick={handleHumanButtonClick}
                style={{
                  ...playerButtonStyle(humanStartSide),
                  /* Opacity reads the ACTUAL current selection now, not
                     just "always active" — reachable via Back with
                     aiPlayer still set to a chosen AI side, so this
                     needs to correctly show as NOT the current pick
                     in that case rather than always reading as active. */
                  opacity: aiPlayer === null ? 1 : 0.35,
                  flexShrink: 0,
                  cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
                }}
              >
                Human
              </button>
              {[
                { label: "AI", value: "dark", side: "dark" },
                { label: "AI", value: "light", side: "light" },
              ].map((opt) => {
                const locked = busy || aiThinking || turnLocked;
                const isActive = aiPlayer === opt.value;
                return (
                  <button
                    key={opt.value}
                    className="ec-btn"
                    disabled={locked}
                    onClick={() => {
                      selectOpponent(opt.value);
                      setShowOpponentPicker(false);
                      setAiJustSelected(opt.value);
                    }}
                    style={{
                      ...aiSideButtonStyle(opt.side),
                      // Reads the current selection — see Human's own
                      // opacity comment just above for why this can no
                      // longer be a flat, always-inactive 0.35.
                      opacity: isActive ? 1 : 0.35,
                      cursor: locked ? "default" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                className="ec-btn"
                aria-label="Back to opponent selection"
                title="Back to opponent selection"
                disabled={busy || aiThinking || turnLocked}
                // Only shows the picker again — does NOT touch aiPlayer
                // (selectOpponent(null) used to, resetting the choice
                // back to Human). Per feedback, Back is for double-
                // checking which side you picked, not for undoing it;
                // the actual selection stays exactly as it was until
                // the player deliberately clicks a different option.
                onClick={() => setShowOpponentPicker(true)}
                style={{
                  ...ghostButtonStyle(),
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4" />
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  margin: 0,
                  flexShrink: 0,
                }}
              >
                Difficulty
              </span>
              {Object.entries(AI_DIFFICULTY).map(([key, cfg]) => (
                <button
                  key={key}
                  className="ec-btn"
                  disabled={busy || aiThinking || turnLocked}
                  onClick={() => setAiDifficulty(key)}
                  style={{
                    ...toggleButtonStyle(aiDifficulty === key),
                    // Padding/letter-spacing trimmed from the shared
                    // MINI_BUTTON_BASE default (6px 10px / 0.1em) just
                    // here, not globally — this row is the one place
                    // that needs the extra room to keep Easy/Medium/
                    // Hard on one line; other buttons sharing that base
                    // style elsewhere aren't tight on space and don't
                    // need the same squeeze.
                    padding: "6px 7px",
                    letterSpacing: "0.05em",
                    opacity: busy || aiThinking || turnLocked ? 0.5 : 1,
                    cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </>
          )}
          </div>

          {/* Begin Game (and, for a theme with setup extras of its own
              — Neon's Anomaly button — that whole extras row) on its
              own line below Opponent/Difficulty, rather than crowding
              the same line — classier, and reads as "commit" only once
              the opponent configuration above it is settled. */}
          {awaitingBegin &&
            (() => {
              const beginGameButton = (
                <button
                  key="begin"
                  className="ec-btn"
                  onClick={triggerBeginGame}
                  style={{
                    ...playerButtonStyle(currentPlayer),
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    padding: "9px 16px",
                    // A theme WITH extras (Neon's Anomaly button) lays
                    // this out sharing a never-wrapping row evenly with
                    // its sibling there — see renderSetupExtras — so it
                    // needs the matching "1 1 0" flex, not a plain
                    // "1 0 auto" fill (which is for the OTHER branch:
                    // themes without extras, where this is the sole
                    // button in its own full-width wrapper below).
                    flex: theme.renderSetupExtras ? "1 1 0" : "1 0 auto",
                    minWidth: theme.renderSetupExtras ? 0 : undefined,
                  }}
                >
                  Begin Game
                </button>
              );
              const extras = theme.renderSetupExtras && theme.renderSetupExtras({ beginGameButton, ...setupExtras });
              return extras || <div style={{ display: "flex", gap: 8, flexShrink: 0, width: "100%" }}>{beginGameButton}</div>;
            })()}
        </div>
        )}

        {/* Setup/post-game action row — hidden while declutter is true
            (its own button relocates up next to Top-Down View in that
            state; see above). Per feedback, the inline running move
            log that used to live here (a Dark/Light table, visible
            during setup and mid-game) is gone entirely — it was a
            substantial contributor to the dock's own height, and every
            move it recorded is already available afterward in the
            Move Log popup below, the only place a finished game's
            history actually needs to be read. This row is now just
            whichever action button set belongs in this state (Begin
            Game/Anomaly pre-game, Move Log/New Game post-game). */}
        {/* Post-game action row only now — the pre-game Begin Game (and
            Neon's Anomaly) buttons moved up into the Opponent row above,
            so this row no longer renders at all while awaitingBegin;
            see the popup's own maxHeight below for the matching height
            reduction that frees up. The dock's own Move Log button is
            now only needed for a manual End Active Game (status
            "ended") — a real win (status "finished") opens the Victory
            placard instead, whose own Move Log button opens this same
            popup, making a second entry point here genuinely redundant
            for that case only. */}
        {!declutter && !awaitingBegin && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            gap: 16,
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.slateSoft}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {status === "ended" && (
              <button
                key="movelog"
                className="ec-btn ec-btn-invert"
                onClick={openMoveLog}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: COLORS.charcoal,
                  background: "transparent",
                  border: `1.5px solid ${COLORS.charcoal}`,
                  padding: "9px 16px",
                  cursor: "pointer",
                  flex: "1 0 auto",
                }}
              >
                Move Log
              </button>
            )}
            <button
              key="newgame"
              className="ec-btn ec-btn-invert"
              onClick={handleReset}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "9px 16px",
                cursor: "pointer",
                flex: "1 0 auto",
              }}
            >
              New Game
            </button>
          </div>
        </div>
        )}

        {/* Sound On/Off — per feedback, a small icon-only toggle tucked
           into the dock's own bottom-right corner instead of a text
           button competing for space in the centered rows above (which
           are re-centered/rebalanced automatically just by this no
           longer being one of their flex children). Absolutely
           positioned against cardRef itself (position:fixed already
           establishes a valid containing block), so it stays put
           regardless of which row layout is currently showing above
           it. The classic speaker glyph, with a diagonal slash added
           only in the muted state — recognizable in either theme
           without needing per-theme redesign. */}
        {theme.hasAudio && (
          <button
            onClick={() => {
              const next = !audioMuted;
              setAudioMuted(next);
              audioRef.current.setMuted(next);
              // Lets a host (the unified app's theme switcher, which
              // remounts this whole component on every theme change —
              // see initialMuted's own comment above) mirror this
              // outside the state that's about to be thrown away.
              if (onMutedChange) onMutedChange(next);
            }}
            aria-label={audioMuted ? "Unmute ambience" : "Mute ambience"}
            title={audioMuted ? "Unmute ambience" : "Mute ambience"}
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: COLORS.slate,
              opacity: 0.45,
              cursor: "pointer",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.85; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.45; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {audioMuted ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Move Log popup — chassis-level (see ARCHITECTURE.md), shown via
          the "Move Log" button above once a game has concluded. Copy
          Move_Log lives inside it, replacing the old inline Copy Log
          control that used to sit in the record row directly. */}
      <div
        onClick={closeMoveLog}
        style={{
          position: "fixed",
          inset: 0,
          background: modalBackdrop,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 1050,
          opacity: showMoveLog ? 1 : 0,
          pointerEvents: showMoveLog ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "clamp(280px, 90%, 460px)",
            maxHeight: "80vh",
            overflowY: "auto",
            background: modalSurface,
            backdropFilter: "blur(6px)",
            border: `1px solid ${COLORS.slateSoft}`,
            boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
            padding: "36px 26px 26px",
            boxSizing: "border-box",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              textAlign: "center",
              fontFamily: titleFontFamily,
              fontWeight: 600,
              fontSize: 19,
              letterSpacing: "0.04em",
              color: COLORS.charcoal,
            }}
          >
            MOVE LOG
          </h2>

          {/* Per feedback, 2 buttons directly under the MOVE LOG
              heading rather than one at the bottom of the sheet: left
              = Copy Move_Log, right = New Game (closes this popup and
              starts fresh in one action, rather than requiring the
              popup closed first). */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              className="ec-btn ec-btn-invert"
              onClick={handleCopyLog}
              disabled={log.length === 0}
              style={{
                flex: "1 1 0",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "10px 12px",
                cursor: log.length === 0 ? "default" : "pointer",
                opacity: log.length === 0 ? 0.4 : 1,
              }}
            >
              {logCopied ? "Move Log Copied" : logCopyFailed ? "Copy Failed" : "Copy Move Log"}
            </button>
            <button
              className="ec-btn ec-btn-invert"
              onClick={() => {
                closeMoveLog();
                handleReset();
              }}
              style={{
                flex: "1 1 0",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              New Game
            </button>
          </div>

          {log.length === 0 ? (
            <p
              style={{
                margin: "0 0 8px",
                textAlign: "center",
                color: COLORS.slate,
                fontStyle: "italic",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12.5,
              }}
            >
              No moves yet.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 1fr",
                  gap: "0 10px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  paddingBottom: 6,
                  borderBottom: `1px solid ${COLORS.slateSoft}`,
                }}
              >
                <span>#</span>
                {/* bodyDark/bodyLight — see the comment on the same
                    pair in the dock's own inline table above. */}
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.bodyDark, border: `1px solid ${COLORS.charcoal}` }}
                  />
                  Dark
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.bodyLight, border: `1px solid ${COLORS.charcoal}` }}
                  />
                  Light
                </span>
              </div>
              <div
                ref={moveLogScrollRef}
                onScroll={handleMoveLogScroll}
                style={{
                  // 5 rows initially; scrolling to the bottom expands to
                  // fit 10 more (15 total), scrolling back to the top
                  // snaps it back to 5 — see handleMoveLogScroll.
                  maxHeight: MOVE_LOG_ROW_PX * (moveLogExpanded ? MOVE_LOG_EXPANDED_ROWS : MOVE_LOG_COLLAPSED_ROWS),
                  transition: "max-height 0.3s ease",
                  overflowY: "auto",
                  marginTop: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: COLORS.charcoal,
                }}
              >
                {pairLog(log).map((row, i, arr) => {
                  const isLast = i === arr.length - 1;
                  return (
                    <div
                      key={row.n}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 1fr",
                        gap: "0 10px",
                        padding: "3px 0",
                        borderBottom: isLast ? "1px solid transparent" : `1px solid ${COLORS.slateFaint}`,
                      }}
                    >
                      <span style={{ color: COLORS.slate }}>{String(row.n).padStart(2, "0")}</span>
                      <span style={{ background: isLast && !row.light && row.dark ? COLORS.slateFaint : "transparent" }}>
                        {row.dark ? `${row.dark.notation}${row.dark.mark ? " " + row.dark.mark : ""}` : "—"}
                      </span>
                      <span style={{ background: isLast && row.light ? COLORS.slateFaint : "transparent" }}>
                        {row.light ? `${row.light.notation}${row.light.mark ? " " + row.light.mark : ""}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden-page overlay: opened only via the INFO button revealed by
          clicking the title. Backdrop click and Escape both close it;
          clicking inside the sheet itself does not (stopPropagation).
          Always mounted (never conditionally rendered) so opacity can
          actually transition on the way in AND out — the same fade
          speed/pattern already used for the INFO button reveal itself,
          rather than a hard cut. Per feedback, no dedicated close ("X")
          button — click-outside is the only dismiss path. */}
      <div
        onClick={() => setShowInfoOverlay(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: modalBackdrop,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 1000,
          opacity: showInfoOverlay ? 1 : 0,
          pointerEvents: showInfoOverlay ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "clamp(280px, 75%, 560px)",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              background: modalSurface,
              backdropFilter: "blur(6px)",
              border: `1px solid ${COLORS.slateSoft}`,
              boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
              boxSizing: "border-box",
            }}
          >
            {/* Masthead is pinned outside the scrolling body below so it
                stays put while the rest of the page scrolls — the body,
                not the header, owns overflowY and the available height. */}
            <div style={{ padding: "40px 34px 0", flexShrink: 0 }}>
              <h2
                style={{
                  margin: "0 0 10px",
                  textAlign: "center",
                  fontFamily: titleFontFamily,
                  fontWeight: 600,
                  fontSize: 20,
                  letterSpacing: "0.04em",
                  color: COLORS.charcoal,
                }}
              >
                EL CABEZA
              </h2>
              <div
                style={{
                  width: 36,
                  height: 1,
                  background: COLORS.charcoal,
                  margin: "0 auto 26px",
                }}
              />
            </div>

            <div style={{ overflowY: "auto", padding: "0 34px 32px" }}>
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 14.5,
                lineHeight: 1.7,
                color: COLORS.charcoal,
              }}
            >
              <p style={{ margin: "0 0 16px" }}>
                In a parallel universe, this game is as famous as Checkers and
                as respected and cherished as Chess or Go. However, in our
                universe, by chance or misfortune, it has been relegated to
                the dustbin of history. Regardless of the reasons one might
                suggest to explain its obscurity, it remains ultimately
                ineffable how Cabeza has languished in near-anonymity for
                almost 50 years.
              </p>

              <p
                style={{
                  margin: "0 0 16px",
                  fontStyle: "italic",
                  color: COLORS.slate,
                }}
              >
                It&rsquo;s not the game&rsquo;s fault&hellip;
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Cabeza is not an ancient game depicted on priceless artifacts
                from antiquity, nor does it trace its origins to a mysterious
                progenitor, yet it&rsquo;s entirely understandable to mistake
                it for such. The surprisingly rudimentary components coupled
                with the unremarkable square-grid playing field seem to
                foreshadow a mechanical, mundane exercise at best. But
                you&rsquo;re soon thrown off-balance at how quickly
                you&rsquo;ve become captivated by the emergent complexity
                hidden in plain sight&hellip;
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Developed sometime prior to 1977, amidst a steady stream of
                abstract strategy board games, Cabeza was never officially
                published for reasons unknown. It was, however, fully
                described in a 1987 issue of the Argentine gaming magazine{" "}
                <em>Revista Humor y Juegos</em>, with such vivid detail that
                one could believe it had actually been released. Yet, the
                article itself clarifies that El Cabeza had not yet been
                published, however over the years DIY, physical versions
                have been produced by enthusiasts.
              </p>

              <p style={{ margin: "0 0 16px" }}>
                Each player commands five pieces: a small cube, a large cube,
                a small rectangular prism, a large rectangular prism, and a
                small disc, set up at opposite ends of a 10x10 board in a
                rotationally symmetrical arrangement. Only one piece moves
                per turn. To win, advance the disc, the Cabeza, to the
                opponent&rsquo;s back row, or use one of the
                other four pieces to land on, or &lsquo;crush,&rsquo; the
                opponent&rsquo;s Cabeza.
              </p>

              <p style={{ margin: 0 }}>
                The game&rsquo;s real novelty is in how the polyhedra move.
                Every piece rolls along its edges, one or two squares at a
                time, orthogonally, and may change direction between rolls
                &mdash; except the large cube, whose bulk allows only a
                single roll, covering two squares at once. The Cabeza alone
                can also move diagonally, up to two squares. The cubes roll
                predictably; the two prisms don&rsquo;t, tumbling erratically
                as they travel &mdash; and it&rsquo;s that contrast between
                the reliable and the erratic that keeps a fresh tactical
                puzzle arriving almost every turn.
              </p>
            </div>

            <div
              style={{
                width: 36,
                height: 1,
                background: COLORS.slateSoft,
                margin: "26px auto 14px",
              }}
            />
            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                color: COLORS.slate,
              }}
            >
              This digital implementation by Ted Ortmann, August 2026
              &middot; v{APP_VERSION}
            </p>
            </div>
          </div>
        </div>

      {/* Victory placard: opens automatically the instant a game ends
          (see the status-watching effect above). Same always-mounted +
          opacity-fade pattern as the info overlay, at 0.3s to match.
          Backdrop click or Escape dismiss it WITHOUT resetting the
          game — the finished board is still there to look at, and the
          bottom New Game / Begin button still works either way — so
          this is a convenience shortcut, not the only path forward.
          Per feedback, no dedicated close ("X") button — every
          overlay in the app closes by clicking outside it only,
          for graphical minimalism. */}
      <div
        onClick={() => setShowVictoryPlacard(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: modalBackdrop,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          zIndex: 1100,
          opacity: showVictoryPlacard ? 1 : 0,
          pointerEvents: showVictoryPlacard ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(90%, 400px)",
            background: COLORS.cream,
            border: `1px solid ${COLORS.slateSoft}`,
            boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
            padding: "44px 32px 32px",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 28,
              height: 28,
              borderRadius: "50%",
              // bodyDark/bodyLight — see the comment on playerButtonStyle.
              background: winner === "dark" ? COLORS.bodyDark : COLORS.bodyLight,
              border: `2px solid ${COLORS.charcoal}`,
              marginBottom: 18,
            }}
          />

          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: titleFontFamily,
              fontWeight: 600,
              fontSize: 34,
              letterSpacing: "0.02em",
              color: COLORS.charcoal,
            }}
          >
            {winner === "dark" ? "DARK WINS" : "LIGHT WINS"}
          </h2>

          <p
            style={{
              margin: "0 0 28px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.slate,
            }}
          >
            {winReason}
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="ec-btn ec-btn-invert"
              onClick={() => {
                // Opens the Move Log popup in place of this placard —
                // Copy Move Log now lives there instead of copying
                // directly from here (see the popup's own two buttons).
                setShowVictoryPlacard(false);
                openMoveLog();
              }}
              style={{
                flex: "1 1 0",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.charcoal,
                background: "transparent",
                border: `1.5px solid ${COLORS.charcoal}`,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              Move Log
            </button>
            <button
              className="ec-btn"
              onClick={handleReset}
              style={{
                ...playerButtonStyle(winner),
                flex: "1 1 0",
                fontSize: 11,
                letterSpacing: "0.14em",
                padding: "10px 12px",
              }}
            >
              New Game
            </button>
          </div>
        </div>
      </div>

      {theme.renderExtraOverlays && theme.renderExtraOverlays(setupExtras)}
    </div>
  );
}

