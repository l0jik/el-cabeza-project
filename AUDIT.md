# El Cabeza — codebase audit (2026-10-02)

Scope: the whole repository at `claude/artifact-code-update-u6amyw`
(235 tracked files; ~60k lines of JS/JSX in `engine/`, `chassis/`,
`themes/`, `apps/`; 57 test scripts; 15 asset tools). Everything below was
checked against the code, not inferred from file names. Findings that
were acted on are marked **[fixed]**; see "Changes made" at the end.

## Executive summary

The codebase is healthy for a single-developer game that has grown fast.
The layering the project set out to build (`engine` → `chassis` →
`themes` → `apps`) holds: the engine is pure and imports nothing above
it, the AI runs in a Web Worker, every listener, timer, animation loop
and audio context checked has a matching cleanup, all saved state is read
defensively, and URL inputs are allow-listed. The build is reproducible,
warning-free, and the fast engine suite passes.

The real risks are concentrated, not spread out:

1. **One god component.** `chassis/ElCabeza3D.jsx` is 9,703 lines: 65
   `useState`, 56 `useEffect`, 65 `useRef`, 43 distinct `theme.*` hooks.
   Almost every feature touches it. It works and is heavily commented,
   but it is the single place most likely to absorb future bugs.
2. **The test suite under-reports.** 11 scripts in `tests/` are not in
   `npm test`; at least one of them (`e2e-clerk.mjs`) fails today and
   nobody would know. The e2e suite is one long `&&` chain, so the first
   failure hides everything after it, and CI runs no tests at all before
   deploying.
3. **Implicit contracts.** The theme interface (43 hooks), the story
   save record, and the test hooks on `window` are conventions that live
   in comments and memory, not in one place.

No critical (data-loss, security, crash) issues were found.

## Architecture

**Strengths (GOOD — keep):**
- `engine/` (rules, geometry, shapes, AI) is pure, deterministic and
  smoke-tested in plain Node; it imports nothing from `chassis/`,
  `themes/` or `apps/`.
- The AI search runs in a Web Worker bundled into each page
  (`engine/ai-worker.js`, `build/build.js`), keeping the render loop free.
- The theme-plugin pattern (`theme.mountAmbientEffects`,
  `useSetupExtras`, `renderExtraOverlays`, `dockWords`, …) lets seven
  very different worlds share one game without forking it.
- Theme subsystems are factored into small focused modules (den-trip,
  den-hall, den-ending, den-cards, neon-unease, pivot-guide …) that each
  own their DOM, sound and teardown.
- `tools/` makes every processed asset reproducible from its source,
  with the processing documented in each script's header.

**Weaknesses:**
- **God component** (above). Severity HIGH for maintainability; it is
  not currently causing failures. Splitting it is an architectural
  change and was *not* attempted (see "Problems found but not changed").
- **Layer leak:** the chassis imports a theme-level module directly
  (`chassis/ElCabeza3D.jsx:29` → `themes/reality-gate.js`, which pulls
  in `realities.js`, `rules-selections.js`, `piece-showcase.js`,
  `pivot-guide.js`). Every page, including the Lab, carries the gate.
  MEDIUM. It's a deliberate product choice (the gate appears on every
  page after the story), but the dependency belongs on `theme` or `apps`.
- **Shared modules named after one theme:** the den imports
  `tienda-quality.js`, `tienda-textures.js` and `wood-set.js`. They are
  genuinely shared now. LOW; rename when next touched.
- **Persistence inside the engine:** `engine/journey.js` reads and writes
  `localStorage`. The rest of `engine/` is pure. LOW.

## Critical findings

None.

## High findings

