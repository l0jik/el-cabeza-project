## Tienda: everything Neon's Singularity offers, in the store's terms (user request)

"Make sure everything implemented in Neon Singularity is fully implemented
in a thematic way in Tienda." Inventory against the sphere, and where each
lives now:

| Singularity (Neon) | Tienda |
|---|---|
| MATTER: 11 pieces, counts 0–4 (Cabeza 1–2), Arco Chico/Alto/Ancho, 3-D models | Order form 1 · Pieces: same 11 with catalog numbers/prices, Arco size row (`tienda-arco-*`), wood photographs + 3-D viewer (the size's model) |
| LAWS + warnings + "i" to rules cards | 2 · Rules: every law, "How it works ›" (`tienda-law-KEY-info`, opens the MOVES card over the form), warnings with a ☞ (`shove-opa-needs-three`, `law-warning-cantileverPivot`). Shoving has no settings any more. |
| TOPOLOGY size, Missing Squares 1–5 pairs, Black Hole place, Select/Random/Done/Cancel pickers, back-row and wall-off rules | 3 · Board: size steppers + diagram (now shows X/O marks), Missing squares with Pairs 1–5 and Where + Select, Black holes' Where + Select; `SquarePicker` = "mark the board" (X / O, partner filled in, dots where pieces start, rolled marks dashed; tap a rolled mark to keep it; back rows hatched; wall-off cells red dash) |
| Opponent/AI in the summary | 4 · Who's playing: A friend / The demonstrator plays Dark or Light, How well it plays (chassis state via setup extras) |
| CONFIGURATIONS (saved presets) | 5 · Carbon copies: name + File a copy, pink slips with Use / Throw away (confirm); `localStorage["el-cabeza:tienda-orders"]`, rules only |
| Collapse, toll, sphere (the ceremony) | "Place order & play": ORDER FILLED rubber stamp + the register rung up (`audio.playOrderFilled`), form goes, game begins |
| Board palette/FX; black hole orb; missing-square static | Chassis hooks `theme.buildBlackHoleVisual` / `buildMissingSquareVisual`: a felt pocket with a brass ring; a square cut through the board (plywood walls, the table in shadow) |
| In-game variants flyout (top left) | The sales slip: "Your order · N changes" price tag, unfolds (hover shows, tap pins) into the typed slip RULES / PIECES / BOARD; rules open their card; "Rules for this game ›" |
| Persistence across New Game, RETAIN/RECONFIGURE, Reset rules | Already shared (beginCustomGame registers reapply/reconfigure) |

- **Shared model** (themes/rules-selections.js, also Lluvia's): pieces incl.
  `block1x3`/`block2x3` (Lluvia signs 棒/板), `arcoSize`, `shove`,
  `missingCount` + `missingSpots` + `holeSpot` (spot + 180° mirror; `random`
  flag), `normalizeSelections` (old saves, `size` → rows/cols),
  `effective` defaults check, `fillSpots`/`randomizeSpots`/`refreshSpots`/
  `spotProblem` (ported from Neon's fillPairedSpots etc.), `lawsForEngine`,
  `lawWarnings`, `variantsOf(sel, labels)` (Tienda: RULES/PIECES/BOARD),
  `applySelections` honours hand spots (pieces set out round them; a
  clash with the classic opening randomizes it, as Neon does).
  `piecesFit` counts marked home-row squares. Tests:
  tests/rules-selections.smoke.mjs; e2e-tienda "everything the Singularity
  offers" pass (laptop).
- Fixed on the way: the old form said "Two squares cut out" but cut two
  pairs.

