/* The menu lab (user, 2026-10-27, after the phone dock menu's mock-ups:
   "create a testing lab for this, because we really need to actually see
   real life functional versions of these to see how they work. I'm
   thinking fly out menus. I like the circle around the piece, like the
   wedges, also maybe just the, I don't know, I mean, yeah, fly out is
   maybe the key here, or also the one with the horizontal list of rounded
   buttons on a transparent backdrop, but still seems we need to go for a
   less is more sort of thing here. Create 10 versions fully functional in
   a lab outside of the chat").

   With ?menulab, a tap on the dock's piece before a game flies one of ten
   menus out round it, in place of the panel. Every one works: its buttons
   press the panel's own (always on the page, if out of sight), so Try a
   Game begins the game, a level is chosen, the catalog opens and the cart
   fills just as from the panel; More opens the panel itself, where all
   the rest still is. A bar at the top picks the version (‹ ›, or the
   list) and leaves the lab.

   Then (user: "I want 4 Fan, but I want to be able to spin / rotate the
   menu to access all settings, ultimately, fully replacing the button
   dock"): five revisions of the Fan, 4.1 to 4.5 (menu-fan.js), each
   holding all of the dock, and these open from the piece in play and
   after a game too, the corner piece brought out to them.

   ?menulab turns it on for the tab (the chassis's menuLabWanted keeps it
   on from page to page there), ?menulab=4.2 starts on that version,
   ?menulab=0 turns it off; the version last looked at is kept in this
   browser. Loaded only when asked for. Plain DOM over the game, as the
   fps readout is (fps-readout.js). */
import { t } from "./i18n.js";
import { FAN_VERSIONS, fanMenu, dress } from "./menu-fan.js";

const ON_KEY = "el-cabeza:menu-lab";
const PICK_KEY = "el-cabeza:menu-lab-version";

/* ------------------------------------------------------------ geometry */