| # | Location | Problem | Why it matters | Recommendation | Size |
|---|---|---|---|---|---|
| H1 | `package.json` `test:e2e` | 11 scripts not in the suite; one (`e2e-clerk.mjs`) failed (a stale seed: it predates the special-order lock, so the dock never opened). The suite was a single `&&` chain: the first failure hid the rest. | Regressions in the store clerk, the gate, the ending, the summons, coming home, the TV lure, drag latching and the journey lock went unnoticed. | A runner (`tests/run-e2e.mjs`) with one list, running every test, printing a pass/fail table; the 8 orphaned tests registered (after the clerk test's seed was brought up to date). **[fixed]** | S |
| H1b | `tests/e2e-gameplay.mjs` | It printed its findings but always exited 0, so the suite could never see it fail, though it's in the suite twice. | A broken select/move/dock/Move Log path passed silently. | Seven explicit checks and a real exit code. **[fixed]** | XS |
| H2 | `.github/workflows/deploy-pages.yml` | Deploys on every push without running any test. | A broken engine rule ships straight to the live site. | Run the 4-second engine suite before building. **[fixed]** | XS |
| H3 | `chassis/ElCabeza3D.jsx` | God component (9.7k lines, 65 states, 56 effects). | Every feature touches it; effects interact through shared refs; hardest file to change safely. | Extract self-contained effects into hooks (wake lock, fullscreen, view glide, keyboard) one at a time, each behind the existing e2e tests. | L (incremental) |

## Medium findings

| # | Location | Problem | Recommendation | Size |
|---|---|---|---|---|
| M1 | `apps/unified.jsx` (hold-zone sync) | An endless rAF loop does a `querySelector`, a `getBoundingClientRect` and **four style writes every frame** for the life of Nova, invalidating layout each frame even when the title hasn't moved. | Write only when the rect changed. **[fixed]** | XS |
| M2 | `apps/novaStory.jsx` `saveStoreGone`, `saveOwned` | Two writers replace the whole story record while every other writer merges (`patchStory`). Harmless in today's story order, but one reorder away from wiping `hallDue`/`hallFlares`/`ended`. | `saveStoreGone` merges. **[fixed]** `saveOwned(true)` stays a deliberate fresh start (a purchase always follows a cleared record). | XS |
| M3 | Build: 5 of 7 pages unminified | Nova ships 3.9 MB of JS (1.27 MB gzip); minified it is 2.5 MB (1.11 MB gzip). Parse cost on phones scales with raw size. Tienda and Lab are already minified with no issues. | Minify all targets, then run the full e2e suite. **[fixed]** Every page and the worker now minified: Nova 2.5 MB, Standard 1.5 MB, Neon 1.4 MB, Tienda 1.6 MB, Lab 1.1 MB, Lluvia 1.1 MB, Cromo 1.0 MB, worker 24 KB (was 56 KB). | S |
| M4 | Theme interface | 43 `theme.*` hooks read by the chassis are documented only partly (ARCHITECTURE.md lists the early ones). | A table of every hook (name, when called, return shape) in ARCHITECTURE.md. | S |
| M5 | `ARCHITECTURE.md` header | Says phase 3 "is a design sketch, not yet implemented … none of this is wired up", contradicting its own "as built" section and the code. | Correct the header. **[fixed]** | XS |
| M6 | `README.md` | Empty. A newcomer can't find how to build, test, or where anything is. | Short README: layout, commands, test runner, docs. **[fixed]** | XS |

## Low findings

- **Dead exports:** `hasShowcase` (`themes/piece-showcase.js`),
  `specById` (`themes/lab/specs.js`) and `labSession` (`themes/lab/hud.js`)
  are defined and never used anywhere. **[fixed: removed]** Many
  other exports are only used inside their own file; that's harmless.
- **Test hooks outside the guard:** a few `window.__DEN_*__` and
  `window.__EC_TEST_MASTER_GAIN__` are set without checking
  `__EC_TEST_HOOKS__`. Read-only debug values; no security impact.
- **Duplicated one-liners:** `clamp01`/`span`/`sm` easing helpers in 5-6
  theme files, and an identical `poll()` in 15 test files. Small
  enough that consolidating them buys little; `poll` could join
  `tests/dock-helpers.mjs` when tests are next touched.
- **Legacy reference sources at the root:** `el_cabeza_3d.jsx` (4.8k
  lines) and `el-cabeza-neon-3d.html` (7.7k) are the recovered originals
  the chassis was extracted from. They aren't built, but code comments
  cite them by path. Keep them; consider moving them to `reference/`
  together with those comments.
- **`esbuild` advisory (GHSA-67mh-4wv8-2f99, moderate):** it affects
  esbuild's dev server, which this project never runs (build only). Not
  exploitable here; upgrade at leisure.
- **`three` r128 (2021):** pinned deliberately; the code uses r128-era
  APIs. Upgrading is a project in itself, with no current need.
- **Repository weight:** `.git` is 137 MB from audio/image history.
  Only rewriting history would shrink it; not worth the disruption.

## Performance

- **Main render loop (GOOD):** the chassis `tick()` allocates nothing per
  frame (one `clone()` at the start of a camera glide); camera damping
  is frame-rate independent; `dt` is clamped against long stalls.
- **Theme ticks (GOOD):** neon, cromo, lluvia and tienda ticks do no DOM
  reads or allocations. The den's `querySelector` in its tick runs only
  after every cheaper condition has failed.
- **Covered rendering (GOOD):** the revelation scene stops the den from
  drawing underneath it, and adapts its resolution to frame time.
- **M1** and **M3** (both fixed) above are the measurable items.
- No polling loops, no leaked intervals (every `setInterval` has a
  matching clear), no per-frame `localStorage`/JSON work.

## Reliability and bug risks

- **Cleanup discipline (GOOD):** every `window`/`document` listener in
  the chassis and themes is removed in its effect's cleanup or the
  module's dispose. The remaining unpaired listeners are on elements
  discarded with their owner.
- **Audio lifecycle (GOOD):** each world closes its `AudioContext` on
  dispose; the Lab shares one per page by design.
- **Saved state (GOOD):** all 25 `el-cabeza:*` keys are read inside
  `try/catch`, so corrupt or blocked storage falls back to defaults. **M2**
  is the one fragile writer.
- **Timing-based tests:** several e2e checks use fixed waits (e.g.
  `e2e-nova-mobile.mjs` "the bar layout is remembered" waits a fixed
  2.5 s after reload). They fail under machine load, which looks like a
  regression and isn't. Prefer `poll` over fixed waits when touched.
- **Stale tests (fixed):** `e2e-clerk.mjs` and the Nova half of
  `e2e-original.mjs` predated the special-order lock (seeded now);
  `e2e-sound-channels`/`e2e-wood-sounds` looked for "begin" where the
  store says Try a Game; `e2e-nova-mobile` and `e2e-wood-sounds` used fixed
  waits that missed under load (they poll now).

## Maintainability

- The god component (H3) and the undocumented hook surface (M4) are the
  two things that will slow the next developer most.
- `PROJECT_MEMORY.md` (5.1k lines) is a valuable change log, but it's
  the only place many decisions live. A short, current summary in
  ARCHITECTURE.md would keep newcomers from needing all of it.
- The behaviour-in-comments style ("user: …") is consistent and
  explains *why* code is the way it is; keep it.

## Technical debt

| Debt | Why it exists | Hurting now? | Risk | When | Size |
|---|---|---|---|---|---|
| God component | Features added where the state was | Slows changes; no failures | Rising | Incrementally, with features | L |
| Implicit theme interface | Grew hook by hook | Mildly | Medium | Next ARCHITECTURE pass | S |
| Orphaned/chain-run tests | Tests added without registering | Yes (hidden failure) | Medium | Now **[fixed runner]** | S |
| Unminified pages | Readability in early debugging | Load/parse time on phones | Low-medium | Done **[fixed]** | S |
| Theme-named shared modules | Den reused the store's code | No | Low | When touched | S |
| three r128 | Pinned at start | No | Low (no security exposure) | Only with a reason | L |

## Testing

- **Run:** `npm run test:engine` — 8 suites, all pass (4.2 s).
  `npm run build` — all 7 pages + redirect, no warnings.
- **e2e (Playwright, ~45 scripts):** broad and behavioural (they drive
  the real pages). Recent full-suite runs pass; individual runs this
  session are listed in "Verification".
- **Gaps:** the 11 unregistered scripts (H1, now 8 registered and the
  rest explained); a test that couldn't fail (H1b); no test for the
  story's save record (`apps/novaStory.jsx`; now
  `tests/story-save.smoke.mjs` **[added]**, which fails on the old
  overwrite and passes on the fix); nothing checks the theme hook
  contract.
