/* Theme Lab: the in-game read-out every direction composes its own way.

   One component, one piece of markup: the theme id, the turn number,
   whose move it is, the numbers (the theme's name, moves, actions spent,
   the AI's level, time), the last few moves, and how the game ended. The
   nine stylesheets (themes/lab/css.js) turn the same markup into a Swiss
   column, a Bauhaus set of forms, a Mondrian grid, a tilted
   Elementarist stack, Brutalist blocks, a Tschichold page, a departure
   board, Neo-Brutalist cards, near-nothing, or a machine panel.

   In play it gets out of the way (user: it took a lot of the screen):
   half size, tucked into the top left corner under the lab's bar, moved
   there gracefully, not faded; a hover (mouse) or a tap brings it up to
   full size there, and it goes back down when the pointer leaves, on a
   second tap, or by itself a while after a tap. Each direction's own
   look (position, tilt) is left alone: it's moved with the separate CSS
   translate and scale properties, measured each time, so it lands in the
   corner whatever the direction did to it. Set up and game over: where
   the direction puts it, full size.

   In play it also carries the game's rules (the corner menu every other
   world has, chassis/corner-menu.js, here in the read-out's own type),
   above the last few moves: tucked away, one line summing them up;
   brought up, the laws and their settings, each side's pieces, the board.
   A law's name opens its rules card.

   It only reads the game (x.game, handed over by the chassis); it
   changes nothing. The session clock and the count of pieces at the
   start live at module level, so they carry across theme switches the
   way the game itself does. */

import React from "react";
// (React's, each element's words in the player's language: chassis/i18n.js.)
import { createElement } from "../../chassis/i18n-jsx/jsx-runtime.js";
// (Words in the player's language: chassis/i18n.js.)
import { t as inWords } from "../../chassis/i18n.js";
import { sideNamesFor } from "../side-names.js";
import { isoPictures, isoPicturesCached } from "../reality-gate.js";

const h = createElement;

/* The pieces' pictures in the rules, in whichever side's colour reads on
   the look's page (WCAG contrast): in most looks one side's pieces are all
   but the ground they stand on (Swiss's white on white, Minimal Mono's,
   Fusion's and Corporate Swiss's dark on dark). */
const lumOf = (c) => {
  const n = typeof c === "number" ? c : parseInt(String(c).replace("#", ""), 16);
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export function pictureSide(spec) {
  const bg = spec && spec.colors && spec.colors.bgPrimary, P = spec && spec.pieces;
  if (!P || !P.dark || !P.light || !/^#?[0-9a-f]{6}$/i.test(bg || "")) return "light";
  return contrastOf(P.dark.color, bg) > contrastOf(P.light.color, bg) ? "dark" : "light";
}

const SESSION = { startedAt: null, initial: null, gameKey: 0 };

const pad2 = (n) => String(n).padStart(2, "0");
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; };

function flap(text) {
  return h("span", { className: "lab-flap", "aria-hidden": "true" }, [...String(text)].map((ch, i) => h("b", { key: i }, ch === " " ? " " : ch)));
}

// A computer's or a Chromebook's screen, room beside the board (the
// complement of css.js's compact layout): the rules and the moves larger
// there (css.js), and the read-out, brought up, scrolls when it must.
const BIG_SCREEN = "(min-width: 900px) and (min-aspect-ratio: 1501/1000)";

// A rules card, opened the way every part of the page opens one (the
// chassis listens; chassis/RulesCards.jsx).
const openRules = (tab, focus = null) => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab, focus } }));

