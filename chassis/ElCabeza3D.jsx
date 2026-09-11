import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

import {
  BOARD_SIZE, SLAB, SQUARE_SIZE, SLAB_THICKNESS, OFF, PIECE_SCALE,
  DISC_DIAM, DISC_H, GHOST_SCALE, GHOST_FADE_MS, ROLL_MS, SLIDE_MS,
  CAMERA_DAMPING, RESET_CAMERA_DAMPING, RESET_TRANSITION_MS,
  ORBIT_SENS_THETA, ORBIT_SENS_PHI, DRAG_DEAD_ZONE_PX, ZOOM_MIN, ZOOM_MAX,
  PIECE_META, GOAL_ROW, STEP_DIRS, INVERSE_DIR,
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

/* ------------------------------------------------------------------ */
/*  El Cabeza — 3D — shared chassis                                    */
/*                                                                     */
/*  This component is intentionally theme-agnostic: every visual/audio */
/*  decision is delegated to the `theme` prop (see ARCHITECTURE.md for */
/*  the full plugin contract). World axes: +x = columns, +z = rows      */
/*  (south), +y = up.                                                   */
/* ------------------------------------------------------------------ */

export default function ElCabeza3D({ theme }) {
  const { COLORS, HEX, EDGE_RADIUS, modalBackdrop, modalSurface, canvasGradientStart, canvasGradientEnd } = theme;

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
      background: isDark ? COLORS.charcoal : COLORS.cream,
      color: isDark ? COLORS.cream : COLORS.charcoal,
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
      background: isDark ? COLORS.charcoal : COLORS.cream,
      color: isDark ? COLORS.cream : COLORS.charcoal,
    };
  }

  const mountRef = useRef(null);
  const three = useRef({});
  const anim = useRef(null);
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
  if (!audioRef.current) audioRef.current = theme.createAudio();

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
  const turnHaloRef = useRef(null);
  const turnLabelRef = useRef(null);
  const cardRef = useRef(null);
  const fxOverlayRef = useRef(null);

  /* Mirrors the audio engine's own `windingDown` flag but at the
     component level: flips true once a win or a manual end fires, so
     ambient effects can stop re-arming themselves the same way the
     audio engine's own schedulers do. */
  const windingDownRef = useRef(false);

  const [audioMuted, setAudioMuted] = useState(false);

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
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen && document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  /* Move Log popup — a chassis-level feature (see ARCHITECTURE.md):
     generic post-game UI with no theme dependency, built once here
     rather than per theme. Replaces what used to be an inline Copy Log
     control in the record section. */
  const [showMoveLog, setShowMoveLog] = useState(false);
  function openMoveLog() {
    setShowMoveLog(true);
  }
  function closeMoveLog() {
    setShowMoveLog(false);
  }

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

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
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
    const slabGeo = new THREE.BoxGeometry(SLAB, SLAB_THICKNESS, SLAB);
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
    const halfSlab = SLAB / 2;
    const topY = SLAB_THICKNESS / 2;
    const botY = -SLAB_THICKNESS / 2;
    const VERTICAL_GAP = 0.06;
    const slabCorners = [
      [-halfSlab, -halfSlab],
      [halfSlab, -halfSlab],
      [halfSlab, halfSlab],
      [-halfSlab, halfSlab],
    ];
    const edgePts = [];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = slabCorners[i];
      const [x2, z2] = slabCorners[(i + 1) % 4];
      // top ring
      edgePts.push(x1, topY, z1, x2, topY, z2);
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

    const pieceGroup = new THREE.Group();
    const ghostGroup = new THREE.Group();

    /* Everything that should turn together — the slab, the grid, every
       piece, every footprint indicator — lives under one group. Camera
       and lights are NOT children of it: the viewer and the lamp stay
       put in world space, and this group spins beneath them, which is
       what makes each piece's shadow sweep as its facing to the fixed
       light changes, the way a lazy Susan looks under a fixed lamp. */
    const boardGroup = new THREE.Group();
    boardGroup.add(slab, slabEdges, theme.makeGrid(), pieceGroup, ghostGroup);
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
      { titleRef, titleWrapRef, turnHaloRef, turnLabelRef, cardRef, fxOverlayRef },
      { three, windingDownRef }
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
         re-checked. Two independent limits, not one shared budget —
         being at the horizontal limit doesn't reduce how far vertical
         drift is separately allowed to go, and vice versa.

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
         the board's own span and the visible span to be at least 20%
         of the board's width: boardHalfExtent*(1-2*0.20), plus the
         visible half-span itself. */
      const MIN_VISIBLE_FRACTION = 0.2;
      /* Stricter floor applied only when panning the board toward the
         BOTTOM of frame (positive target.y) — see the VERTICAL block
         below. More than double the base 20%: validated this reduces
         how far positive target.y can reach by roughly 15-20% across
         the tested radius/phi grid, tightening the direction reported
         as allowing the board to pan out of the play area at
         near-horizontal pitch. */
      const BOTTOM_MIN_VISIBLE_FRACTION = 0.45;
      /* Required visible fraction when panning the board toward the TOP
         of frame (negative target.y) — see the VERTICAL block below.
         Lower than the horizontal clamp's 20%, per explicit request:
         with the rayHitBoardPlaneY0 bug fixed (see that function's
         comment) and the camera now free to approach or pass below
         board level, this is the only thing governing how far the
         board can pan toward the top — there's no longer a separate
         camera-height floor doing part of the job. */
      const TOP_MIN_VISIBLE_FRACTION = 0.15;
      const halfFovRad = (camera.fov / 2) * (Math.PI / 180);
      const groundHalfSpan = goal.radius * Math.tan(halfFovRad);
      const maxPanDistance = (SLAB / 2) * (1 - 2 * MIN_VISIBLE_FRACTION) + groundHalfSpan;
      const panDistSq = goal.target.x * goal.target.x + goal.target.z * goal.target.z;
      if (panDistSq > maxPanDistance * maxPanDistance) {
        const panK = maxPanDistance / Math.sqrt(panDistSq);
        goal.target.x *= panK;
        goal.target.z *= panK;
      }

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
      goal.target.y = clampVerticalTarget(goal.target.y, goal.radius, goal.phi, halfFovRad, verticalMinFraction);

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
      audioRef.current.setZoom((ZOOM_MAX - view.radius) / (ZOOM_MAX - ZOOM_MIN));

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
         cheap even though it runs every frame. */
      if (ghostGroup) {
        for (let i = ghostGroup.children.length - 1; i >= 0; i--) {
          const c = ghostGroup.children[i];
          if (c.userData.kind !== "ghostLine") continue;
          const { opacityFrom, opacityTo, opacityStart, fadingOut } = c.userData;
          if (opacityStart === undefined) continue;
          const e = Math.min((now - opacityStart) / GHOST_FADE_MS, 1);
          c.material.opacity = opacityFrom + (opacityTo - opacityFrom) * e;
          if (fadingOut && e >= 1) {
            ghostGroup.remove(c);
            c.geometry && c.geometry.dispose();
            c.material && c.material.dispose();
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
  useEffect(() => {
    const t = three.current;
    if (!t.pieceGroup) return;
    if (anim.current) return; // mid-animation the moving mesh is live

    const group = t.pieceGroup;
    while (group.children.length) {
      const c = group.children.pop();
      c.geometry && c.geometry.dispose();
      c.material && c.material.dispose();
    }

    pieces.forEach((p) => {
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
      const cx = (cand.col + cand.w / 2) * SQUARE_SIZE - OFF;
      const cz = (cand.row + cand.h / 2) * SQUARE_SIZE - OFF;

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

      /* Dashed outline. A filled patch competes with the pieces' own
         cast shadows; a dashed rule reads as notation instead. */
      const hx = (cand.w * SQUARE_SIZE * GHOST_SCALE) / 2;
      const hz = (cand.h * SQUARE_SIZE * GHOST_SCALE) / 2;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            -hx, 0, -hz, hx, 0, -hz,
            hx, 0, -hz, hx, 0, hz,
            hx, 0, hz, -hx, 0, hz,
            -hx, 0, hz, -hx, 0, -hz,
          ],
          3
        )
      );

      const line = new THREE.LineSegments(
        geo,
        new THREE.LineDashedMaterial({
          color: HEX.charcoal,
          dashSize: isCrush ? 0.16 : 0.1,
          gapSize: isCrush ? 0.05 : 0.075,
          transparent: true,
          opacity: 0,
        })
      );
      line.computeLineDistances();
      line.position.set(cx, 0.025, cz);
      line.userData = { dir, kind: "ghostLine", isCrush };
      /* Starts invisible and is immediately targeted to fade up to its
         real (hot/cold) opacity — see the hover-emphasis effect just
         below, which computes that value the same way it always has.
         This is what makes a newly-hovered or newly-selected piece's
         indicators fade IN instead of appearing instantly. */
      setGhostLineTarget(line, isCrush ? 0.8 : 0.5, false);
      group.add(line);
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
    const bake = (carrier) => {
      carrier.updateMatrixWorld(true);
      parts.forEach((c) => t.pieceGroup.attach(c));
      t.boardGroup.remove(carrier);
      onDone();
    };

    if (PIECE_META[state.type].shape === "disc") {
      const [dr, dc] = STEP_DIRS[dir];
      const from = pieceCenter(state);
      const to = pieceCenter({ ...state, row: state.row + dr, col: state.col + dc });
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
        onComplete: () => bake(carrier),
      };
      return;
    }

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
      onComplete: () => bake(pivot),
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

      animateStep(piece, dir, () => commitRef.current(piece, dir, move));
    },
    [pieces, busy, animateStep]
  );
  beginMoveRef.current = beginMove;

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
      const timer = setTimeout(() => {
        const turn = findBestAiTurn(
          pieces,
          aiPlayer,
          AI_DIFFICULTY[aiDifficulty],
          aiCabezaStreakRef.current,
          log.length // turns played so far — drives the opening jitter boost
        );
        setAiThinking(false);
        if (!turn) return; // no legal turn at all — shouldn't normally happen
        aiDirsRef.current = turn;
        const piece = pieces.find((p) => p.id === turn.pieceId);
        if (piece) {
          aiCabezaStreakRef.current = piece.type === "cabeza" ? aiCabezaStreakRef.current + 1 : 0;
          beginMoveRef.current(piece, turn.dirs[0]);
        }
      }, 500);
      return () => clearTimeout(timer);
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
        el.style.cursor = "grabbing";
      } else {
        /* A second finger cancels the rotate outright rather than
           blending into it. */
        dragging = false;
        altPanning = false;
        pinchDist = active.size === 2 ? pinchSpan() : 0;
        panAnchor = active.size === 2 ? pinchMid() : null;
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
              Math.min(ZOOM_MAX, cam.current.radius * (pinchDist / d))
            );
          }
          pinchDist = d;

          const mid = pinchMid();
          if (panAnchor) {
            panBy(mid.x - panAnchor.x, mid.y - panAnchor.y);
          }
          panAnchor = mid;
        }
        return;
      }

      if (dragging) {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        lastX = ev.clientX;
        lastY = ev.clientY;

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
        cam.current.theta -= dx * ORBIT_SENS_THETA;
        /* Lower bound is a hair above zero rather than zero itself: at
           exactly vertical the view direction is parallel to the camera's
           up vector and lookAt has no defined roll, which snaps the view. */
        cam.current.phi = Math.max(
          0.012,
          Math.min(1.45, cam.current.phi - dy * ORBIT_SENS_PHI)
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
      if (wasMulti) return;

      const wasDrag = moved > DRAG_DEAD_ZONE_PX;
      dragging = false;
      /* wasAltPan is checked explicitly rather than leaning on wasDrag:
         a deliberate but very short pan can finish under the movement
         threshold, and without this it would fall through and
         select/deselect a piece on release. An Option/Alt drag is never
         a click. */
      if (wasAltPan || wasDrag || busy || !isPlaying || currentPlayer === aiPlayer || awaitingBegin) return;

      const hit = pick(ev);
      if (hit && hit.type === "ghost" && activePiece) {
        beginMove(activePiece, hit.dir);
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
      }
      if (active.size === 0) {
        dragging = false;
        altPanning = false; // an interrupted gesture must not leave the board latched in pan mode
      }
      el.style.cursor = "grab";
    }

    function onWheel(ev) {
      ev.preventDefault();
      cam.current.radius = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, cam.current.radius + ev.deltaY * 0.014)
      );
    }

    /* Right-click is now a pan trigger (see onDown), so the browser's
       native context menu must never appear on this element at all —
       unconditionally, not just while a drag is in progress. preventDefault()
       on the contextmenu event itself is the standard, sufficient way
       to suppress it; it doesn't depend on which mouse button pattern
       or platform triggered the menu. */
    function onContextMenu(ev) {
      ev.preventDefault();
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
  }, [pieces, currentPlayer, turnLocked, activePiece, busy, isPlaying, beginMove, aiPlayer, awaitingBegin]);

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
    cam.current.radius = 17;
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
       further than it has to to reach the correct side. Pitch and zoom
       are what actually distinguish this button from Current Player
       View. */
    cam.current.theta = facePlayer === "dark" ? Math.PI : 0;
    cam.current.phi = 0.012; // matches the drag clamp's near-vertical limit
    /* Zoom convention: 0% = fully zoomed out (ZOOM_MAX, farthest), 100% =
       fully zoomed in (ZOOM_MIN, closest) — the same direction "zoom" has
       in a photo viewer or a map, where a higher percentage means bigger
       and closer. 70% sits 70% of the way from MAX down to MIN. */
    const ZOOM_PCT = 0.7;
    cam.current.radius = ZOOM_MAX - ZOOM_PCT * (ZOOM_MAX - ZOOM_MIN);
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
    // Undo a previous win's audio/visual wind-down, if any, so a new
    // game gets the ambient effects back rather than staying
    // permanently silent and static for the rest of the session.
    if (windingDownRef.current) {
      windingDownRef.current = false;
      audioRef.current.resetWindDown();
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
    setGameArmed(false); // every fresh game — Human included — now waits on Begin Game
    resetTransitionUntilRef.current = performance.now() + RESET_TRANSITION_MS;
    topDownView(humanStartSide); // same camera reset as Top-Down View, but eased slower and facing the side about to actually move first
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
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

      <div
        ref={cardRef}
        style={{
          width: "100%",
          maxWidth: 780,
          background: COLORS.cream,
          border: `1px solid ${COLORS.slateSoft}`,
          boxShadow: "0 24px 60px rgba(36,24,10,0.18)",
          padding: "18px 24px 16px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          /* The card is a flex ITEM of the stretched outer wrapper
             above, so by default it already sizes to fill the
             available height — this is here defensively, matching the
             same "let a flex-in-flex chain actually shrink instead of
             being blocked by a child's natural min-size" reasoning
             behind the canvas's own minHeight further down (though
             that one sets a real floor rather than 0, since the canvas
             — unlike this card — should never shrink away entirely). */
          minHeight: 0,
        }}
      >
        {/* Hidden trigger: only a tight box around the glyphs themselves
            is clickable — deliberately no cursor/hover change, so
            there's no visual hint this does anything. The h1 itself is
            block-level (full row width) and carries its own padding
            below the text for layout spacing, so the click handler goes
            on an inline span instead: an inline element's hit box only
            ever covers its actual text run, not the row or the padding
            around it. */}
        <div ref={titleWrapRef} style={{ textAlign: "center", marginBottom: 4, flexShrink: 0, position: "relative" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              /* clamp, not a fixed 31 — 7vw only overtakes the 31px
                 ceiling below roughly 440px of viewport width, so this
                 is a no-op on every desktop and most phone widths; it
                 only softens the title on genuinely narrow screens
                 instead of letting it force a wider layout than the
                 card actually has room for. */
              fontSize: "clamp(22px, 7vw, 31px)",
              lineHeight: 1,
              letterSpacing: "0.02em",
              color: COLORS.charcoal,
              paddingBottom: 18,
            }}
          >
            <span ref={titleRef} onClick={handleTitleClick}>EL CABEZA</span>
          </h1>
        </div>

        <button
          className="ec-btn"
          onClick={handleInfoButtonClick}
          style={{
            ...ghostButtonStyle(),
            position: "absolute",
            top: 18,
            right: 24,
            opacity: infoBtnVisible ? 1 : 0,
            pointerEvents: infoBtnVisible ? "auto" : "none",
            transition: "opacity 0.3s ease, background-color 0.15s ease, color 0.15s ease",
          }}
        >
          Info
        </button>

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              ref={turnHaloRef}
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                flexShrink: 0,
                borderRadius: "50%",
                background: currentPlayer === "dark" ? COLORS.charcoal : COLORS.cream,
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
                 shifts the canvas. */
              minWidth: 186,
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

        {/* Canvas */}
        <div
          style={{
            position: "relative",
            /* The one element in this card that actually absorbs
               layout change: grows to claim whatever's left after
               every other section takes its natural height, and
               shrinks the same way when a section (the Opponent row,
               the Record section, Stop here/Undo turn) appears or
               disappears — this is what "maximize the playing area"
               and "reflow without abrupt shifting" both come down to
               in practice. minHeight is a real floor, not 0 — small
               enough to fit a constrained landscape-mobile viewport,
               never so small the board becomes unusable; if every
               section at its natural size plus this floor still
               doesn't fit, the outer wrapper's overflowY is the
               fallback (the whole page scrolls, nothing clips).
               Three.js already reads this element's live measured size
               on every resize (see the ResizeObserver in the
               scene-setup effect) and recalculates the camera's aspect
               ratio accordingly, so nothing on the rendering side
               needed to change for this to work — it was always ready
               for a size it wasn't previously being given. */
            flex: "1 1 auto",
            minHeight: 280,
          }}
        >
          <div
            ref={mountRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: `1px solid ${COLORS.slateSoft}`,
              background: `radial-gradient(circle at 50% 35%, ${canvasGradientStart} 0%, ${COLORS.creamAlt} 70%, ${canvasGradientEnd} 100%)`,
              overflow: "hidden",
            }}
          />
          {/* Generic FX-overlay slot, always mounted so a theme's own
             CSS/JS can decorate it (e.g. Neon's scanline/static
             overlay) without the chassis knowing what any given theme
             puts here. Inert by construction for a theme that never
             styles it. */}
          <div ref={fxOverlayRef} aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }} />
        </div>

        {/* View controls */}
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
            <button className="ec-btn" onClick={recenterView} style={ghostButtonStyle()}>
              Current Player View
            </button>
            <button className="ec-btn" onClick={() => topDownView()} style={ghostButtonStyle()}>
              Top-Down View
            </button>
            {theme.hasAudio && (
              <button
                className="ec-btn"
                onClick={() => {
                  const next = !audioMuted;
                  setAudioMuted(next);
                  audioRef.current.setMuted(next);
                }}
                style={ghostButtonStyle()}
                aria-label={audioMuted ? "Unmute ambience" : "Mute ambience"}
                title={audioMuted ? "Unmute ambience" : "Mute ambience"}
              >
                {audioMuted ? "Sound Off" : "Sound On"}
              </button>
            )}
            {/* While actively playing, Full Screen relocates under End
               Active Game instead (see the declutter column below) —
               shown here in every other state (pre-game, post-game). */}
            {!declutter && (document.fullscreenEnabled || document.documentElement.requestFullscreen) && (
              <button
                className="ec-btn"
                onClick={toggleFullscreen}
                style={ghostButtonStyle()}
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                title={isFullscreen ? "Exit full screen" : "Enter full screen"}
              >
                {isFullscreen ? "Exit Full Screen" : "Full Screen"}
              </button>
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

               While actively playing (declutter), Full Screen moves
               to sit directly under this button instead of the ghost
               row above — the same relocation logic, just packaged as
               a column since this is the only other live control on
               screen in that state. */
            declutter ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                {(document.fullscreenEnabled || document.documentElement.requestFullscreen) && (
                  <button
                    className="ec-btn"
                    onClick={toggleFullscreen}
                    style={ghostButtonStyle()}
                    aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                    title={isFullscreen ? "Exit full screen" : "Enter full screen"}
                  >
                    {isFullscreen ? "Exit Full Screen" : "Full Screen"}
                  </button>
                )}
              </div>
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

        {/* Opponent settings — hidden while declutter is true, see there */}
        {!declutter && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.slate,
              marginRight: 2,
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
              /* Opacity reads selection, not lock state — same reasoning
                 as the AI buttons below: this row is an always-visible
                 readout of the current opponent setting, so the active
                 option can't fade along with the ones it isn't. */
              opacity: aiPlayer === null ? 1 : 0.35,
              cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
            }}
          >
            Human
          </button>
          {[
            { label: "AI", value: "dark", side: "dark" },
            { label: "AI", value: "light", side: "light" },
          ].map((opt) => {
            const isActive = aiPlayer === opt.value;
            const locked = busy || aiThinking || turnLocked;
            return (
              <button
                key={opt.value}
                className="ec-btn"
                disabled={locked}
                onClick={() => selectOpponent(opt.value)}
                style={{
                  ...aiSideButtonStyle(opt.side),
                  /* Opacity reads selection, not lock state — this row is
                     meant to work as an always-visible readout of the
                     current game's opponent setting, including mid-turn,
                     so the active option can't be allowed to fade along
                     with the two it isn't. Only the cursor (and the
                     disabled attribute itself) communicates whether a
                     click would currently do anything. */
                  opacity: isActive ? 1 : 0.35,
                  cursor: locked ? "default" : "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}

          {aiPlayer && (
            <>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  margin: "0 2px 0 6px",
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
                    opacity: busy || aiThinking || turnLocked ? 0.5 : 1,
                    cursor: busy || aiThinking || turnLocked ? "default" : "pointer",
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </>
          )}
        </div>
        )}

        {/* Record — hidden while declutter is true (its own button
            relocates up next to Top-Down View in that state; see
            above), so the whole section, move log included, goes away
            together rather than leaving an empty shell behind. */}
        {!declutter && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.slateSoft}`,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "26px 104px 104px",
                gap: "0 10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.slate,
                paddingBottom: 5,
                borderBottom: `1px solid ${COLORS.slateFaint}`,
              }}
            >
              <span>#</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.charcoal, border: `1px solid ${COLORS.charcoal}` }}
                />
                Dark
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cream, border: `1px solid ${COLORS.charcoal}` }}
                />
                Light
              </span>
            </div>

            {/* Fixed height, not max-height. Without this the log would
                grow taller with every move played, and since the canvas
                is what actually absorbs a taller card now (see the flex
                architecture above), an ever-growing log would mean the
                canvas quietly shrinking turn after turn through an
                entire game — worth avoiding even though it's no longer
                the old "re-centers the whole card" judder. */}
            <div
              style={{
                height: 66,
                overflowY: "auto",
                marginTop: 2,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                lineHeight: 1.3,
                color: COLORS.charcoal,
              }}
            >
              {log.length === 0 ? (
                <p
                  style={{
                    margin: "6px 0 0",
                    color: COLORS.slate,
                    fontStyle: "italic",
                  }}
                >
                  Hover over or tap piece to see movement options
                </p>
              ) : (
                pairLog(log).map((row, i, arr) => {
                  const isLast = i === arr.length - 1;
                  return (
                    <div
                      key={row.n}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "26px 104px 104px",
                        gap: "0 10px",
                        padding: "1px 0",
                        borderBottom: isLast ? "1px solid transparent" : `1px solid ${COLORS.slateFaint}`,
                      }}
                    >
                      <span style={{ color: COLORS.slate }}>{String(row.n).padStart(2, "0")}</span>
                      <span style={{ background: isLast && !row.light && row.dark ? COLORS.slateFaint : "transparent" }}>
                        {row.dark ? `${row.dark.notation}${row.dark.mark ? " " + row.dark.mark : ""}` : "\u2014"}
                      </span>
                      <span style={{ background: isLast && row.light ? COLORS.slateFaint : "transparent" }}>
                        {row.light ? `${row.light.notation}${row.light.mark ? " " + row.light.mark : ""}` : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {awaitingBegin ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  key="begin"
                  className="ec-btn"
                  onClick={() => {
                    audioRef.current.beginGameFadeIn();
                    audioRef.current.playPowerOn();
                    ambientRef.current && ambientRef.current.armOnBegin();
                    setGameArmed(true);
                  }}
                  style={{
                    ...playerButtonStyle(currentPlayer),
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    padding: "9px 16px",
                    flex: "1 0 auto",
                  }}
                >
                  Begin Game
                </button>
              </div>
              {theme.renderSetupExtras && theme.renderSetupExtras()}
            </div>
          ) : (
            /* Move Log is a chassis-level feature (see ARCHITECTURE.md):
               generic post-game UI with no theme dependency, shown once
               the game has actually concluded one way or another
               (a real win, or a manual End Active Game). Replaces what
               used to be an inline Copy Log control here — Copy
               Move_Log now lives inside the popup itself, see below. */
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {(status === "ended" || status === "finished") && (
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
          )}
        </div>
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
          <button
            onClick={closeMoveLog}
            aria-label="Close"
            className="ec-btn"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${COLORS.charcoal}`,
              background: "transparent",
              color: COLORS.charcoal,
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            {"✕"}
          </button>

          <h2
            style={{
              margin: "0 0 16px",
              textAlign: "center",
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 19,
              letterSpacing: "0.04em",
              color: COLORS.charcoal,
            }}
          >
            MOVE LOG
          </h2>

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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.charcoal, border: `1px solid ${COLORS.charcoal}` }}
                  />
                  Dark
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.cream, border: `1px solid ${COLORS.charcoal}` }}
                  />
                  Light
                </span>
              </div>
              <div
                style={{
                  maxHeight: "46vh",
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

          <button
            className="ec-btn ec-btn-invert"
            onClick={handleCopyLog}
            disabled={log.length === 0}
            style={{
              width: "100%",
              marginTop: 18,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.charcoal,
              background: "transparent",
              border: `1.5px solid ${COLORS.charcoal}`,
              padding: "10px 16px",
              cursor: log.length === 0 ? "default" : "pointer",
              opacity: log.length === 0 ? 0.4 : 1,
            }}
          >
            {logCopied ? "Move_Log Copied" : logCopyFailed ? "Copy Failed" : "Copy Move_Log"}
          </button>
        </div>
      </div>

      {/* Hidden-page overlay: opened only via the INFO button revealed by
          clicking the title. Backdrop click and Escape both close it;
          clicking inside the sheet itself does not (stopPropagation).
          Always mounted (never conditionally rendered) so opacity can
          actually transition on the way in AND out — the same fade
          speed/pattern already used for the INFO button reveal itself,
          rather than a hard cut. */}
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
              aspectRatio: "8.5 / 11",
              maxHeight: "88vh",
              overflowY: "auto",
              background: modalSurface,
              backdropFilter: "blur(6px)",
              border: `1px solid ${COLORS.slateSoft}`,
              boxShadow: "0 30px 70px rgba(36,24,10,0.35)",
              padding: "40px 34px 32px",
              boxSizing: "border-box",
            }}
          >
            <button
              onClick={() => setShowInfoOverlay(false)}
              aria-label="Close"
              className="ec-btn"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1.5px solid ${COLORS.charcoal}`,
                background: "transparent",
                color: COLORS.charcoal,
                fontSize: 13,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h2
              style={{
                margin: "0 0 10px",
                textAlign: "center",
                fontFamily: "'Fraunces', serif",
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

      {/* Victory placard: opens automatically the instant a game ends
          (see the status-watching effect above). Same always-mounted +
          opacity-fade pattern as the info overlay, at 0.3s to match.
          Backdrop click, the X, or Escape all dismiss it WITHOUT
          resetting the game — the finished board is still there to
          look at, and the bottom New Game / Begin button still works
          either way — so this is a convenience shortcut, not the only
          path forward. */}
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
          <button
            onClick={() => setShowVictoryPlacard(false)}
            aria-label="Close"
            className="ec-btn"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${COLORS.charcoal}`,
              background: "transparent",
              color: COLORS.charcoal,
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ✕
          </button>

          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: winner === "dark" ? COLORS.charcoal : COLORS.cream,
              border: `2px solid ${COLORS.charcoal}`,
              marginBottom: 18,
            }}
          />

          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: "'Fraunces', serif",
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

          <button
            className="ec-btn"
            onClick={handleReset}
            style={{
              ...playerButtonStyle(winner),
              fontSize: 11,
              letterSpacing: "0.14em",
              padding: "10px 24px",
            }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

