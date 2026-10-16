## Nova naming
The Unified build (`apps/unified.jsx`) is published as **El Cabeza Nova**
at `dist/el-cabeza-nova.html` (the landing-page button reads "Nova"). The
old `el-cabeza-unified.html` had already been shared, so `build/build.js`
still writes that file, now as a tiny redirect to Nova that keeps any
`?query`/`#hash`. Don't remove the redirect.


## Singularities, not black holes (player-facing)
Since 2026-10-16 (user: "I'm thinking we need to replace all black hole
verbiage to singularity and all appropriate grammatically correct
variations"), every word a player reads says singularity: the law is
"Singularity squares" (Nova menus) / "Singularity Squares" (rules card,
Futuris), the picker "Place the singularities", the switch "Exit from any
other singularity", the corner menu "Singularities" and "Singularity
exits", Lluvia's "SINGULARITIES". Code keeps its names (blackHoleSquares,
BLACK_HOLES, holeAnyExit, "hole" in test ids and helpers); new
player-facing text must say singularity. Futuris's Singularity (the dive,
the sphere) keeps its name too.
