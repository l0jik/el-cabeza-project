## 1. What this is, in one paragraph

A 3D board game (React + Three.js r128) with a shared "chassis + theme
plugin" architecture: `engine/` (pure rules/AI/geometry, no rendering),
`themes/standard.js` and `themes/neon.js` (palette, materials, audio,
ambient FX — two genuinely different visual identities), `chassis/
ElCabeza3D.jsx` (~5900 lines — the actual React component: state, camera/
input, JSX skeleton, generic actions; theme-agnostic). Three entry points
(`apps/standard.jsx`, `apps/neon.jsx`, `apps/unified.jsx` + its
`unifiedTransition.jsx` theme-switcher) are bundled by `build/build.js`
(esbuild) into three self-contained HTML files in `dist/` (gitignored,
built fresh every time). No backend. Everything is client-side state,
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

`APP_VERSION` in `chassis/ElCabeza3D.jsx` has stayed `"1.39.0"` since the
original recovered source, through all ~100 commits since — it does not
track changes and should not be read as a changelog signal.

