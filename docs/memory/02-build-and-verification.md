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
- `npm run build` → `build/build.js`: one esbuild pass for every page's
  entry (ES modules, splitting on: each page's own `el-cabeza-<name>-app.js`
  and the chunks the pages share, `el-cabeza-chunk-*.js`, preloaded by
  each page's `<link rel="modulepreload">`; since 2026-10-16, user: "shrink
  the iOS download size") plus one pass for `engine/ai-worker.js`, embedded as
  **inert script text** (`type="application/x-ai-worker"`, not a JS
  mimetype) inside each HTML file and turned into a real `Worker` via a
  Blob URL at runtime. This is deliberate: the worker needs no file of
  its own (nothing for a file:// page to be refused, no second request
  before the computer can think) while still running the AI search off
  the main thread. Don't ship the worker as a separate file. (Until
  2026-10-16 every page but Nova's was one self-contained HTML file; see
  13-hard-invariants.md for why that changed.)
- `define: { "process.env.NODE_ENV": '"production"' }` on every esbuild
  call — **do not remove**. Without it, react/react-dom silently ship
  their development build (real per-render `Object.freeze`, prop-type
  validation, warning machinery), costing ~34-37% extra bundle size and
  real per-render CPU, not just a dev-only warning.
- `npm test` = `npm run test:engine` (Node-only smoke tests, no browser:
  `engine.smoke.mjs`, `theme-{standard,futuris}.smoke.mjs` — import theme
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

