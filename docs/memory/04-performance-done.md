## 4. Performance work already done (don't undo without reason)

- **Piece mesh diffing**: the "build pieces" effect used to dispose and
  rebuild every piece's mesh+shell on every state change. `commitRef`'s
  `setPieces` preserves object identity for pieces a move didn't touch,
  so a piece-id-keyed cache now skips rebuild for anything unchanged —
  O(pieces that changed, usually 1-2) instead of O(all 10). Call sites
  that don't preserve that identity invariant (undo, history-jump, New
  Game) safely fall back to full rebuild — this is intentional, not a
  gap to "fix."
- **AI off the main thread** (§3) — Hard-tier search would otherwise
  freeze all rendering (camera easing, ambient FX, even the just-landed
  piece's tail animation) for up to 4.3s.
- **React production build** (§2).
- **Piece fillet tessellation** `seg=6` (was 8) in `makeRoundedBox` —
  analytically verified the fillet's sagitta error is still <0.07% of
  piece size at both themes' `EDGE_RADIUS`, and visually confirmed no
  faceting at extreme close-up. This was a measured decision, not a
  casual guess — don't lower further without the same rigor (analytic
  check + close-up screenshot in both themes).
- **Dock preview render loop fully paused** while its panel is open
  (`dockView === "panel"`) — that tiny scene was rendering every frame at
  opacity 0 (fully invisible) for no reason.
- **Neon per-frame FX loops** (crawling mass, digital glitch — up to ~40
  live voxels across overlapping generations) use plain indexed loops,
  not `.forEach` with destructuring, to avoid per-item-per-frame closure
  allocation.
- Camera clamp math (§5) uses a 24-step numerical bisection per frame for
  the vertical visibility check — confirmed cheap ("a couple of trig
  calls each") and deliberately chosen over a closed-form approximation
  that was tried and failed (§8).

