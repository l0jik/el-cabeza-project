## 12. Failed / rejected approaches — do not retry as-is

1. **Resonant filter bank / modal synthesis for wood-impact audio** —
   rejected twice for reading as metallic "boing"/vibrato, root-caused to
   the technique itself (a decaying sinusoid is what a resonant filter
   IS), not to tuning. See §9.
2. **`transform: scale()` for any responsive text with a `clamp()` floor**
   — tried 4+ times for the masthead badge, always eventually illegible
   on a narrow-enough viewport. See §8.
3. **Tilt-drag pivot re-centering** (re-centering the orbit pivot to the
   board's own center at the start of every tilt/rotate drag) — reverted
   outright, not tuned: it fired on every ordinary rotate drag, discarding
   legitimate prior pan and disrupting normal scroll/zoom feel. If pivot
   drift needs revisiting, don't reach for "recenter on every drag start."
4. **`depthTest: false` for the board-edge outline ring** — draws over
   pieces at ordinary angles. See §7 for the actual fix.
5. **A single shared move-indicator implementation/color across both
   themes** (hardcoded `HEX.charcoal`) — literally invisible on Neon's
   own near-black board. Each theme now owns `buildMoveIndicator`
   entirely.
6. **Closed-form approximation for the vertical camera-visibility clamp**
   (`maxPanDistance / sin(phi)`) — failed every test in a real radius/phi
   grid check. Must stay a numerical bisection. See §5.
7. **Renormalizing the dock preview piece's scale per-session** to fill a
   fixed target size — erased the real size differences between piece
   types, which is the whole point of showing the rolled piece
   faithfully. `baseScale` must stay a fixed constant.
8. **Reusing the pre-game hitbox tightening for the post-game corner
   hover gesture** — broke small piece types intermittently. Keep these
   two gestures' hit-target logic separate (§6).
9. **Raycasting the camera's look direction to position the sphere
   menu's MATTER/LAWS/TOPOLOGY labels** (either at the plain viewport
   center, or the sphere's own projected center, one-shot or
   recomputed every frame) — see §3d for the full sequence of wrong
   turns. The camera's look direction and the sphere's own geometric
   equator are two different things that only coincide by accident;
   the fix was a plain `v=0.5` constant, no raycast involved.