// change: Change rules (the chassis's, where the rules can be chosen), or null.
// spec, look: the direction and its own pieces (buildPieceVisual), for the
// pieces' pictures.
function LabRules({ rules, open, change = null, spec = null, look = null }) {
  const ref = React.useRef(null);
  const listRef = React.useRef(null);
  const pcsRef = React.useRef(null);
  // The pieces' pictures (reality-gate.js isoPictures): drawn once for a
  // look and a set of kinds, while the game's begun and nothing's asked of
  // the screen (or straight away, brought up before then); kept.
  const lookKey = spec ? `lab-${spec.id}` : null, dark = pictureSide(spec) === "dark";
  const kinds = rules.pieces.map((p) => p.type), kindsKey = kinds.join(",");
  const [pics, setPics] = React.useState(() => (lookKey ? isoPicturesCached(lookKey, kinds, dark) : null));
  React.useEffect(() => {
    if (!look || !lookKey) return undefined;
    const have = isoPicturesCached(lookKey, kinds, dark);
    if (have) { setPics(have); return undefined; }
    setPics(null);
    let live = true;
    const draw = () => { if (!live) return; const p = isoPictures(lookKey, look, kinds, { dark }); if (live) setPics(p); };
    if (open) { draw(); return () => { live = false; }; }
    const idle = typeof window !== "undefined" && window.requestIdleCallback;
    const id = idle ? window.requestIdleCallback(draw, { timeout: 2500 }) : setTimeout(draw, 400);
    return () => { live = false; if (idle) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, [lookKey, dark, kindsKey, look, open]);
  React.useLayoutEffect(() => {
    const box = ref.current, hud = box && box.closest(".lab-hud");
    if (!hud) return;
    // (Each direction colours its numbers and labels its own way: the
    // rules take the same two colours, read off the stats beside them.)
    const dd = hud.querySelector(".lab-stats dd"), dt = hud.querySelector(".lab-stats dt");
    if (dd) box.style.setProperty("--lab-rules-ink", getComputedStyle(dd).color);
    if (dt) box.style.setProperty("--lab-rules-sub", getComputedStyle(dt).color);
    // Brought up on a phone, the read-out sits full size under the lab's
    // bar and the rules lie over the board: the list has the room left
    // below it on the screen (clear of the corner buttons) and scrolls
    // within that, rather than running off the foot of a short screen.
    // Measured where it will be, not mid-glide: every length read off the
    // screen over the read-out's scale now (its scale property), so at its
    // full size. (On a computer's screen the read-out itself scrolls when
    // it must, the rules and the moves beneath them as one: LabHud.)
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia && window.matchMedia(BIG_SCREEN).matches) { list.style.maxHeight = ""; return; }
    const hr = hud.getBoundingClientRect(), k = (hud.offsetWidth && hr.width / hud.offsetWidth) || 1;
    const off = (list.getBoundingClientRect().top - hr.top) / k;
    const bar = document.querySelector('[data-testid="lab-bar"]');
    const b = bar ? bar.getBoundingClientRect() : null;
    const top = (b && b.height ? b.bottom : 10) + 8;
    // (Its own lengths that much larger on the screen where the rules are
    // zoomed, brought up on a small screen: css.js.)
    const z = parseFloat(getComputedStyle(box).zoom) || 1;
    list.style.maxHeight = `${Math.round(Math.max(140, window.innerHeight - top - off - 64) / z)}px`;
  });
  // A kind's pictures all on one line, never broken over two (user:
  // "Pictures shouldn't wrap ... They all have to be in their own row. So
  // if there's so many that the copies for a particular piece won't fit,
  // then just move that whole section down to the next line."; on slab
  // phones, foldables and computers alike): where a kind's name, pictures
  // and number are wider than its column, it takes the whole width, on a
  // line of its own below the kinds before it (data-wide, css.js); where
  // they're wider than that too, its pictures overlap to fit (css.js).
  // Measured when the list's brought up, its pictures come or its numbers
  // change, whenever its width changes, and once the look's type is in.
  const countsKey = rules.pieces.map((p) => `${p.type}${p.count}`).join(",");
  React.useLayoutEffect(() => {
    const ul = pcsRef.current;
    if (!ul) return undefined;
    let lastW = -1;
    const fit = () => {
      const cs = getComputedStyle(ul);
      lastW = ul.clientWidth;
      // (Lengths in the list's own terms, whatever its zoom does to them.)
      const k = (ul.offsetWidth && parseFloat(cs.width) ? ul.offsetWidth / parseFloat(cs.width) : 1) || 1;
      const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
      const colW = (lastW - (cols - 1) * (parseFloat(cs.columnGap) || 0) * k) / cols;
      for (const li of ul.children) {
        const g = (parseFloat(getComputedStyle(li).columnGap) || 0) * k, nm = li.querySelector(".nm"), ct = li.querySelector(".ct");
        const imgs = li.querySelectorAll(".cp img");
        let need = nm ? nm.offsetWidth : 0;
        if (imgs.length) need += g + [...imgs].reduce((n, im) => n + im.offsetWidth, 0);
        if (ct && !ct.classList.contains("lab-sr")) need += g + ct.offsetWidth;
        const wide = cols > 1 && need > colW + 0.5 ? "true" : "false";
        if (li.dataset.wide !== wide) li.dataset.wide = wide;
      }
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (ul.clientWidth !== lastW) fit(); }) : null;
    if (ro) ro.observe(ul);
    // (Again once the look's own type is in: a name's width is its font's.)
    let live = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live) fit(); });
    return () => { live = false; if (ro) ro.disconnect(); };
  }, [open, pics, countsKey]);
  const { laws, pieces, board } = rules;
  const law = (l) => h("li", { key: l.key },
    h("button", { type: "button", "data-testid": `lab-rules-law-${l.key}`, onClick: (e) => { e.stopPropagation(); openRules("moves", l.key); } }, l.name),
    (l.sets || []).map(([k, v]) => h("i", { key: k }, `${k}: ${v}`)));
  return h("div", { ref, className: "lab-rules", "data-testid": "lab-hud-rules", "data-open": open ? "true" : "false" },
    h("div", { className: "row" }, h("span", { className: "lab-label" }, "Rules"), h("span", { className: "sum" }, `${rules.summary} ${open ? "\u25B4" : "\u25BE"}`)),
    open && h("div", { ref: listRef, className: "lab-rules-list" },
      h("span", { className: "lab-label" }, "Laws"),
      h("ul", null, laws.length ? laws.map(law) : h("li", null, "None: the standard rules")),
      h("span", { className: "lab-label" }, "Pieces \u00b7 each side"),
      // Each kind by its name, then a picture for every one of it on the
      // board, side by side on one line (user: "Let's just go with option
      // 3. So I assume if I chose 5 Opas, it'll have a 5 thumbnails of
      // Opas"; never onto a second line: the fit above). The number after
      // them where it isn't the standard game's, marked and said: a colour
      // alone is lost where a direction's accent is its ink, Brutalism's
      // and Minimal Mono's. (None of a kind: its picture faint. No pictures
      // yet: the number.)
      h("ul", { ref: pcsRef, className: "pcs", "data-testid": "lab-rules-pieces", "data-side": dark ? "dark" : "light", "data-pictures": pics ? "true" : "false" }, pieces.map((p) => {
        const odd = p.count !== p.std, pic = pics && pics[p.type];
        const said = !pic || odd || p.count !== 1;
        return h("li", { key: p.type, className: odd ? "changed" : undefined, "data-type": p.type, "data-count": p.count },
          h("span", { className: "nm" }, p.name),
          pic ? h("span", { className: "cp" }, Array.from({ length: Math.max(1, p.count) }, (_, i) => h("span", { key: i, className: "c" },
            h("img", { src: pic.url, width: pic.w, height: pic.h, alt: "", draggable: false, className: p.count ? undefined : "none" })))) : null,
          h("b", { className: said ? "ct" : "ct lab-sr" }, pic && said ? h("span", { "aria-hidden": "true" }, "\u00d7") : null, p.count,
            odd ? h("span", { className: "mark", "aria-hidden": "true" }, "*") : null, odd ? h("span", { className: "lab-sr" }, ", not as in the standard game") : null));
      })),
      pieces.some((p) => p.count !== p.std) ? h("span", { className: "lab-rules-key" }, h("span", { className: "mark", "aria-hidden": "true" }, "*"), " Differs from the standard game") : null,
      h("span", { className: "lab-label" }, "Board"),
      h("ul", null,
        h("li", null, "Size ", h("b", null, board.label)),
        board.pairs ? h("li", null, "Missing squares ", h("b", null, `${board.pairs} ${board.pairs === 1 ? "pair" : "pairs"}`)) : null),
      // (User: "Do we need to have a button in every game to allow
      // toggling between standard game and Cabeza Nova rules?"; "Go with
      // A + B": Change rules at the foot of the Rules card, here the
      // Lab's Rules line.)
      change ? h("button", { type: "button", className: "lab-rules-change", "data-testid": "lab-rules-change", onClick: (e) => { e.stopPropagation(); change(); } }, "Change rules", " \u203a") : null));
}

