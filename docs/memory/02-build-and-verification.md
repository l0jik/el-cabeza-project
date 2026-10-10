## 2. Build & verification model

- **Testing policy (user, standing): small tweaks skip the full test
  suites** unless the user says otherwise. Colours, sizes, wording, CSS,
  a cushion or a texture: build, look at a screenshot, commit, push. The
  full e2e suites (e2e-tienda ~10-12 min, e2e-den ~8 min on the software
  renderer) are for real behaviour changes, or when asked. Never rebuild
  `dist/` while a test run is using it.
- **Pace (user, standing, 2026-10-08): push first, sweep after.** After
  a round's changes: build, run only the tests directly about the
  change, commit and push (that's the deploy), and report to the user
  then: what was done and is live, and, said plainly, that a wider
  sweep (the other browser tests the change could touch) is starting
  now, roughly how long it will take, and that it may turn up something
  unexpected, which would come as a follow-up fix and push. Then run the
  sweep in the background, one test at a time, and when it ends follow
  up: all passed, or what failed, what was fixed, pushed. (User asked
  "Why is this taking so long?" after a round of 2 h 20 min, most of it
  a 72-minute sweep of 31 browser tests before anything was pushed.
  Single tests here take 1-11 min each on the software renderer.) While
  a sweep is running, a new request's build waits for it or stops it
  (kill by PID): never rebuild `dist/` under it.
- `npm run build` → `build/build.js`: three esbuild passes (one per app
  entry) plus one shared pass for `engine/ai-worker.js`, embedded as
  **inert script text** (`type="application/x-ai-worker"`, not a JS
  mimetype) inside each HTML file and turned into a real `Worker` via a
  Blob URL at runtime. This is deliberate: it keeps the "one
  self-contained HTML file per target, no second network request" model
  while still running the AI search off the main thread. Don't ship the
  worker as a separate file — that breaks the single-file deployment
  model this whole build exists to preserve.
- `define: { "process.env.NODE_ENV": '"production"' }` on every esbuild
  call — **do not remove**. Without it, react/react-dom silently ship
  their development build (real per-render `Object.freeze`, prop-type
  validation, warning machinery), costing ~34-37% extra bundle size and
  real per-render CPU, not just a dev-only warning.
- `npm test` = `npm run test:engine` (Node-only smoke tests, no browser:
  `engine.smoke.mjs`, `theme-{standard,neon}.smoke.mjs` — import theme
  modules directly, which is why they must stay plain ES modules with no
  JSX syntax) + `npm run test:e2e` (builds fresh, then drives the real
  built HTML in headless Chromium via Playwright: `e2e-smoke`,
  `e2e-gameplay`, `e2e-ambient`, `e2e-singularity`, each ×2 themes where
  applicable). e2e rebuilds from source every run, so it also catches
  build-time regressions. Piped through `tee`, this reports `tee`'s exit
  code, not npm's — use `set -o pipefail` or check `$PIPESTATUS`, a real
  gap that once let a failure read as success.
- Playwright launches via a pinned local Chromium path
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` as of this
  session) — don't `playwright install`.

