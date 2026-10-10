## Rules pop-up audio: ABOUT tab only (user rule)

The angelic choir (`audio.playMenu`) and its closing cue
(`audio.fadeOutMenu`) belong to the ABOUT tab of the rules pop-up and
nothing else:
- **Choir:** plays when the rules open on ABOUT, or when the player
  switches to ABOUT.
- **Closing cue:** plays only when the pop-up closes while ABOUT is
  showing.
- **Leaving ABOUT for another tab:** only silences the choir
  (`audio.stopMenu`, a 0.25 s fade with no tail).
- **Every other open, switch or close gets its own small Neon earcon**
  (user follow-up):
  - `playRulesOpen` (How to play and every other non-ABOUT open): ONE
    plain struck tone, D5 with a faint octave, soft attack and a 0.5 s
    fall, peak 0.00845. It was a rising two-note glass figure with an
    air swish; the user found that "too much like a Nintendo game" and
    asked for something more austere and 20% quieter.
  - `playRulesClose`: the same plain tone a fourth lower (A4), softer
    (0.0068) and shorter (0.42 s), so closing settles. Replaced the old
    falling two-note figure at the user's request, to match the open.
  - `playRulesTab()`: the SAME tick for every tab (user: the one COSTS
    had, G#6, a sine plus a 2.76x bell partial), in ten near-identical
    takes (`TAB_TAKES`: a few cents, the partial's ratio, the decay and a
    trace of tanh soft-clip grit). Never the same take twice. It no
    longer follows the tab's position; the chassis still passes an index,
    which is ignored.
  - All go through `sfxGain`, so mute applies. Standard has no-ops.
  - Levels: open 0.00845, close 0.0068, tab 0.00576.

In the chassis, `openRulesAt(tab, focus)` and `switchRulesTab(tab,
focus)` are the only ways in. `infoTabRef` feeds the close cleanup. The
masthead Info button opens on the last-shown tab and plays the choir only
if that tab is ABOUT. Test hook: `window.__EC_MENU_CUES__ = []` logs
`play`/`close`/`stop`/`open`/`shut`/`tab` (e2e-rules "[menu audio]").

