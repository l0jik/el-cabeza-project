# Languages: English, Spanish (Argentina), Vietnamese

Asked for (user, 2026-10-24/25): "Go ahead with the Argentine Spanish
translation, sticking with the original plan to not include the videos or
recorded voices. That can still wait. I also want a Vietnamese translation
included as well in the same fashion. Also, not changing or updating or
creating new videos or recorded voices." The picker, from six options
drawn on the real screens (https://claude.ai/artifact/1WmMktmNdTrvTcQVSN27yX):
"For the language picker, go with 2 and 4."

- **2**: the device's language guessed, and a quiet EN · ES · VI line under
  Begin on Nova's title (apps/title-screen.js). A press changes every word
  on the title at once and keeps the choice; it doesn't begin.
- **4**: a badge in the dock, its two letters in a little box
  (chassis/LanguageBadge.jsx): on a computer one of the dock's foot icons,
  left of the piece guide's; on a phone (whose foot row is full) at the end
  of the "… to move" line. A press opens the three, each named in its own
  language ("Language · Idioma · Ngôn ngữ" over them); a choice changes
  the game's words at once, the game as it was. The list is put on the
  page itself (a portal): the dock's panel is scaled as it opens, and a
  fixed list inside it was placed from the panel, up over the board.

Text only. The videos (the title splash, the den TV's spot) and the
recorded voices are as they were; when they're wanted, it's a separate
job (the user: "That can still wait").

## Which language

`?lang=en|es|vi` (that visit only), else the one the player chose (kept in
localStorage `el-cabeza:language`), else the device's first of the three
(`navigator.languages`: any Spanish, any Vietnamese), else English.
chassis/i18n.js `firstChoice()`; the title, not a module, works it out the
same way itself. `<html lang>` follows (es-AR, vi, en): the Lluvia corner
menu's CSS reads it.

## How the words get there

The English is the key: every line a player reads is looked up by its
English in the language's table, i18n/es.js or i18n/vi.js (fetched only
once its language is chosen: separate chunks, Spanish 155 KB and
Vietnamese 204 KB, 53 and 57 KB as sent compressed). A line a
table hasn't got shows in English. In English nothing is looked up at all.

- **React's text** needs nothing: the pages' JSX runtime
  (chassis/i18n-jsx/jsx-runtime.js, set by build/build.js
  `jsxImportSource: "ec-i18n"`) passes every string child of a host
  element through `tr()`, and its title, aria-label, placeholder and alt.
  Theme files that use `React.createElement` (reality-gate.js and the
  like) take the translating `createElement` from that file instead.
- **A line made of parts** is written whole with named holes:
  `t("{side} to move", { side })`; a hole given a string is looked up too
  (a side's name, a piece's). Words set off in a line: `rich("The
  <b>{piece}</b> ...", vars)` (b, i, em, strong; the tables keep the marks
  round their own words). Lists: `listOf([...])` (Intl.ListFormat).
- **A word with two senses in English**: `trIn("Play", "music")` looks up
  "Play [music]" first, then "Play". Used for Play (the music vs a game),
  Turn (a piece round vs a turn of the game), and "Replay a game [link]"
  (Spanish's short form for the dock's foot link, "Ver repetición": the
  long one ran past its room).
- **Text a page puts in by hand** (the story's cards, the store's and the
  sphere's overlays, the corner menu's HTML, the den's hints): a
  MutationObserver (chassis/i18n.js `watchPage`) translates every text
  node and those four attributes React didn't make, as each comes and
  again when the language changes, keeping each node's English to go back
  to. It leaves alone anything inside `[data-lang]` (the title, the badge)
  and `[data-said]` (words a page already put in the language: the
  ending's lines, revealed a word at a time, and Luna's tab, a word to a
  span). It runs only while a table is in.
- **A paragraph** not in a table whole is looked up a sentence at a time
  (`sentencesOf`: a sentence ends at . ! ? or … before a space), so the
  rules' long texts are in the tables sentence by sentence.
- **Painted words** (canvas textures: the store's aisle signs, the den's
  props, the receipt) call `tr()` when they're painted. The store's signs
  shrink to fit their English width (×1.12) in tienda-textures.js
  `text()`.
- **Components that make their own lines** call `useLanguage()` to be
  drawn again when it changes (ElCabeza3D, CornerMenu, the badge, ...);
  plain JS listens with `onLanguage(fn)` or the window event
  `el-cabeza:language-changed`.
- **The engine** never imports the language (its worker has no React):
  where it says something it hands back `say: [line, vars]` beside its
  English `error` (engine/replay.js), and the chassis shows `t(...say)`;
  chassis/shove-settings.js takes a `say` function.

## Known limits

- The store's aisle signs and the den's props are painted when the scene
  is built: a switch in the middle of a scene leaves them in the language
  they were painted in until the scene's built again (a reload, the next
  visit).
- A copied move log's move lines keep the sides' English names (Walnut,
  Ash) so "Replay a game" can always read them back; its summary line and
  the replay code's label are in the language. The replay code is found by
  its tag, not the label.
- Lluvia's corner menu has the street's Vietnamese over the English; in
  Vietnamese the English half (`.en`) is hidden (it would say it twice).
- Proper names stay: El Cabeza, Cabeza Nova, Big Glutts, the pieces'
  names (Cabeza, Turrito, Flaco, Chato, Opa, Codo, ...), the worlds'
  own names (Futuris, Lluvia, Luna, Noir, Plano, Cromo, Tá muid beo, Go
  deo na ndeor), the Irish titles, the credits' file and author names,
  "CPU · {level}", "AI · {level}" in Vietnamese.
- Some phone foot links truncate with "…" in Spanish, as two of them
  already did in English on a phone.

## The tables' voice

- Spanish (Argentina): vos (tocá, elegí, mové, ponete), "vos jugás";
  "pieza", "bando" (a side), "tablero", "casilla"; "partida" (a game),
  "jugada" (a move); laws "leyes", rules "reglas"; "singularidad",
  "casillas faltantes"; the computer "la computadora" (its button "IA");
  Opa masculine (el Opa);
  hint colours as "las piezas de color {hint}" (no adjective agreement).
- Vietnamese: "bạn" for you; "quân" (a piece), "bên" (a side), "bàn cờ",
  "ô"; "ván" (a game), "nước đi" (a move); "luật"; "điểm kỳ dị",
  "ô khuyết"; the computer "máy" (its button stays "AI").

## Changing a line, adding one

- A new player-facing line in JSX needs nothing but its entry in both
  tables (keyed by the English, exactly; spaces and line breaks don't
  matter). A new line made of parts: write it whole with `t()`.
- Where a file's `t` is something else, import the words' `t` under
  another name: the phone shell (chassis/MobileShell.jsx), where `t` is the
  look's tokens, has `inWords`; futuris-singularity.js `say`; lab/hud.js
  and tienda-order.js `inWords`. A `t("...")` on a look's tokens throws:
  7764d69 called it in the shell's play panel (the actions meter, the
  piece card) and online lines, and every phone game stopped at Begin
  until the next push. Run e2e-nova-mobile after touching the shell.
- Which lines the code has and which a table lacks:
  `node tools/i18n_strings.mjs` (counts, the missing, and the lines made of
  parts that want writing whole); `--list` every line by file.
- The tables were made in 19 batches (2,114 Spanish and 2,126 Vietnamese
  lines; ids from a frozen work list, then the lines the list couldn't see:
  the corner menu's HTML, the gate's picker, lines rewritten with holes).
  The batch files were scratch work; the tables are the source now.
- tests/e2e-language.mjs: the device guess, ?lang=, the title's line, the
  badge on a computer and a phone, the corner menu in play, and English as
  it was.
