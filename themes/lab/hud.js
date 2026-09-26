/* Theme Lab: the in-game read-out every direction composes its own way.

   One component, one piece of markup: the theme id, the turn number,
   whose move it is, the numbers (moves, points spent, pieces left,
   pieces taken, time), the last few moves, and how the game ended. The
   ten stylesheets (themes/lab/css.js) turn the same markup into a Swiss
   column, a Bauhaus set of forms, a Mondrian grid, a tilted
   Elementarist stack, Brutalist blocks, a Tschichold page, a departure
   board, Neo-Brutalist cards, near-nothing, or a machine panel.

   It only reads the game (x.game, handed over by the chassis); it
   changes nothing. The session clock and the count of pieces at the
   start live at module level, so they carry across theme switches the
   way the game itself does. */

import React from "react";

const h = React.createElement;

const SESSION = { startedAt: null, initial: null, gameKey: 0 };
export function labSession() { return SESSION; }

const pad2 = (n) => String(n).padStart(2, "0");
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; };
const SIDE = { dark: "Dark", light: "Light" };

function flap(text) {
  return h("span", { className: "lab-flap", "aria-hidden": "true" }, [...String(text)].map((ch, i) => h("b", { key: i }, ch === " " ? " " : ch)));
}

export function LabHud({ spec, x }) {
  const game = x && x.game;
  const audio = x && x.audio;
  const [, setNow] = React.useState(0);
  const [captured, setCaptured] = React.useState(false);
  const prevPlayer = React.useRef(game && game.currentPlayer);
  const prevCount = React.useRef(game ? game.pieceCount.dark + game.pieceCount.light : 0);

  // The session: a game starts when Begin Game is pressed.
  if (game) {
    if (game.awaitingBegin) { SESSION.startedAt = null; SESSION.initial = null; }
    else if (!SESSION.startedAt) { SESSION.startedAt = Date.now(); SESSION.initial = { ...game.pieceCount }; SESSION.gameKey++; }
    if (game.status === "finished" && !SESSION.endedAt) SESSION.endedAt = Date.now();
    if (game.status !== "finished") SESSION.endedAt = null;
  }

  React.useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // A turn changing and a piece being taken are the two moments the
  // read-out marks with motion and (for the turn) sound.
  React.useEffect(() => {
    if (!game) return;
    if (prevPlayer.current && prevPlayer.current !== game.currentPlayer && !game.awaitingBegin && game.status === "playing") {
      audio && audio.playTurn && audio.playTurn();
    }
    prevPlayer.current = game.currentPlayer;
  }, [game && game.currentPlayer]);
  const count = game ? game.pieceCount.dark + game.pieceCount.light : 0;
  React.useEffect(() => {
    if (count < prevCount.current) {
      setCaptured(true);
      const t = setTimeout(() => setCaptured(false), 420);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
    return undefined;
  }, [count]);

  if (!game) return null;
  const setup = game.awaitingBegin;
  const turn = setup ? 1 : game.turns + (game.status === "finished" ? 0 : 1);
  const who = SIDE[game.currentPlayer];
  const ai = game.aiPlayer && game.aiPlayer === game.currentPlayer;
  const init = SESSION.initial || game.pieceCount;
  const taken = { dark: Math.max(0, init.light - game.pieceCount.light), light: Math.max(0, init.dark - game.pieceCount.dark) };
  const elapsed = SESSION.startedAt ? (SESSION.endedAt || Date.now()) - SESSION.startedAt : 0;
  const recent = game.log.slice(-6).map((e, i, arr) => ({ ...e, n: game.log.length - arr.length + i + 1 })).reverse();
  const corp = spec.hud === "corporateSwiss";
  const turnText = setup ? "Set up" : game.status === "finished" ? "Game over" : `${who} to move`;

  const stats = [
    ["Moves", pad2(game.log.length)],
    ["Points", setup ? "—" : `${game.stepsUsed}/${game.turnBudget}`],
    ["Dark", pad2(game.pieceCount.dark)],
    ["Light", pad2(game.pieceCount.light)],
    ["Taken", `${taken.dark}–${taken.light}`],
    ["Time", clock(elapsed)],
  ];

  return h(
    "section",
    {
      className: "lab-hud",
      "data-testid": "lab-hud",
      "data-lab": spec.id,
      "data-player": game.currentPlayer,
      "data-status": game.status,
      "data-phase": setup ? "setup" : "play",
      "data-focus": game.selectedId ? "selected" : "none",
      "data-captured": captured ? "yes" : "no",
      "aria-label": `${spec.name}: game status`,
    },
    h("div", { className: "lab-id" }, h("span", { className: "num" }, spec.num), h("span", { className: "name" }, spec.name)),
    h("div", { className: "lab-big", "aria-hidden": "true" }, h("small", null, "Turn"), corp ? flap(pad2(turn)) : pad2(turn)),
    h(
      "div",
      { className: "lab-turn", key: `${game.currentPlayer}-${game.status}-${setup}`, role: "status", "aria-live": "polite", "data-testid": "lab-hud-turn" },
      corp ? h("small", null, "Side to move") : null,
      corp ? null : h("i", { className: "lab-swatch", "aria-hidden": "true" }),
      corp ? flap(setup ? "SETUP" : game.status === "finished" ? "OVER" : who.toUpperCase()) : turnText,
      corp ? h("span", { className: "lab-sr" }, turnText) : null,
      ai ? h("span", { className: "lab-ai" }, corp ? "" : " · AI") : null
    ),
    h("dl", { className: "lab-stats" }, stats.map(([k, v]) => h("div", { key: k }, h("dt", { className: "lab-label" }, k), h("dd", null, v)))),
    spec.hud === "destijl" ? h("div", { className: "lab-note lab-label" }, game.selectedType ? `${game.selectedType}` : "·") : null,
    recent.length
      ? h("ol", { className: "lab-log", "aria-label": "Recent moves" }, recent.map((e) => h("li", { key: e.n },
        h("span", { className: "n" }, pad2(e.n)),
        h("span", { className: "m" }, h("i", { className: "p", "data-p": e.player, "aria-label": SIDE[e.player] }), `${e.notation || ""}${e.mark || ""}`))))
      : null,
    h("div", { className: "lab-over", role: "status" }, game.status === "finished" && game.winner ? `${SIDE[game.winner]} wins` : "", game.winReason ? h("div", { className: "lab-label", style: { marginTop: 6 } }, game.winReason) : null)
  );
}