const rad = (d) => (d * Math.PI) / 180;
// Screen angles: 0 to the right, -90 straight up, clockwise as they grow.
const polar = (c, r, a) => ({ x: c.x + r * Math.cos(rad(a)), y: c.y + r * Math.sin(rad(a)) });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10) / 10;
// A slice of a ring, a0 to a1 degrees.
function sector(c, r0, r1, a0, a1) {
  const A = polar(c, r1, a0), B = polar(c, r1, a1), C = polar(c, r0, a1), D = polar(c, r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${round(A.x)} ${round(A.y)}A${r1} ${r1} 0 ${big} 1 ${round(B.x)} ${round(B.y)}L${round(C.x)} ${round(C.y)}A${r0} ${r0} 0 ${big} 0 ${round(D.x)} ${round(D.y)}Z`;
}

/* --------------------------------------------------------------- icons */

const ICONS = {
  play: '<path d="M8 5.2v13.6L18.6 12z" fill="currentColor" stroke="none"/>',
  pieces: '<path d="M12 3.2l7.6 4.3v9L12 20.8l-7.6-4.3v-9z"/><path d="M4.4 7.5L12 11.8l7.6-4.3M12 11.8v9"/>',
  cart: '<path d="M2.8 4.5h2.4l2.2 10.3h10.1l2-7.4H6.3"/><circle cx="9.2" cy="18.6" r="1.4"/><circle cx="16.4" cy="18.6" r="1.4"/>',
  more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  human: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-4.1 3.8-6.3 7.2-6.3s6.3 2.2 7.2 6.3"/>',
  computer: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.8"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  start: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M4 12h16M12 4v16"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  spark: '<path d="M12 3.5v4.5M12 16v4.5M3.5 12H8M16 12h4.5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
};
// The level as three bars, as many filled as it's hard.
const levelBars = (n) => [[4.5, 13.5, 6], [10, 9.5, 10], [15.5, 5.5, 14]]
  .map(([x, y, h], i) => `<rect x="${x}" y="${y}" width="4" height="${h}" rx="1"${i < n ? ' fill="currentColor"' : ""}/>`).join("");
const iconOf = (it) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
  it.icon === "level" ? levelBars(it.level || 1) : ICONS[it.icon] || ICONS.spark}</svg>`;

/* ------------------------------------------------------ the panel, read */

/* What the panel offers right now, each with the button it presses:
   play (Begin Game, or the world's own: the store's Try a Game), level
   (Easy, Medium, Hard; or, with no computer picked, who to play),
   pieces (the store's See the pieces or Custom rules; a world's other
   buttons beside Begin come after it), cart (the store's), start
   (Standard or Manual), more (the panel). A button the panel holds back
   (a new player's first look, the computer thinking) is held back here. */
function readMenu(host) {
  const panel = host.panel();
  if (!panel) return [];
  const one = (sel) => panel.querySelector(sel);
  const all = (sel) => Array.from(panel.querySelectorAll(sel));
  const words = (b) => (b ? b.textContent.replace(/\s+/g, " ").trim() : "");
  const off = (b) => !b || b.disabled || b.getAttribute("aria-disabled") === "true" || !!b.closest("[data-first-lock]");
  const items = [];

  const begin = one('[data-dock-role="begin"]');
  if (begin) items.push({ key: "play", label: words(begin), icon: "play", primary: true, disabled: off(begin), press: () => begin.click() });

  const diffs = all("[data-ec-diff]");
  if (diffs.length) {
    const at = Math.max(0, diffs.findIndex((b) => b.getAttribute("aria-pressed") === "true"));
    items.push({
      key: "level", label: words(diffs[at]), icon: "level", level: at + 1, disabled: diffs.every(off),
      choices: diffs.map((b, i) => ({ key: b.getAttribute("data-ec-diff"), label: words(b), on: i === at, disabled: off(b), pick: () => b.click() })),
    });
  } else {
    // (Online has a panel of its own: the panel's, through More.)
    const who = all("[data-opponent]").filter((b) => b.getAttribute("data-opponent") !== "online");
    if (who.length) {
      const name = (b) => {
        const k = b.getAttribute("data-opponent");
        return k === "human" ? words(b) : `${words(b)} · ${t(host.sideName(k === "ai-dark" ? "dark" : "light"))}`;
      };
      const at = Math.max(0, who.findIndex((b) => b.getAttribute("aria-pressed") === "true"));
      items.push({
        key: "level", label: name(who[at]), icon: who[at].getAttribute("data-opponent") === "human" ? "human" : "computer", disabled: who.every(off),
        choices: who.map((b, i) => ({ key: b.getAttribute("data-opponent"), label: name(b), on: i === at, disabled: off(b), pick: () => b.click() })),
      });
    }
  }

  const beside = begin && begin.parentElement ? Array.from(begin.parentElement.children).filter((b) => b !== begin && b.tagName === "BUTTON") : [];
  const nova = one('[data-testid="nova-again-setup"]');
  if (nova) beside.push(nova);
  beside.forEach((b, i) => items.push({
    key: i ? `extra${i}` : "pieces", label: words(b), disabled: off(b), press: () => b.click(),
    icon: b.getAttribute("data-testid") === "tienda-order-form" ? "pieces" : "spark",
  }));

  const buy = one('[data-testid="story-purchase"], [data-testid="story-go-home-confused"]');
  if (buy) {
    const label = words(buy), [what, price] = label.split(" · ");
    const empty = buy.getAttribute("data-cart") === "empty";
    // (Into the cart, the menu stays: the button turns to Check out.)
    items.push({ key: "cart", label, short: empty ? price || what : what, icon: "cart", disabled: off(buy), keepOpen: empty, press: () => buy.click() });
  }

  const std = one('[data-testid="start-standard"]'), hand = one('[data-testid="start-by-hand"]');
  if (std && hand) {
    const on = hand.getAttribute("aria-pressed") === "true" ? hand : std;
    const head = words(std.parentElement && std.parentElement.querySelector("span")) || t("Start");
    items.push({
      key: "start", label: `${head} · ${words(on)}`, short: words(on), icon: "start", disabled: off(std), secondary: true,
      choices: [std, hand].map((b) => ({ key: b.getAttribute("data-testid"), label: words(b), on: b === on, disabled: off(b), pick: () => b.click() })),
    });
  }

  items.push({ key: "more", label: t("More"), icon: "more", press: () => host.openPanel() });
  return items;
}

// The items a version shows, in its order: those this world has (a world's
// own buttons beside Begin with "pieces").
function pick(items, order) {
  const out = [];
  for (const k of order) {
    if (k === "pieces") out.push(...items.filter((i) => i.key === "pieces" || i.key.startsWith("extra")));
    else { const it = items.find((i) => i.key === k); if (it) out.push(it); }
  }
  return out;
}
const shortOf = (it) => it.short || it.label;

/* ------------------------------------------------------------ versions */

// Where the piece goes while the menu's out: up to the middle (the full
// circles), or into the corner (Thumb). x, y in px from where it rests.
const lifted = (vw, vh, r) => ({ x: 0, y: Math.min(0, Math.round(Math.max(vh * 0.44, 190) - r.y)), scale: 1 });

const VERSIONS = [
  {
    id: "ring", name: "Ring", place: lifted,
    about: "The piece rises; its buttons fly out to a circle round it.",
    build(m) {
      const list = pick(m.items, ["play", "level", "cart", "more", "pieces"]);
      const R = Math.min(128, m.vw / 2 - 46, m.vh / 2 - 64);
      m.dim("pool", { clear: R - 46, dark: R + 120 });
      m.ring(R);
      list.forEach((it, i) => {
        const p = polar(m.center, R, -90 + (i * 360) / list.length);
        m.disc(it, p.x, p.y, { size: it.primary ? 70 : 56, delay: 50 + i * 45 });
      });
    },
  },
  {
    id: "crown", name: "Crown",
    about: "Round buttons fly out in a close arc over the piece, each named.",
    build(m) {
      const list = pick(m.items, ["pieces", "level", "play", "cart", "more"]);
      m.dim("soft");
      const n = list.length, R = 124;
      list.forEach((it, i) => {
        const p = polar(m.center, R, n > 1 ? -165 + (i * 150) / (n - 1) : -90);
        m.disc(it, p.x, p.y, { size: it.primary ? 62 : 50, delay: Math.abs(i - (n - 1) / 2) * 50 });
      });
    },
  },
  {
    id: "wedges", name: "Wedges", place: lifted,
    about: "The piece rises in a ring of wedges. Tap a wedge.",
    build(m) {
      const list = pick(m.items, ["play", "level", "cart", "more", "pieces"]);
      const r1 = Math.min(152, m.vw / 2 - 10, m.vh / 2 - 28), r0 = Math.round(r1 * 0.47);
      m.dim("pool", { clear: r1 - 12, dark: r1 + 110 });
      const big = list.length > 1 ? 100 : 360, rest = (360 - big) / Math.max(1, list.length - 1);
      let a = -90 - big / 2;
      const spans = list.map((it) => { const s = it.primary ? big : rest, span = [a, a + s]; a += s; return span; });
      m.wedges(list, spans, r0, r1, { gap: 2.4, unfold: "spin" });
    },
  },
  {
    id: "fan", name: "Fan",
    about: "Wedges open over the piece like a fan.",
    build(m) {
      const list = pick(m.items, ["pieces", "level", "play", "cart", "more"]);
      const r1 = Math.min(176, m.vw / 2 - 6), r0 = Math.round(r1 * 0.53);
      m.dim("soft", { reach: r1 + 140 });
      const big = list.length > 1 ? 46 : 180, rest = (180 - big) / Math.max(1, list.length - 1);
      let a = -180;
      const spans = list.map((it) => { const s = it.primary ? big : rest, span = [a, a + s]; a += s; return span; });
      m.wedges(list, spans, r0, r1, { gap: 1.6, unfold: "fan" });
    },
  },
  {
    id: "dial", name: "Speed dial",
    about: "Rounded buttons rise in a column over the piece; the room shows through.",
    build(m) {
      const list = pick(m.items, ["play", "level", "pieces", "cart", "more"]);
      m.dim("rise");
      let bottom = m.center.y - 84;
      const nodes = list.map((it, i) => {
        const h = it.primary ? 52 : 44, y = bottom - h / 2;
        bottom = y - h / 2 - 10;
        return m.pill(it, m.center.x, y, { h, delay: i * 45, wide: true });
      });
      m.sameWidth(nodes, 220);
    },
  },
  {
    id: "row", name: "Pill row",
    about: "One row of small rounded buttons, the game's own above them, on a clear backdrop.",
    build(m) {
      const play = m.items.find((i) => i.key === "play");
      m.dim("rise");
      const box = m.row(pick(m.items, ["level", "pieces", "cart", "more"]), { bottom: m.center.y - 84 });
      if (play) m.pill(play, m.center.x, box.top - 14 - 26, { h: 52, delay: 0 });
    },
  },
  {
    id: "pillarc", name: "Pill arc",
    about: "Named rounded buttons fly out along an arc over the piece.",
    build(m) {
      const list = pick(m.items, ["pieces", "level", "play", "cart", "more"]);
      m.dim("soft", { reach: 460 });
      const n = list.length;
      const nodes = list.map((it, i) => m.pill(it, m.center.x, m.center.y, { h: it.primary ? 48 : 40, compact: !it.primary, delay: Math.abs(i - (n - 1) / 2) * 55 }));
      // On an arc, opened out till no two touch, nor the piece.
      const keep = { x: m.center.x, y: m.center.y, w: 104, h: 170 };
      let rx = Math.min(m.vw / 2 - 40, 190), ry = 150;
      for (let tries = 0; ; tries++) {
        const boxes = nodes.map((nd, i) => {
          const a = n > 1 ? -160 + (i * 140) / (n - 1) : -90;
          const w = nd.offsetWidth, h = nd.offsetHeight;
          return { x: clamp(m.center.x + rx * Math.cos(rad(a)), w / 2 + 8, m.vw - w / 2 - 8), y: m.center.y + ry * Math.sin(rad(a)), w, h };
        });
        const hit = (b, o) => Math.abs(b.x - o.x) < (b.w + o.w) / 2 + 6 && Math.abs(b.y - o.y) < (b.h + o.h) / 2 + 6;
        const clash = boxes.some((b, i) => hit(b, keep) || boxes.some((o, j) => j > i && hit(b, o)));
        if (!clash || tries > 20) { boxes.forEach((b, i) => m.move(nodes[i], b.x, b.y)); break; }
        ry += 12;
      }
    },
  },
  {
    id: "three", name: "Just three",
    about: "Less is more: the level (a tap changes it), the game, and More.",
    build(m) {
      const c = m.center, find = (k) => m.items.find((i) => i.key === k);
      m.dim("soft");
      if (find("play")) m.disc(find("play"), c.x, c.y - 140, { size: 82, name: "inside", delay: 0 });
      if (find("level")) m.disc(find("level"), c.x - 100, c.y - 96, { size: 58, delay: 60, mode: "cycle" });
      m.disc(find("more"), c.x + 100, c.y - 96, { size: 58, delay: 100 });
    },
  },
  {
    id: "steps", name: "Two steps",
    about: "Three to start; the level and More each fly out their own.",
    build(m) {
      const c = m.center, find = (k) => m.items.find((i) => i.key === k);
      m.dim("soft");
      if (find("play")) m.disc(find("play"), c.x, c.y - 140, { size: 82, name: "inside", delay: 0 });
      if (find("level")) m.disc(find("level"), c.x - 100, c.y - 96, { size: 58, delay: 60 });
      m.disc(find("more"), c.x + 100, c.y - 96, { size: 58, delay: 100, mode: "sub", sub: ["pieces", "cart", "start", "all"] });
    },
  },
  {
    id: "thumb", name: "Thumb",
    place: (vw, vh, r) => ({ x: Math.round(vw - 64 - r.x), y: Math.round(vh - 76 - r.y), scale: 0.74 }),
    about: "The piece slides into the corner; its buttons curve up under your thumb.",
    build(m) {
      const list = pick(m.items, ["play", "level", "pieces", "cart", "more"]);
      const c = m.center, R = 420;
      m.dim("corner");
      let bottom = c.y - 60;
      list.forEach((it, i) => {
        const h = it.primary ? 50 : 42, y = bottom - h / 2;
        bottom = y - h / 2 - 10;
        // (the right ends on a wide circle round the piece)
        const dy = c.y - y, right = Math.min(c.x + 30 - (R - Math.sqrt(Math.max(0, R * R - dy * dy))), m.vw - 10);
        const nd = m.pill(it, c.x, y, { h, delay: i * 45, compact: !it.primary });
        m.move(nd, Math.max(right - nd.offsetWidth / 2, nd.offsetWidth / 2 + 8), y);
      });
    },
  },
];
// Numbered as first shown, 1 to 10; the Fan's revisions after it, 4.1 to 4.5.
VERSIONS.forEach((v, i) => { v.n = String(i + 1); });
VERSIONS.splice(4, 0, ...FAN_VERSIONS);

/* ---------------------------------------------------------------- style */

const CSS = `
.ml-fly{position:fixed;left:var(--x);top:var(--y);transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(.2);opacity:0;transition:transform .46s cubic-bezier(.34,1.56,.64,1) var(--d,0ms),opacity .2s ease var(--d,0ms)}
.ml-on .ml-fly{transform:translate(-50%,-50%) translate(0px,0px) scale(1);opacity:1}
.ml-ffly{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0;transition:transform .46s cubic-bezier(.34,1.56,.64,1) var(--d,0ms),opacity .2s ease var(--d,0ms)}
.ml-on .ml-ffly{transform:translate(0px,0px) scale(1);opacity:1}
.ml-on .ml-sub .ml-fly{transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(.2);opacity:0}
.ml-on .ml-sub.ml-shown .ml-fly{transform:translate(-50%,-50%) translate(0px,0px) scale(1);opacity:1}
.ml-on .ml-sub.ml-shown .ml-item[aria-disabled="true"]{opacity:.4}
.ml-layer.ml-deep>.ml-item:not(.ml-owner){opacity:.35}
.ml-off .ml-fly,.ml-off .ml-ffly,.ml-off .ml-wedge,.ml-off .ml-ringline{transition-duration:.2s,.16s;transition-delay:0s,0s;transition-timing-function:cubic-bezier(.5,0,.75,0),ease}
.ml-still .ml-fly,.ml-still .ml-ffly,.ml-still .ml-wedge,.ml-still .ml-ringline{transition:none!important}
.ml-disc{width:var(--s);height:var(--s);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:color-mix(in srgb,var(--ml-paper) 94%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ml-line) 85%,transparent),0 8px 22px rgba(0,0,0,.3)}
.ml-disc>.ml-ico{width:calc(var(--s)*.42);height:calc(var(--s)*.42)}
.ml-disc.ml-inside>.ml-ico{width:calc(var(--s)*.32);height:calc(var(--s)*.32)}
.ml-name{position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(calc(-50% + var(--nx,0px)));white-space:nowrap;font-size:10px;line-height:1;letter-spacing:.1em;text-transform:var(--ml-case);padding:4px 8px;border-radius:999px;background:color-mix(in srgb,var(--ml-paper) 90%,transparent);color:var(--ml-ink);box-shadow:0 2px 10px rgba(0,0,0,.22);text-shadow:none}
.ml-inside>.ml-name{position:static;transform:none;padding:0;background:none;box-shadow:none;font-size:9px;letter-spacing:.08em;color:inherit;text-shadow:inherit;max-width:86%;white-space:normal;text-align:center;line-height:1.1}
.ml-pill{height:var(--h,44px);border-radius:999px;display:inline-flex;align-items:center;gap:9px;padding:0 16px 0 6px;white-space:nowrap;font-size:11px;letter-spacing:.1em;text-transform:var(--ml-case);background:color-mix(in srgb,var(--ml-paper) 92%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ml-line) 80%,transparent),0 8px 22px rgba(0,0,0,.26)}
.ml-pill>.ml-ico{flex:none;width:calc(var(--h,44px) - 12px);height:calc(var(--h,44px) - 12px);border-radius:50%;background:color-mix(in srgb,var(--ml-ink) 9%,transparent)}
.ml-pill>.ml-ico svg{width:58%;height:58%}
.ml-pill.ml-primary>.ml-ico{background:rgba(0,0,0,.2)}
.ml-pill .ml-word{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:center}
.ml-pill.ml-compact{font-size:10px;letter-spacing:.07em;padding:0 13px 0 5px;gap:7px}
.ml-pill.ml-icononly{padding:0;width:var(--h,44px);justify-content:center}
.ml-pill.ml-icononly>.ml-ico{background:none}
.ml-pill.ml-bare{padding:0 14px}
.ml-caret{font-size:.85em;margin-left:-4px;opacity:.65}
.ml-ringline{position:fixed;left:var(--x);top:var(--y);width:var(--s);height:var(--s);box-sizing:border-box;border-radius:50%;border:1.5px dashed color-mix(in srgb,var(--ml-paper) 72%,transparent);transform:translate(-50%,-50%) scale(.3) rotate(-60deg);opacity:0;transition:transform .6s cubic-bezier(.22,1,.36,1) .08s,opacity .3s ease .08s}
.ml-on .ml-ringline{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}
.ml-wedges{position:fixed;left:0;top:0;overflow:visible;pointer-events:none}
.ml-wedge{pointer-events:auto;cursor:pointer;outline:none;transform-box:view-box;transform-origin:var(--ox) var(--oy);transform:rotate(var(--r0)) scale(.45);opacity:0;transition:transform .5s cubic-bezier(.34,1.32,.64,1) var(--d,0ms),opacity .22s ease var(--d,0ms)}
.ml-on .ml-wedge{transform:rotate(0deg) scale(1);opacity:1}
.ml-on .ml-wedge[aria-disabled="true"]{opacity:.45;cursor:default}
.ml-wedge path{fill:color-mix(in srgb,var(--ml-paper) 93%,transparent);stroke:color-mix(in srgb,var(--ml-line) 90%,transparent);stroke-width:1}
.ml-wedge.ml-primary path{fill:var(--ml-pbg,var(--ml-ink))}
.ml-wedge:focus-visible path{stroke:var(--ml-ink);stroke-width:2.5}
.ml-wedges-shadow{filter:drop-shadow(0 6px 14px rgba(0,0,0,.28))}
.ml-wlabel{display:flex;flex-direction:column;align-items:center;gap:3px;width:var(--w,78px);text-align:center;font-size:9.5px;line-height:1.15;letter-spacing:.08em;text-transform:var(--ml-case);color:var(--ml-ink);pointer-events:none}
.ml-wlabel>.ml-ico{width:20px;height:20px}
.ml-wlabel.ml-primary-ink{color:var(--ml-pink,var(--ml-paper));text-shadow:var(--ml-pshadow,none)}
.ml-on .ml-wlabel.ml-held{opacity:.45}
.ml-choices{position:fixed;display:flex;gap:4px;padding:4px;border-radius:999px;background:color-mix(in srgb,var(--ml-paper) 90%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ml-line) 80%,transparent),0 10px 26px rgba(0,0,0,.3);transform:scale(.4);opacity:0;transition:transform .34s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;pointer-events:auto}
.ml-choices.ml-shown{transform:scale(1);opacity:1}
.ml-choice{height:36px;min-width:44px;padding:0 13px;border-radius:999px;font-size:10.5px;letter-spacing:.08em;text-transform:var(--ml-case);background:transparent;white-space:nowrap}
.ml-choice[aria-pressed="true"]{background:var(--ml-ink);color:var(--ml-paper)}
.ml-choice[aria-disabled="true"]{opacity:.4;cursor:default}
.ml-pop{animation:mlPop .32s ease}
@keyframes mlPop{40%{scale:1.13}}
@media (prefers-reduced-motion: reduce){
.ml-fly,.ml-on .ml-sub .ml-fly{transform:translate(-50%,-50%)!important;transition:opacity .2s ease!important}
.ml-ffly,.ml-wedge{transform:none!important;transition:opacity .2s ease!important}
.ml-ringline{transform:translate(-50%,-50%)!important}
.ml-choices{transform:none!important}
}
.ml-bar{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;align-items:center;gap:4px;width:max-content;max-width:calc(100vw - 16px);pointer-events:none;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f6efe2}
.ml-bar-row{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgba(26,20,14,.86);box-shadow:0 4px 18px rgba(0,0,0,.3);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ml-bar-tag{padding:0 6px 0 10px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.72;white-space:nowrap}
.ml-bar-btn{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;width:32px;height:32px;border-radius:50%;font:inherit;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.ml-bar-btn:hover{background:rgba(255,255,255,.1)}
.ml-bar-exit{font-size:13px;opacity:.75}
.ml-bar-pick{appearance:none;-webkit-appearance:none;border:0;border-radius:999px;background:rgba(255,255,255,.13);color:inherit;font:inherit;font-weight:600;padding:7px 12px;cursor:pointer;max-width:46vw}
.ml-bar-pick option{color:#1a140e;background:#f6efe2}
.ml-bar-btn:focus-visible,.ml-bar-pick:focus-visible{outline:2px solid #f6efe2;outline-offset:1px}
body.ml-lab [data-testid="toggle-hint"]{display:none!important}
.ml-bar-about{max-width:340px;padding:4px 10px;border-radius:8px;background:rgba(26,20,14,.66);font-size:11.5px;line-height:1.35;text-align:center;text-wrap:balance}
`;

function addStyle() {
  if (document.getElementById("ml-style")) return;
  const s = document.createElement("style");
  s.id = "ml-style";
  s.textContent = CSS;
  document.head.append(s);
}

/* -------------------------------------------------------------- the dom */

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "className") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...kids.filter((k) => k != null));
  return e;
}
function svgEl(tag, props = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(props)) if (v != null) e.setAttribute(k, v);
  return e;
}
// Where a thing flies to (its middle), and from.
function flyVars(node, x, y, from, delay) {
  node.style.setProperty("--x", `${x}px`);
  node.style.setProperty("--y", `${y}px`);
  node.style.setProperty("--dx", `${from.x - x}px`);
  node.style.setProperty("--dy", `${from.y - y}px`);
  node.style.setProperty("--d", `${Math.round(delay)}ms`);
}
const held = (node, off) => (off ? node.setAttribute("aria-disabled", "true") : node.removeAttribute("aria-disabled"));
const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
// After React has drawn what a press changed.
const later = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
function flash(node, cls, ms) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

