## 14. Current stable baseline (commit `e58e182`)

Treat all of the following as a safe, verified baseline — don't
casually "improve" it without a specific reported problem:

- Full chassis+theme+engine architecture, all 3 build targets, documented
  in `ARCHITECTURE.md` and verified end-to-end via Playwright.
- Full gameplay loop: setup (opponent/difficulty picker, Anomaly random
  setup, interactive dock piece preview), turn-by-turn play (select/
  move/roll/crush/win, gesture shortcuts for Stop Here/Undo), AI opponent
  at 3 difficulties off the main thread, Move Log (popup-based, Copy/New
  Game actions, scroll-to-expand that stays expanded until reclosed),
  Victory Placard.
- Camera system: orbit/pan/zoom/tilt with visibility clamps verified to
  hold on any aspect ratio (including the just-fixed narrow/portrait
  case), pre-game auto-fit, per-view fitting, full gesture parity
  (mouse/trackpad/touch/two-finger).
- Full audio: Standard's wood-impact percussion (final simplified
  recipe) + Neon's large ambient soundscape, both mute-able and
  mute-persistent across the unified app's theme switch.
- Full Neon ambient FX suite (masthead flicker/scanline/ghosting/glitch,
  turn halo, VHS glitch + CRT-aberration rotations, crawling swarm, 7
  arc/discharge styles, floor wave, digital-interior/voxel-shatter piece
  effects, landing particles/shockwave) — tuned down from original
  intensity across several passes for flashing/seizure-risk reasons.
- Unified app's masthead-hold CRT theme-switcher (CONNECT/DISCONNECT),
  fully wired to real ported SFX, verified mobile-viewport-safe.
- Just-verified fixes this session: Info overlay pinned masthead + full-
  height scroll body; camera horizontal pan clamp fixed for narrow/
  portrait aspect ratios (confirmed on real OnePlus 8T hardware).
- Full regression suite green: `engine.smoke.mjs`, `theme-{standard,
  neon}.smoke.mjs`, `e2e-{smoke,gameplay,ambient,singularity}.mjs`.