export function LabHud({ spec, x, look = null }) {
  const SIDE = sideNamesFor(spec && spec.id); // "Red" / "Blue" in De Stijl, and so on
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

  // In play: compact in the top left (open: full size there). Put down,
  // only whose move it is and the turn's number show (css.js HUD_BASE,
  // data-compact="small"; user: "much smaller ... maybe half the size").
  const hudRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const lastPointer = React.useRef(null);
  const compact = !!game && !game.awaitingBegin && game.status === "playing";
  const placed = React.useRef(false);
  React.useLayoutEffect(() => {
    const el = hudRef.current;
    if (!el || typeof window === "undefined") return undefined;
    let clearT = 0;
    const place = (animate) => {
      const cur = { t: el.style.translate || "0px 0px", s: el.style.scale || "1" };
      el.style.transition = "none";
      // (In the corner it grows and shrinks from its top left, which stays
      // put however tall it gets: the rules' list, brought up, makes it
      // taller, and scaled about its middle its top would drop away from a
      // still mouse, which then left it, closing it, over and over.)
      el.style.transformOrigin = compact ? "0 0" : "";
      let next = { t: "0px 0px", s: "1" };
      if (compact) {
        const k = open ? 1 : 0.5;
        el.style.translate = "0px 0px"; el.style.scale = String(k);
        const r = el.getBoundingClientRect();
        const bar = document.querySelector('[data-testid="lab-bar"]');
        const b = bar ? bar.getBoundingClientRect() : null;
        const X = 12, Y = (b && b.height ? b.bottom : 10) + 8;
        next = { t: `${Math.round(X - r.left)}px ${Math.round(Y - r.top)}px`, s: String(k) };
      }
      el.style.translate = cur.t; el.style.scale = cur.s;
      void el.offsetWidth;
      const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.style.transition = animate && !still ? "translate 0.75s cubic-bezier(.3,.1,.2,1), scale 0.75s cubic-bezier(.3,.1,.2,1)" : "none";
      el.style.translate = next.t; el.style.scale = next.s;
      el.style.pointerEvents = compact ? "auto" : "";
      el.style.cursor = compact ? "pointer" : "";
      clearTimeout(clearT);
      clearT = setTimeout(() => { el.style.transition = ""; }, 820);
    };
    place(placed.current);
    placed.current = true;
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    // (A direction's own entrance animation moves it while it's being
    // measured: measured again once that's over, and once more later.)
    const onAnimEnd = (e) => { if (e.target === el) place(true); };
    el.addEventListener("animationend", onAnimEnd);
    const again = setTimeout(() => place(true), 1100);
    return () => { clearTimeout(clearT); clearTimeout(again); window.removeEventListener("resize", onResize); el.removeEventListener("animationend", onAnimEnd); };
  }, [compact, open, spec.id]);
  // (Back down by itself a while after a tap opened it, the while long
  // enough to read the rules in it, and begun again by a press inside it,
  // a scroll of the rules too. Brought up by the mouse, it stays while the
  // mouse is on it.)
  const openedBy = React.useRef(null);
  const [poke, setPoke] = React.useState(0);
  React.useEffect(() => {
    if (!open || !compact || openedBy.current === "hover") return undefined;
    const t = setTimeout(() => setOpen(false), 12000);
    return () => clearTimeout(t);
  }, [open, compact, poke]);
  React.useEffect(() => { if (!compact) setOpen(false); }, [compact]);
  /* Brought up on a computer's screen, it fits the screen: taller than the
     room below the lab's bar, it scrolls as one, the rules and then the
     moves beneath them (user: "the rules should be on top and the
     movement listing beneath"; on a short screen, a Chromebook's, the
     moves were off its foot). Only when it must: a scroll box would clip
     the cards' shadows. Put down, it's back at its top. Looked at every
     render (the moves grow, the rules change). */
  React.useLayoutEffect(() => {
    const el = hudRef.current;
    if (!el || typeof window === "undefined") return;
    const big = window.matchMedia && window.matchMedia(BIG_SCREEN).matches;
    const was = el.style.maxHeight;
    el.style.maxHeight = ""; el.style.overflowY = "";
    if (!(compact && open && big)) { if (was) el.scrollTop = 0; return; }
    const bar = document.querySelector('[data-testid="lab-bar"]');
    const b = bar ? bar.getBoundingClientRect() : null;
    const room = Math.max(160, Math.round(window.innerHeight - (b && b.height ? b.bottom : 10) - 8 - 12));
    if (el.scrollHeight > room) { el.style.maxHeight = `${room}px`; el.style.overflowY = "auto"; el.style.overscrollBehavior = "contain"; el.style.scrollbarWidth = "thin"; }
  });

  if (!game) return null;
  const setup = game.awaitingBegin;
  const turn = setup ? 1 : game.turns + (game.status === "finished" ? 0 : 1);
  const who = SIDE[game.currentPlayer];
  const ai = game.aiPlayer && game.aiPlayer === game.currentPlayer;
  const elapsed = SESSION.startedAt ? (SESSION.endedAt || Date.now()) - SESSION.startedAt : 0;
  const recent = game.log.slice(-6).map((e, i, arr) => ({ ...e, n: game.log.length - arr.length + i + 1 })).reverse();
  const corp = spec.hud === "corporateSwiss";
  const turnText = setup ? "Set up" : game.status === "finished" ? "Game over" : inWords("{side} to move", { side: who });

  /* (User: pieces left and taken said little; instead, which theme
     this is and how hard the AI plays, in every direction, its own name
     across the top of the numbers.) */
  const stats = [
    ["Theme", spec.name, "wide"],
    ["Moves", pad2(game.log.length)],
    ["Actions", setup ? "—" : `${game.stepsUsed}/${game.turnBudget}`],
    ["AI", game.aiLevel || "Off"],
    ["Time", clock(elapsed)],
  ];

  return h(
    "section",
    {
      className: "lab-hud",
      ref: hudRef,
      "data-testid": "lab-hud",
      "data-compact": compact ? (open ? "open" : "small") : "no",
      onPointerEnter: (e) => { if (compact && e.pointerType === "mouse") { openedBy.current = "hover"; setOpen(true); } },
      onPointerLeave: (e) => { if (compact && e.pointerType === "mouse") setOpen(false); },
      onPointerDown: (e) => { lastPointer.current = e.pointerType; if (open && e.pointerType !== "mouse") setPoke((n) => n + 1); },
      // (A tap opens and closes it; a mouse has the hover for that.)
      onClick: (e) => { if (!compact || lastPointer.current === "mouse") return; e.stopPropagation(); openedBy.current = "tap"; setOpen((o) => !o); },
      "data-lab": spec.id,
      "data-player": game.currentPlayer,
      "data-status": game.status,
      "data-phase": setup ? "setup" : "play",
      "data-focus": game.selectedId ? "selected" : "none",
      "data-captured": captured ? "yes" : "no",
      "aria-label": inWords("{look}: game status", { look: spec.name }),
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
    h("dl", { className: "lab-stats" }, stats.map(([k, v, cls]) => h("div", { key: k, className: cls || undefined, "data-stat": k.toLowerCase() }, h("dt", { className: "lab-label" }, k), h("dd", null, v)))),
    spec.hud === "destijl" ? h("div", { className: "lab-note lab-label" }, game.selectedType ? `${game.selectedType}` : "·") : null,
    // The rules, then the moves beneath them (user: "the rules should be on
    // top and the movement listing beneath. This should be consistent
    // across all similar menu types"; they came after the moves).
    compact && game.rules ? h(LabRules, { rules: game.rules, open, change: x.changeRules || null, spec, look }) : null,
    recent.length
      ? h("ol", { className: "lab-log", "aria-label": "Recent moves" }, recent.map((e) => h("li", { key: e.n },
        h("span", { className: "n" }, pad2(e.n)),
        h("span", { className: "m" }, h("i", { className: "p", "data-p": e.player, "aria-label": SIDE[e.player] }), `${e.notation || ""}${e.mark || ""}`))))
      : null,
    // (Against the computer or online, yours: the chassis's youResult.)
    h("div", { className: "lab-over", role: "status" }, game.status === "finished" && game.winner ? (game.youResult ? inWords(game.youResult === "win" ? "You win" : "You lose") : inWords("{side} wins", { side: SIDE[game.winner] })) : "", game.winReason ? h("div", { className: "lab-label", style: { marginTop: 6 } }, game.winReason) : null,
      // (Whom they beat, the AI's level: the chassis's winFoeNote.)
      game.winFoeNote ? h("div", { className: "lab-label", style: { marginTop: 4, opacity: 0.8 } }, game.winFoeNote) : null)
  );
}