// The version asked for (?menulab=4.2), else the last looked at, else 4.1.
function loadPick() {
  const find = (n) => VERSIONS.findIndex((v) => v.n === n);
  let i = -1;
  try {
    const q = new URLSearchParams(window.location.search).get("menulab");
    if (q) i = find(q);
    if (i < 0) i = find(window.localStorage.getItem(PICK_KEY) || "");
  } catch (e) { /* storage blocked */ }
  return i >= 0 ? i : find("4.1");
}

/* ------------------------------------------------------------- the lab */

/* host: panel() the dock's panel, piece() the piece's box, openPanel(),
   shift(s) to move the piece ({ x, y, scale }, centre: from its corner to
   where it waits before a game, raise: up in its corner; or null back),
   home() (that waiting place's middle), sideName(side), ai() (the side the
   computer plays, or null), online(), markSeen() (the corner piece's call
   after a game answered), colors { paper, ink, line } (the panel's),
   sounds { open, close }. Gives back toggle() (true if it took the tap),
   update({ ready, shell, phase }) (ready: the piece showing, nothing
   else up; phase: "setup", "play" or "over"), close(), isOpen(), dispose(). */
export function installMenuLab(host) {
  addStyle();
  document.body.classList.add("ml-lab");
  let at = loadPick();
  let ready = false, shell = false, phase = "setup";
  let menu = null;
  let seq = 0, size = null, relayout = 0;
  // (The fans, 4.1 to 4.5: the dock's own controller, on the lab's layer.)
  const fans = fanMenu({ ...host, onOpen: () => say() }, { testid: "menu-lab" });
  const setShift = (s) => fans.setShift(s);
  const restAt = () => fans.restAt();
  const bar = makeBar();
  say();

  function makeBar() {
    const button = (text, label, id, fn, cls = "") => {
      const b = el("button", { type: "button", className: `ml-bar-btn ${cls}`, "aria-label": label, title: label, "data-testid": id }, text);
      b.addEventListener("click", fn);
      return b;
    };
    const pickEl = el("select", { className: "ml-bar-pick", "aria-label": "Menu version", "data-testid": "menu-lab-pick" },
      ...VERSIONS.map((v, i) => el("option", { value: String(i) }, `${v.n} · ${v.name}`)));
    pickEl.value = String(at);
    pickEl.addEventListener("change", () => choose(+pickEl.value));
    const about = el("div", { className: "ml-bar-about", "data-testid": "menu-lab-about" });
    const node = el("div", { className: "ml-bar", "data-testid": "menu-lab-bar" },
      el("div", { className: "ml-bar-row" },
        el("span", { className: "ml-bar-tag" }, "Menu lab"),
        button("‹", "Previous version", "menu-lab-prev", () => choose(at - 1)),
        pickEl,
        button("›", "Next version", "menu-lab-next", () => choose(at + 1)),
        button("✕", "Leave the menu lab", "menu-lab-exit", leave, "ml-bar-exit")),
      about);
    document.body.append(node);
    return { node, pick: pickEl, about };
  }

  function say() {
    const v = VERSIONS[at];
    const now = shell ? "It needs the floating piece: switch from the control bar to the dock."
      : menu || fans.isOpen() ? "Tap outside to close."
      : v.fan ? (phase === "setup" ? "Tap the piece. (In a game too: the corner piece.)" : "Tap the corner piece.")
      : phase !== "setup" || !ready ? "Before a game, tap the piece." : "Tap the piece.";
    bar.about.textContent = `${v.about} ${now}`;
  }

  function choose(i) {
    at = (i + VERSIONS.length) % VERSIONS.length;
    try { window.localStorage.setItem(PICK_KEY, VERSIONS[at].n); } catch (e) { /* this visit only */ }
    bar.pick.value = String(at);
    // An open menu becomes the new version at once, to compare (a version
    // that's only for before a game doesn't open in one).
    if (menu || fans.isOpen()) { close({ now: true }); if (VERSIONS[at].fan) fans.open(VERSIONS[at]); else if (phase === "setup") open(); else say(); } else say();
  }

  function leave() {
    try { window.sessionStorage.removeItem(ON_KEY); } catch (e) { /* none */ }
    const u = new URL(window.location.href);
    u.searchParams.delete("menulab");
    window.location.replace(u.toString());
  }

  function sound(which) {
    try { if (host.sounds && host.sounds[which]) host.sounds[which](); } catch (e) { /* audio not started */ }
  }

  function open({ still = false } = {}) {
    const items = readMenu(host);
    if (!items.length) return false;
    const v = VERSIONS[at];
    const vw = window.innerWidth, vh = window.innerHeight;
    size = { vw, vh };
    const r = restAt();
    const s = v.place ? v.place(vw, vh, r) : null;
    setShift(s);
    const center = s ? { x: r.x + s.x, y: r.y + s.y } : r;
    const layer = el("div", { className: `ml-layer ml-v-${v.id}`, "data-testid": "menu-lab", "data-version": v.n, "data-open": "true" });
    const back = el("div", { className: "ml-back", "data-testid": "menu-lab-back" });
    dress(layer, host);
    back.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    document.body.append(back, layer);
    menu = { layer, back, items, keys: items.map((i) => i.key).join(), nodes: new Map(), choices: null, sub: null, center };
    // (A piece on its way up: its buttons wait for it a little.)
    v.build(builder(menu, center, vw, vh, s && !still ? 170 : 0));
    if (still || reduced()) layer.classList.add("ml-still");
    void layer.offsetWidth;
    const m = menu;
    requestAnimationFrame(() => { if (menu === m) { layer.classList.add("ml-on"); back.classList.add("ml-on"); } });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    if (!still) sound("open");
    say();
    return true;
  }

  function close({ now = false } = {}) {
    if (fans.isOpen()) fans.close({ now });
    const m = menu;
    if (!m) return;
    menu = null;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    setShift(null);
    m.layer.setAttribute("data-open", "false");
    if (now || reduced()) { m.layer.remove(); m.back.remove(); }
    else {
      m.layer.classList.remove("ml-on");
      m.layer.classList.add("ml-off");
      m.back.classList.remove("ml-on");
      setTimeout(() => { m.layer.remove(); m.back.remove(); }, 260);
    }
    if (!now) sound("close");
    say();
  }

  function onKey(e) {
    if (!menu) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (menu.choices) closeChoices();
    else if (menu.sub) closeSub();
    else close();
  }
  /* The page resized under an open menu (on a phone, the first tap's
     full screen): laid out again where it is. The piece rests centred,
     its foot on the bottom, so where it rests moves with the page. */
  function onResize() {
    cancelAnimationFrame(relayout);
    relayout = requestAnimationFrame(() => {
      if (!menu || !size) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      fans.moveRest((vw - size.vw) / 2, vh - size.vh);
      close({ now: true });
      open({ still: true });
    });
  }

  // The panel read again after a press: names and states brought up to
  // date; a menu that's changed (a computer picked: now its levels) laid
  // out again where it is.
  function refresh() {
    if (!menu) return;
    const items = readMenu(host);
    if (items.map((i) => i.key).join() !== menu.keys) { close({ now: true }); open({ still: true }); return; }
    menu.items = items;
    for (const it of items) {
      const rec = menu.nodes.get(it.key);
      if (rec) { rec.it = it; rec.set(it); }
    }
  }

  /* A tap on one of the menu's buttons. */
  function act(rec) {
    const it = rec.it;
    if (it.disabled) { flash(rec.node, "ml-nudge", 380); return; }
    if (rec.mode === "cycle" && it.choices) { cycle(rec); return; }
    if (rec.mode === "sub") { toggleSub(rec); return; }
    if (it.choices) { toggleChoices(rec); return; }
    if (it.keepOpen) { closeChoices(); it.press(); flash(rec.node, "ml-pop", 340); later(refresh); return; }
    close();
    it.press();
  }

  // The next level along (Just three).
  function cycle(rec) {
    const ch = rec.it.choices, i = ch.findIndex((c) => c.on);
    for (let k = 1; k <= ch.length; k++) {
      const c = ch[(i + k) % ch.length];
      if (!c.disabled) { c.pick(); break; }
    }
    flash(rec.node, "ml-pop", 340);
    later(refresh);
  }

  // A button's own choices (the level, who to play, the start), out over it.
  function toggleChoices(rec) {
    const was = menu.choices && menu.choices.rec;
    closeChoices();
    if (was === rec) return;
    const box = el("div", { className: "ml-choices", role: "group", "aria-label": rec.it.label, "data-testid": "menu-lab-choices" });
    for (const ch of rec.it.choices) {
      const b = el("button", { type: "button", className: "ml-item ml-choice", "data-ml-choice": ch.key, "aria-pressed": ch.on ? "true" : "false" }, ch.label);
      held(b, ch.disabled);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (ch.disabled) { flash(b, "ml-nudge", 380); return; }
        ch.pick();
        box.querySelectorAll(".ml-choice").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
        later(() => { refresh(); setTimeout(closeChoices, 180); });
      });
      box.append(b);
    }
    menu.layer.append(box);
    const a = rec.anchor, vw = window.innerWidth, w = box.offsetWidth, h = box.offsetHeight;
    const left = clamp(a.x - w / 2, 8, vw - w - 8), above = a.top - 12 - h > 8;
    box.style.left = `${left}px`;
    box.style.top = `${above ? a.top - 12 - h : a.bottom + 12}px`;
    box.style.transformOrigin = `${a.x - left}px ${above ? "100%" : "0%"}`;
    requestAnimationFrame(() => box.classList.add("ml-shown"));
    menu.choices = { rec, box };
  }
  function closeChoices() {
    if (!menu || !menu.choices) return;
    const { box } = menu.choices;
    menu.choices = null;
    box.classList.remove("ml-shown");
    setTimeout(() => box.remove(), 220);
  }

  // Two steps: More's own, flown out of it in a column.
  function toggleSub(rec) {
    closeChoices();
    if (menu.sub) { closeSub(); return; }
    const list = rec.sub.map((k) => (k === "all" ? { key: "all", label: "All settings", icon: "settings", press: () => host.openPanel() } : pick(menu.items, [k]))).flat();
    const box = el("div", { className: "ml-sub" });
    menu.layer.append(box);
    const vw = window.innerWidth, a = rec.anchor;
    const from = { x: a.x, y: (a.top + a.bottom) / 2 };
    let bottom = a.top - 14;
    const nodes = list.map((it, i) => {
      const h = 42, y = bottom - h / 2;
      bottom = y - h / 2 - 9;
      const node = pillNode(menu, it, { h, delay: i * 40, from, parent: box });
      flyVars(node, a.x, y, from, i * 40);
      return { node, y };
    });
    const w = Math.max(...nodes.map((n) => n.node.offsetWidth));
    nodes.forEach(({ node, y }) => {
      node.style.width = `${w}px`;
      const x = clamp(a.x, w / 2 + 8, vw - w / 2 - 8);
      flyVars(node, x, y, from, parseFloat(node.style.getPropertyValue("--d")));
      menu.nodes.get(node.getAttribute("data-ml-item")).anchor = { x, y, top: y - 21, bottom: y + 21 };
    });
    rec.node.classList.add("ml-owner");
    menu.layer.classList.add("ml-deep");
    requestAnimationFrame(() => box.classList.add("ml-shown"));
    menu.sub = { rec, box, keys: list.map((i) => i.key) };
  }
  function closeSub() {
    if (!menu || !menu.sub) return;
    const { rec, box, keys } = menu.sub;
    menu.sub = null;
    closeChoices();
    rec.node.classList.remove("ml-owner");
    menu.layer.classList.remove("ml-deep");
    box.classList.remove("ml-shown");
    for (const k of keys) menu.nodes.delete(k);
    setTimeout(() => box.remove(), 240);
  }

  /* -------- what the versions build with */

  function register(m, node, it, set, opts = {}) {
    const rec = { node, it, set, mode: opts.mode || null, sub: opts.sub || null, anchor: opts.anchor || null };
    m.nodes.set(it.key, rec);
    set(it);
    const go = (e) => { e.stopPropagation(); const r = menu && menu.nodes.get(it.key); if (r) act(r); };
    node.addEventListener("click", go);
    if (node.tagName.toLowerCase() === "g") node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
    return rec;
  }

  function pillNode(m, it, { h = 44, compact = false, wide = false, iconOnly = false, bare = false, flex = false, parent = null, mode = null } = {}) {
    const node = el("button", {
      type: "button", "data-ml-item": it.key,
      className: `ml-item ml-pill ${flex ? "ml-ffly" : "ml-fly"}${it.primary ? " ml-primary" : ""}${compact ? " ml-compact" : ""}${iconOnly ? " ml-icononly" : ""}${bare ? " ml-bare" : ""}${wide ? " ml-wide" : ""}`,
    });
    node.style.setProperty("--h", `${h}px`);
    const ico = el("span", { className: "ml-ico" }), word = iconOnly ? null : el("span", { className: "ml-word" });
    const caret = it.choices && mode !== "cycle" && !iconOnly ? el("span", { className: "ml-caret", "aria-hidden": "true" }, "▾") : null;
    node.append(...[bare ? null : ico, word, caret].filter(Boolean));
    (parent || m.layer).append(node);
    register(m, node, it, (f) => {
      if (!bare) ico.innerHTML = iconOf(f);
      if (word) word.textContent = compact ? shortOf(f) : f.label;
      node.setAttribute("aria-label", f.label);
      held(node, f.disabled);
    }, { mode });
    return node;
  }

  function builder(m, center, vw, vh, lead) {
    const b = { vw, vh, center, items: m.items };

    b.dim = (kind, o = {}) => {
      const at = `circle at ${round(center.x)}px ${round(center.y)}px`;
      m.back.style.background = kind === "pool"
        ? `radial-gradient(${at}, rgba(12,9,6,.1) 0, rgba(12,9,6,.1) ${o.clear}px, rgba(12,9,6,.56) ${o.dark}px)`
        : kind === "rise" ? "linear-gradient(to top, rgba(12,9,6,.52), rgba(12,9,6,.2) 48%, rgba(12,9,6,0) 78%)"
        : kind === "corner" ? `radial-gradient(${at}, rgba(12,9,6,.5) 0, rgba(12,9,6,.22) 380px, rgba(12,9,6,0) 600px)`
        : `radial-gradient(${at}, rgba(12,9,6,.34) 0, rgba(12,9,6,.18) ${(o.reach || 360) * 0.55}px, rgba(12,9,6,0) ${o.reach || 360}px)`;
    };

    // The line round the piece the Ring's buttons sit on.
    b.ring = (R) => {
      const line = el("div", { className: "ml-ringline", "aria-hidden": "true" });
      line.style.setProperty("--x", `${center.x}px`);
      line.style.setProperty("--y", `${center.y}px`);
      line.style.setProperty("--s", `${R * 2}px`);
      m.layer.append(line);
    };

    // A round button, named under it (or inside: name "inside").
    b.disc = (it, x, y, { size = 56, name = "below", delay = 0, mode = null, sub = null } = {}) => {
      if (!it) return null;
      const node = el("button", { type: "button", "data-ml-item": it.key, className: `ml-item ml-disc ml-fly${it.primary ? " ml-primary" : ""}${name === "inside" ? " ml-inside" : ""}` });
      node.style.setProperty("--s", `${size}px`);
      const ico = el("span", { className: "ml-ico" }), label = el("span", { className: "ml-name" });
      node.append(ico, label);
      m.layer.append(node);
      flyVars(node, x, y, center, lead + delay);
      const fit = () => {
        // (a name kept on the screen)
        if (name === "inside") return;
        const w = label.offsetWidth, l = x - w / 2, r = x + w / 2;
        label.style.setProperty("--nx", `${l < 6 ? 6 - l : r > vw - 6 ? vw - 6 - r : 0}px`);
      };
      register(m, node, it, (f) => {
        ico.innerHTML = iconOf(f);
        label.textContent = shortOf(f);
        node.setAttribute("aria-label", f.label);
        held(node, f.disabled);
        fit();
      }, { mode, sub, anchor: { x, y, top: y - size / 2, bottom: y + size / 2 } });
      return node;
    };

    // A rounded button with its icon and name, its middle at x, y.
    b.pill = (it, x, y, { h = 44, delay = 0, compact = false, wide = false } = {}) => {
      const node = pillNode(m, it, { h, compact, wide });
      flyVars(node, x, y, center, lead + delay);
      m.nodes.get(it.key).anchor = { x, y, top: y - h / 2, bottom: y + h / 2 };
      return node;
    };
    b.move = (node, x, y) => {
      flyVars(node, x, y, center, parseFloat(node.style.getPropertyValue("--d")) || 0);
      const h = node.offsetHeight;
      m.nodes.get(node.getAttribute("data-ml-item")).anchor = { x, y, top: y - h / 2, bottom: y + h / 2 };
    };
    b.sameWidth = (nodes, min) => {
      const w = Math.min(vw - 32, Math.max(min, ...nodes.map((n) => n.offsetWidth)));
      nodes.forEach((n) => { n.style.width = `${w}px`; });
    };

    // A row of small rounded buttons, centred, its foot at bottom (a
    // second row above it if they don't fit); gives back its box.
    b.row = (list, { bottom }) => {
      const box = el("div", { className: "ml-rowbox" });
      Object.assign(box.style, { position: "fixed", left: "8px", right: "8px", bottom: `${vh - bottom}px`, display: "flex", flexWrap: "wrap-reverse", justifyContent: "center", gap: "8px", pointerEvents: "none" });
      m.layer.append(box);
      const nodes = list.map((it) => pillNode(m, it, { h: 40, compact: true, flex: true, iconOnly: it.key === "more", bare: it.key !== "more" && it.key !== "cart", parent: box }));
      const r = box.getBoundingClientRect();
      nodes.forEach((n) => {
        const x = r.left + n.offsetLeft + n.offsetWidth / 2, y = r.top + n.offsetTop + n.offsetHeight / 2;
        n.style.setProperty("--dx", `${center.x - x}px`);
        n.style.setProperty("--dy", `${center.y - y}px`);
        n.style.setProperty("--d", `${Math.round(lead + 40 + Math.abs(x - center.x) * 0.45)}ms`);
        m.nodes.get(n.getAttribute("data-ml-item")).anchor = { x, y, top: y - 20, bottom: y + 20 };
      });
      return r;
    };

    // Wedges of a ring round the piece, each a button, named in its middle;
    // they spin open ("spin") or open out from straight up ("fan").
    b.wedges = (list, spans, r0, r1, { gap = 2, unfold = "spin" } = {}) => {
      const svg = svgEl("svg", { class: "ml-wedges", width: vw, height: vh, viewBox: `0 0 ${vw} ${vh}` });
      const g0 = svgEl("g", { class: "ml-wedges-shadow" });
      svg.append(g0);
      m.layer.append(svg);
      // (Try a Game's wedge in its wood, as the button is.)
      const img = m.layer.style.getPropertyValue("--ml-pimg");
      const url = img && (img.match(/url\(["']?(.*?)["']?\)/) || [])[1];
      const wood = url ? `ml-wood-${++seq}` : null;
      if (wood) {
        const defs = svgEl("defs"), pat = svgEl("pattern", { id: wood, patternUnits: "userSpaceOnUse", x: center.x - r1, y: center.y - r1, width: r1 * 2, height: r1 * 2 });
        pat.append(svgEl("image", { href: url, width: r1 * 2, height: r1 * 2, preserveAspectRatio: "xMidYMid slice" }));
        defs.append(pat);
        svg.prepend(defs);
      }
      list.forEach((it, i) => {
        const [a0, a1] = spans[i], mid = (a0 + a1) / 2;
        const delay = lead + (unfold === "fan" ? Math.abs(mid + 90) * 2.2 : i * 55);
        const g = svgEl("g", { class: `ml-wedge${it.primary ? " ml-primary" : ""}`, role: "button", tabindex: "0", "data-ml-item": it.key });
        g.style.setProperty("--ox", `${center.x}px`);
        g.style.setProperty("--oy", `${center.y}px`);
        g.style.setProperty("--r0", `${unfold === "fan" ? -90 - mid : -40}deg`);
        g.style.setProperty("--d", `${Math.round(delay)}ms`);
        const path = svgEl("path", { d: sector(center, r0, r1, a0 + gap / 2, a1 - gap / 2) });
        if (it.primary && wood) path.style.fill = `url(#${wood})`;
        g.append(path);
        g0.append(g);
        const p = polar(center, (r0 + r1) / 2, mid);
        const room = Math.min(r1 - r0 + 8, (rad(a1 - a0) * (r0 + r1)) / 2 - 8);
        const ico = el("span", { className: "ml-ico" }), word = el("span");
        const label = el("span", { className: `ml-wlabel ml-fly${it.primary ? " ml-primary-ink" : ""}`, "aria-hidden": "true", "data-ml-label": it.key }, ico, word);
        label.style.setProperty("--w", `${Math.round(clamp(room, 54, 120))}px`);
        flyVars(label, p.x, p.y, center, delay + 40);
        m.layer.append(label);
        register(m, g, it, (f) => {
          ico.innerHTML = iconOf(f);
          word.textContent = shortOf(f);
          g.setAttribute("aria-label", f.label);
          held(g, f.disabled);
          label.classList.toggle("ml-held", !!f.disabled);
        }, { anchor: { x: p.x, y: p.y, top: p.y - 24, bottom: p.y + 24 } });
      });
    };
    return b;
  }

  return {
    // A tap on the piece: the menu out, or away again. False when it's not
    // for the lab (in a game, setting out): the panel opens as ever.
    toggle() {
      if (menu || fans.isOpen()) { close(); return true; }
      if (!ready || shell) return false;
      const v = VERSIONS[at];
      if (v.fan) return fans.open(v);
      return phase === "setup" ? open() : false;
    },
    update(s) {
      ready = !!s.ready;
      shell = !!s.shell;
      const was = phase;
      phase = s.phase || "setup";
      fans.update(s);
      if (menu && (!ready || phase !== was)) close();
      say();
    },
    close: () => close(),
    isOpen: () => !!menu || fans.isOpen(),
    dispose() {
      close({ now: true });
      fans.dispose();
      document.body.classList.remove("ml-lab");
      bar.node.remove();
    },
  };
}
