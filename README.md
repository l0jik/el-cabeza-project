# El Cabeza

A two-player abstract board game of rolling and tipping blocks, played in
the browser in several worlds (themes): Standard (a 1975 den), Neon,
Cromo, Lluvia, Tienda (a 1970s department store), the Theme Lab, and
**Nova**, which strings the den, the store and Neon together into a story.

Live: <https://l0jik.github.io/el-cabeza-project/> (one page per world;
`el-cabeza-nova.html?scene=revelation` and `?scene=glutts` jump to two of
the story's scenes).

## Layout

| Directory | What's in it |
|---|---|
| `engine/` | Rules, board geometry, piece shapes, the AI (run in a Web Worker). Pure, no DOM. |
| `chassis/` | The shared React component (`ElCabeza3D.jsx`): game state, camera, input, the Three.js scene, the dock; plus the phone layout and the rules cards. |
| `themes/` | One module per world (look, sound, ambient effects, menus) and the subsystems they share. |
| `apps/` | One entry per page: a chassis plus a theme (`unified.jsx` is Nova). |
| `assets/` | Recordings, photographs and textures, with sources in `*/src/`. |
| `tools/` | The scripts that make the processed assets from their sources. |
| `tests/` | Node smoke tests (`*.smoke.mjs`) and Playwright end-to-end tests (`e2e-*.mjs`). |
| `build/` | `build.js`: each page bundled (esbuild) into one self-contained HTML file in `dist/`. |

## Commands

```sh
npm ci
npm run build          # dist/el-cabeza-*.html (+ the files beside them)
npm run test:engine    # fast Node checks (seconds)
npm run test:e2e       # build, then every browser test (tests/run-e2e.mjs; long)
node tests/run-e2e.mjs e2e-story e2e-den   # just some of them
```

Pushing to `main` or the working branch deploys `dist/` to GitHub Pages
(`.github/workflows/deploy-pages.yml`), after the engine tests pass.

## Docs

- `ARCHITECTURE.md`: the layers and the theme plugin interface.
- `PROJECT_MEMORY.md`: the index of the design notes (`docs/memory/`): the decisions, the history and the pitfalls.
- `SINGULARITY_DESIGN.md`: the Singularity sequence.
- `AUDIT.md`: the 2026-10 codebase audit and what's left from it.
