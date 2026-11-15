## 1. What this is, in one paragraph

A 3D board game (React + Three.js r128) with a shared "chassis + theme
plugin" architecture: `engine/` (pure rules/AI/geometry, no rendering),
`themes/standard.js` and `themes/futuris.js` (palette, materials, audio,
ambient FX — two genuinely different visual identities), `chassis/
ElCabeza3D.jsx` (~5900 lines — the actual React component: state, camera/
input, JSX skeleton, generic actions; theme-agnostic). Three entry points
(`apps/standard.jsx`, `apps/futuris.jsx`, `apps/unified.jsx` + its
`unifiedTransition.jsx` theme-switcher) are bundled by `build/build.js`
(esbuild) into HTML pages in `dist/` (gitignored, built fresh every
time), their scripts ES modules beside them, the code all the pages share
in shared chunks (since 2026-10-16; until then each page was one
self-contained file). No backend. Everything is client-side state,
reset on reload, EXCEPT opponent settings (Human/AI side, AI difficulty,
Human-vs-Human starting side), which persist in `localStorage` under
`el-cabeza:opponent` (chassis `loadOpponentPrefs`/`saveOpponentPrefs`,
guarded so blocked storage just falls back to defaults) and also carry
over across every New Game / reset path.

Shipped as Claude Artifacts (the unified build is the one with a live
shared link; that link's "Latest vs. pinned version" mode is a claude.ai
Share-dialog setting, not something any Artifact tool action controls).
Current work branch: `claude/artifact-code-update-u6amyw` on
`l0jik/el-cabeza-project` — confirm this hasn't changed before assuming
it in a fresh session, since it's assigned per-task by the harness, not
fixed by the project itself.

`APP_VERSION` in `chassis/ElCabeza3D.jsx` (shown on the About card as
v...): `"2.0.0"` since 2026-11-15 (user: "the version should be updated.
What's an appropriate version # we can update this to?"). It had stayed
`"1.39.0"` from the original recovered source through about a thousand
commits (Nova's story and title screen, the worlds, three languages,
cloud saves), so the first bump is a major one. From here, Semantic
Versioning as the code's comment says: MINOR for something new, PATCH
for fixes. A save file's `version` says only what wrote it
(chassis/saves.js FORMAT decides what loads).

