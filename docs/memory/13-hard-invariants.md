## 13. Hard invariants — do not break without a deliberate, explicit decision

- Theme plugin contract: chassis calls every theme hook unconditionally;
  a theme with nothing to contribute returns `null`/no-ops. Never
  reintroduce "if Standard, skip this" branching in chassis code — that's
  the exact re-accumulation of theme knowledge the refactor eliminated.
- Theme modules stay plain ES modules with **no JSX syntax** (only
  `React.createElement` where JSX-like output is needed) — this is what
  lets the theme smoke tests `import` them directly in Node.
- The build stays **one self-contained HTML file per target** — no second
  network request for the AI worker or anything else.
- `findBestAiTurn`'s `{ pieceId, dirs }` return shape is a stable public
  contract across the worker, chassis, and tests.
- Every theme's audio interface must implement every method (no-op where
  inapplicable) at all times.
- The 50%/75% board-visibility camera clamps are explicit, feedback-
  driven product requirements, not arbitrary defaults — don't loosen them
  without new explicit instruction, and don't "fix" a camera complaint by
  quietly relaxing them. (The one exception is the user's own: the den
  and the store look around, `theme.freeCamera`, §5.)
- `npm test` must pass before any change is considered done.

