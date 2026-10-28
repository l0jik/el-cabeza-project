## 13. Hard invariants — do not break without a deliberate, explicit decision

- Theme plugin contract: chassis calls every theme hook unconditionally;
  a theme with nothing to contribute returns `null`/no-ops. Never
  reintroduce "if Standard, skip this" branching in chassis code — that's
  the exact re-accumulation of theme knowledge the refactor eliminated.
- Theme modules stay plain ES modules with **no JSX syntax** (only
  `React.createElement` where JSX-like output is needed) — this is what
  lets the theme smoke tests `import` them directly in Node.
- The AI worker stays **inline in every page** (inert script text turned
  into a Worker through a Blob URL) — never a worker file of its own.
  (This was "one self-contained HTML file per target, no second network
  request" until 2026-10-16. Nova's page was split first, for the City in
  place; then, for the user's "shrink the iOS download size", every
  page's script became ES modules beside it, the code the pages share
  (three, React, the chassis, the engine) in shared chunks: 19 MB of
  script to 4 MB. A deliberate change, told to the user with the size it
  saved; pages already fetched their sounds and pictures beside them.)
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

- The result is said to you (user, after a Cromo win as Chrome: "Since I
  won and I was Chrome, it should say you win, not Chrome wins. And I
  probably need to propagate this throughout the rest of the game
  globally."). Against the computer or online, the chassis's `youResult`
  ("win" / "lose", from `youSide`, never in a replay) drives every place
  the end of a game is put into words: the placard ("YOU WIN" / "YOU
  LOSE"; under it "Against the {level} AI" or "To the {level} AI"), the
  status line ("You win · {why}", which Rings' header and the phone bar
  read), the Lab's read-out (`game.youResult`) and the copied move log
  ("Result: you win, as {side}", the moves below going by sides). Two
  people at one screen, a replay and a pasted log's summary keep the
  winner's name. A new place that says who won takes `youResult` too.
  Test: e2e-you-win.
