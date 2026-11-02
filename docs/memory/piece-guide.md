# The Piece guide and Why not: two settings, kept off the chosen piece

Built 2026-11-02. The user, with a City phone screenshot (the 1×3 Block's
card over the selected piece): "Piece guide cards will have to be moved so
it doesn't cover up the piece that is currently selected." With the All
settings list, the icons of Check alert, Actions left, Move costs and Piece
guide circled: "Clicking on their icons should give you a brief overview as
to what they do. And number two, the why it won't work should be its own
separate setting, because if it's folded into Piece Guide, There's too much
on the screen at one time. When a why it won't work explanation triggers,
and it feels different enough from the piece guide that maybe within the
piece guide there can be a sub menu or something, but yeah, they need to be
separated out."

## Two settings

- **Piece guide** (`showGuide`, localStorage `el-cabeza:piece-guide`): the
  card that says what the chosen piece does (`piece-card`), and on the
  phone bar its "tap a piece / tap a marked square" tips. Its words no
  longer mention refused moves.
- **Why not** (`whyNotOn`, localStorage `el-cabeza:why-not`): the note on
  a refused move, the X on the square and its bubble (`why-not`, tag "Why
  not"). Its own switch everywhere the guide has one, right after it: the
  dock's foot (`why-not-toggle`, a question in a ring, left of the guide's;
  the language badge and the layout switch moved one slot left, the
  players' line and the footer links reserve one more slot), the calm
  menu's Help on the board (`whynot`, after `guide`), the phone bar's menu
  (`shell-menu-why-not`), the first-game tour's lists. On unless switched
  off; with nothing saved yet it follows the guide's saved value, so a
  player who'd switched the guide off (when it held the note) keeps the
  notes off.
- "Too much on the screen at one time": while a note is up the piece card
  steps aside (`pieceCardShown` has `!whyNot`), back when the note goes.
  The phone bar's piece text sits in the bar, not over the board, and
  stays.
- Named "Why not" (es "Por qué no", vi "Vì sao không"), the user's "the
  why it won't work"; renameable in one place per menu (NAMES, the shell's
  Toggle, the dock's title and the tag) if they want other words.

## Off the chosen piece

- `pieceScreenRect(id)` (chassis): the piece's box on the screen, its
  children and all (a City building rides on its piece), projected from a
  box kept per mesh in the piece's own frame. Test hook
  `__EC_TEST_PIECE_RECT__(id)`.
- The card (`pieceCardSpot`): in its own place at the lower left
  (`pieceCardBottom`) unless that covers the chosen piece (8 px round it);
  then the spot that covers it least, scored as piece overlap ×1000 plus
  overlap with the screen's controls (corner tab, City clock, dock corner,
  turn buttons, points counter, check alert, music chip, Lab HUD, corner
  column, full screen), the order breaking a tie: top left under the tab,
  top right, foot right. Checked about 7 times a second from the frame
  hooks; left where it is while it's clear (no hopping as the view moves);
  back in its own place when it next shows. `data-spot` on the card
  ("own", "top-left", ...). It fades in where it goes. The pause chip's
  lift (phones) only while it's in its own place.
- The note: each frame, the sides of the X in order (a computer's right,
  left, above, below; a phone's above, left, right, below), the first that
  fits the screen and is clear of the chosen piece; else any side clamped
  onto the screen and clear; else as before.

## The icons say what each does

- The calm menu's More list (menu-fan.js `row`): a row with a tip gets its
  icon as a button of its own (`cr-ab`, `data-mf-about-b`, 44 px, "What is
  {name}?"), over the row's own icon place. A tap opens the tip in a line
  under the row (`menu-fan-about`, `data-mf-about`), one at a time; a
  second tap or Escape shuts it. The row still flips its switch. Not in a
  wedge's card (`row(x, false)`): the card says the tip at its head.
- The phone bar's menu already says each switch's line under its name.

## Tests

tests/e2e-piece-card-place.mjs (City phone, Luna desktop), e2e-why-not.mjs
(the tag, the card stepping aside, the note off the Cruce, Why not off,
guide off with Why not on, the old guide-off player), e2e-rings.mjs (Why
not's row, the icon lines), e2e-first-look.mjs, e2e-first-game-tour.mjs.