- `tests/ai-sim.mjs` and `tests/e2e-screenshot.mjs` are tools, not
  tests, and are correctly excluded.

## Recommended refactoring plan

1. **Highest-risk fixes:** the test runner and registration (H1), CI
   tests before deploy (H2), the story-record writer (M2). *Done.*
2. **High-value refactors:** extract self-contained effects from the
   chassis into hooks, one per PR, each verified by the existing e2e
   tests (H3). Document the theme hook contract (M4).
3. **Performance:** the hold-zone loop (M1) and minifying every page
   (M3). *Done.*
4. **Structural cleanup:** move the chassis's gate import behind a theme
   or app hook; rename shared `tienda-*` utilities; move the legacy
   sources to `reference/`.
5. **Polish:** guard the remaining test hooks; fold `poll` into the
   shared test helpers; prefer polling over fixed waits in tests.

## Changes made

| Area | Change |
|---|---|
| Tests | `tests/run-e2e.mjs` (one list, every test run, pass/fail table, filters); 8 orphaned tests registered; `e2e-gameplay` given real checks and an exit code; `tests/story-save.smoke.mjs` added to `test:engine`; stale seeds, labels and fixed waits fixed (clerk, original, sound-channels, wood-sounds, nova-mobile) |
| CI | `deploy-pages.yml` runs `npm run test:engine` before building |
| Story save | `saveStoreGone` merges into the record instead of replacing it |
| Performance | Nova's hold-zone loop writes styles only when the title moves; every page and the AI worker minified (M3) |
| Dead code | `hasShowcase`, `specById`, `labSession` removed |
| Docs | README written; ARCHITECTURE.md header corrected |
| Bug: camera after the den's TV | After coming back from Singularity, the setup fit could pull the camera off the board ~0.3 s after the den placed it (a remount left the fit with nothing to compare against). Den-placed cameras are now marked, and the fit leaves them be. Was the intermittent `e2e-story` "re-centred" failure. |
| Bug: Lab switch mid-step | A switch re-checks for a step under way after its settle pause (a step asked for in the same instant hadn't rendered yet) |

## Verification

- `npm run test:engine`: all 9 suites pass. `npm run build`: all pages, no
  warnings.
- `e2e-story`: reproduced the recentre failure with logging (radius 21.87
  vs 19.84, target.y -1.02); with the fix, three runs pass with the camera
  on the board's own framing every time.
- Targeted browser runs after each change (smoke ×5, outside-dismiss,
  rules, nova-mobile, sound-channels, nova-sound, wood-sounds, den,
  den-return, ending, gate, journey, story, lab, gameplay, clerk,
  original): all pass; the last run of each passed, `e2e-lab` with the
  caveat below.
- Browser tests must not run side by side on this machine: two at once
  made `e2e-lab` and `e2e-outside-dismiss` miss their timings.

## Problems found but not changed

- **`e2e-lab` "a switch during a step waits"** failed intermittently (3
  of 7 runs: under load, or straight after a build; the last 4 in a row
  passed).
  The switch's re-check above is a real improvement but did not remove it
  entirely; the check now prints the carried state when it fails, so the
  next failure says what was carried. Not yet root-caused.
- The god component (H3), the undocumented theme hook surface (M4), the
  chassis's gate import: deliberate larger refactors, see the plan above.

