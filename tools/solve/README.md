# Solving pieces of El Cabeza

Small, exact answers with the real engine (standard rules: 10×10, two
actions, no laws), as a start on "is this game solved?".

- `endgame.mjs <world>`: retrograde analysis of a tiny world — every
  position labelled WIN, LOSS or DRAW for the side to move, with the
  plies to the end. Worlds: `cc` (the two Cabezas), `ct-c` (Cabeza and
  Turrito against a lone Cabeza), `cf-c` (Cabeza and Flaco against a
  lone Cabeza), `cc6` and `ct-ct6` (on a 6×6 board, the latter a Turrito
  each). Writes `<world>.values.bin`.
- `block-value.py`: how often a block changes a world's result against
  the two Cabezas alone.
- `forced.mjs <dark|light> <turns> [seconds]`: a bounded proof from the
  standard opening — can that side force a win within its first N turns,
  whatever the other does? An AND/OR search over whole turns with a
  sound distance bound.
- `common.mjs`: the shared loader (as the complexity measurements used).

Run from the repository root with Node 22, e.g.
`node --max-old-space-size=6000 tools/solve/endgame.mjs ct-c`.
