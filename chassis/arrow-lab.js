/* The slide-arrow lab (user, 2026-10-29: "Slide drag indicator arrows
   should be more visible, like always on top... But let's test 5
   implementations to see the best way before making any changes").

   The arrow a drag lights on the piece it would slide (the chassis's
   slideArrowGroup, updateSlideArrow) sits at the piece's foot, inside it,
   and only its head shows past the piece's side, hidden whenever the
   slide points away from the camera. With ?arrowlab it's drawn one of
   five ways instead; without, the game's own arrow, as ever:

     1 On top        a flat arrow lying on the piece's top, from its
                     middle out past its face, outlined, drawn over
                     everything (flat: a round one seen from low down,
                     pointing away, is a pin, its cone a disc)
     2 See-through   today's arrow, larger and brighter, where it is (out
                     through the piece's side); where the piece hides it,
                     it shows through
     3 Sign above    a flat arrow sign floating over the piece, outlined,
                     bobbing gently
     4 Path          an arrow on the board from the piece onto the squares
                     it slides into, each of them outlined, over
                     everything (picked: the game's own now)
     5 Screen        a flat arrow on the page, over the game, from the
                     piece to where it would land, dots running along it

   A bar at the top picks the way (‹ ›, the list) and leaves the lab.
   ?arrowlab turns it on for the tab (the chassis's arrowLabWanted keeps it
   on from page to page there), ?arrowlab=3 starts on that one,
   ?arrowlab=0 turns it off; the one last looked at is kept in this
   browser. Loaded only when asked for.

   Picked: 4, Path (user: "go with arrow 4, path"), now the game's own
   arrow everywhere (chassis/slide-path.js, which this draws it with too);
   the others stay here to compare. */
import * as THREE from "three";
import { SQUARE_SIZE } from "../engine/constants.js";
import { pieceCenter, restingY } from "../engine/geometry.js";
import { GLOW, INK, mat, flatArrow, onTop, dispose as free, buildSlidePath } from "./slide-path.js";

const ON_KEY = "el-cabeza:arrow-lab";
const PICK_KEY = "el-cabeza:arrow-lab-version";

export const ARROW_VERSIONS = [
  { n: 1, name: "On top", about: "A flat arrow lying on the piece's top, outlined, drawn over everything." },
  { n: 2, name: "See-through", about: "Today's arrow, larger and brighter, out through the piece's side; where the piece hides it, it shows through." },
  { n: 3, name: "Sign above", about: "A flat arrow sign floating over the piece, outlined, bobbing gently." },
  { n: 4, name: "Path", about: "The game's own now: an arrow on the board onto the squares the piece slides into, each of them outlined, over everything." },
  { n: 5, name: "Screen", about: "A flat arrow on the page over the game, from the piece to where it would land, dots running along it." },
];

// The arrow's colours (slide-path.js GLOW and INK), for the page.
const GLOW_CSS = "#66d9ff", INK_CSS = "#0a1a20";

const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

function loadPick() {
  try {
    const q = new URLSearchParams(window.location.search).get("arrowlab");
    const n = q && /^[1-5]$/.test(q) ? +q : +(window.localStorage.getItem(PICK_KEY) || 1);
    const i = ARROW_VERSIONS.findIndex((v) => v.n === n);
    return i >= 0 ? i : 0;
  } catch (e) {
    return 0;
  }
}

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => { if (k === "className") e.className = v; else e.setAttribute(k, v); });
  kids.forEach((k) => e.append(k));
  return e;
}

function addStyle() {
  if (document.getElementById("arrow-lab-style")) return;
  const s = document.createElement("style");
  s.id = "arrow-lab-style";
  s.textContent = `
.al-bar{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;align-items:center;gap:4px;width:max-content;max-width:calc(100vw - 16px);pointer-events:none;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f6efe2}
.al-row{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgba(26,20,14,.86);box-shadow:0 4px 18px rgba(0,0,0,.3)}
.al-tag{padding:0 6px 0 10px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.72;white-space:nowrap}
.al-btn{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;width:32px;height:32px;border-radius:50%;font:inherit;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.al-btn:hover{background:rgba(255,255,255,.1)}
.al-exit{font-size:13px;opacity:.75}
.al-pick{appearance:none;-webkit-appearance:none;border:0;border-radius:999px;background:rgba(255,255,255,.13);color:inherit;font:inherit;font-weight:600;padding:7px 12px;cursor:pointer;max-width:46vw}
.al-pick option{color:#1a140e;background:#f6efe2}
.al-btn:focus-visible,.al-pick:focus-visible{outline:2px solid #f6efe2;outline-offset:1px}
.al-about{max-width:340px;padding:4px 10px;border-radius:8px;background:rgba(26,20,14,.66);font-size:11.5px;line-height:1.35;text-align:center;text-wrap:balance}
.al-screen{position:fixed;inset:0;width:100%;height:100%;z-index:11;pointer-events:none;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.al-screen .al-dots{stroke-dasharray:0.1 15;animation:alDots .7s linear infinite}
@keyframes alDots{to{stroke-dashoffset:-15.1}}
@media (prefers-reduced-motion: reduce){.al-screen .al-dots{animation:none}}`;
  document.head.append(s);
}

/* ------------------------------------------------------------ shapes */

// A round arrow along +x from the origin, length L (shaft and cone).
function roundArrow(L, r, headR, headL, material) {
  const g = new THREE.Group();
  const shaftL = Math.max(0.02, L - headL);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, shaftL, 14), material);
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = shaftL / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(headR, headL, 22), material);
  head.rotation.z = -Math.PI / 2;
  head.position.x = shaftL + headL / 2;
  g.add(shaft, head);
  return g;
}

/* ------------------------------------------------------------ the slide */

// How far the piece reaches from its middle the way it slides (to its
// face, or its corner on a diagonal).
function reach(p, dr, dc) {
  const hx = (p.w * SQUARE_SIZE) / 2, hz = (p.h * SQUARE_SIZE) / 2;
  return Math.hypot(dc ? hx : 0, dr ? hz : 0);
}
const topOf = (p) => restingY(p) * 2;

/* host: { three: () => three.current } (boardGroup, camera, renderer,
   frameHooks). Gives back show({ piece, dir: [dr, dc], candidate }),
   hide(), version(), dispose(). */
export function installArrowLab(host) {
  addStyle();
  let at = loadPick();
  let shown = null; // { obj, kind, info, hook, svg }
  const bar = makeBar();
  say();

  function makeBar() {
    const button = (text, label, id, fn, cls = "") => {
      const b = el("button", { type: "button", className: `al-btn ${cls}`, "aria-label": label, title: label, "data-testid": id }, text);
      b.addEventListener("click", fn);
      return b;
    };
    const pick = el("select", { className: "al-pick", "aria-label": "Slide arrow version", "data-testid": "arrow-lab-pick" },
      ...ARROW_VERSIONS.map((v, i) => el("option", { value: String(i) }, `${v.n} · ${v.name}`)));
    pick.value = String(at);
    pick.addEventListener("change", () => choose(+pick.value));
    const about = el("div", { className: "al-about", "data-testid": "arrow-lab-about" });
    const node = el("div", { className: "al-bar", "data-testid": "arrow-lab-bar" },
      el("div", { className: "al-row" },
        el("span", { className: "al-tag" }, "Arrow lab"),
        button("‹", "Previous version", "arrow-lab-prev", () => choose(at - 1)),
        pick,
        button("›", "Next version", "arrow-lab-next", () => choose(at + 1)),
        button("✕", "Leave the arrow lab", "arrow-lab-exit", leave, "al-exit")),
      about);
    document.body.append(node);
    return { node, pick, about };
  }

  function say() {
    const v = ARROW_VERSIONS[at];
    bar.node.dataset.version = String(v.n);
    bar.about.textContent = `${v.about} With Slide on (a game's laws), pick a piece of yours, then press on it and drag.`;
  }

  function choose(i) {
    at = (i + ARROW_VERSIONS.length) % ARROW_VERSIONS.length;
    try { window.localStorage.setItem(PICK_KEY, String(ARROW_VERSIONS[at].n)); } catch (e) { /* this visit only */ }
    bar.pick.value = String(at);
    say();
    // One showing becomes the new way at once, to compare.
    if (shown) { const info = shown.info; clear(); show(info); }
  }

  function leave() {
    clear();
    try { window.sessionStorage.removeItem(ON_KEY); } catch (e) { /* none */ }
    const u = new URL(window.location.href);
    u.searchParams.delete("arrowlab");
    window.location.replace(u.toString());
  }

  function clear() {
    if (!shown) return;
    const t = host.three();
    if (shown.hook && t && t.frameHooks) t.frameHooks.delete(shown.hook);
    if (shown.obj) free(shown.obj);
    if (shown.svg) shown.svg.remove();
    shown = null;
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__ARROW_LAB__ = { version: ARROW_VERSIONS[at].n, shown: null };
  }

  /* ---------------------------------------------------------- the five */

  // 1 On top: a flat arrow lying on the piece's top, from behind its
  // middle out past its face, outlined, over everything.
  function build1({ piece, dir: [dr, dc] }) {
    const r = reach(piece, dr, dc);
    const g = new THREE.Group();
    const back = flatArrow(-r * 0.55, r + 0.62, 0.22, 0.6, 0.4, mat(INK, { side: THREE.DoubleSide }), 0.06);
    const face = flatArrow(-r * 0.55, r + 0.62, 0.22, 0.6, 0.4, mat(GLOW, { side: THREE.DoubleSide }));
    face.position.y = 0.002;
    onTop(back, 40); onTop(face, 41);
    g.add(back, face);
    const c = pieceCenter(piece);
    g.position.set(c.x, topOf(piece) + 0.04, c.z);
    g.rotation.y = Math.atan2(-dr, dc);
    return { obj: g };
  }

  // 2 See-through: today's arrow, larger and brighter, out through the
  // piece's side at half its height, drawn as ever where it's seen; where
  // the piece hides it, a lighter copy shows through (drawn only where
  // it's behind).
  function build2({ piece, dir: [dr, dc] }) {
    const L = reach(piece, dr, dc) + 0.62;
    const g = new THREE.Group();
    const solid = roundArrow(L, 0.07, 0.21, 0.42, mat(GLOW));
    const ghost = roundArrow(L, 0.07, 0.21, 0.42, mat(GLOW, { transparent: true, opacity: 0.72, depthWrite: false, depthFunc: THREE.GreaterDepth }));
    ghost.traverse((x) => { if (x.isMesh) x.renderOrder = 45; });
    g.add(solid, ghost);
    const c = pieceCenter(piece);
    g.position.set(c.x, Math.max(0.16, topOf(piece) / 2), c.z);
    g.rotation.y = Math.atan2(-dr, dc);
    return { obj: g };
  }

  // 3 Sign above: a flat arrow over the piece, its middle over the
  // piece's, outlined, floating, bobbing.
  function build3({ piece, dir: [dr, dc] }) {
    const L = Math.max(1.15, reach(piece, dr, dc) * 1.3 + 0.45);
    const g = new THREE.Group();
    const back = flatArrow(-L / 2, L / 2, 0.34, 0.86, 0.5, mat(INK, { side: THREE.DoubleSide }), 0.07);
    const face = flatArrow(-L / 2, L / 2, 0.34, 0.86, 0.5, mat(GLOW, { side: THREE.DoubleSide }));
    face.position.y = 0.002;
    onTop(back, 40); onTop(face, 41);
    g.add(back, face);
    const c = pieceCenter(piece), y = topOf(piece) + 0.55;
    const ux = dc / Math.hypot(dr, dc), uz = dr / Math.hypot(dr, dc);
    g.position.set(c.x + ux * 0.18, y, c.z + uz * 0.18);
    g.rotation.y = Math.atan2(-dr, dc);
    const still = reduced();
    const hook = still ? null : (now) => { g.position.y = y + Math.sin((now / 1400) * Math.PI * 2) * 0.06; };
    return { obj: g, hook };
  }

  // 4 Path: the game's own now (slide-path.js).
  function build4({ piece, dir, candidate }) {
    return { obj: buildSlidePath(piece, dir, candidate) };
  }

  // 5 Screen: on the page itself, over the game: from the piece's top to
  // where its top would be after the slide (at least 96 px), dark edged,
  // dots running along it; placed again each frame.
  function build5({ piece, dir: [dr, dc], candidate }, t) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "al-screen");
    svg.setAttribute("data-testid", "arrow-lab-screen");
    const mk = (tag, a) => { const e = document.createElementNS(NS, tag); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); svg.append(e); return e; };
    const shaftBack = mk("path", { fill: "none", stroke: INK_CSS, "stroke-width": "17", "stroke-linecap": "round" });
    const headBack = mk("path", { fill: INK_CSS, stroke: INK_CSS, "stroke-width": "6", "stroke-linejoin": "round" });
    const shaft = mk("path", { fill: "none", stroke: GLOW_CSS, "stroke-width": "10", "stroke-linecap": "round" });
    const head = mk("path", { fill: GLOW_CSS });
    const dots = mk("path", { class: "al-dots", fill: "none", stroke: "#ffffff", "stroke-width": "4.5", "stroke-linecap": "round" });
    document.body.append(svg);
    const land = candidate || { ...piece, row: piece.row + dr, col: piece.col + dc };
    const y = topOf(piece);
    const from = pieceCenter(piece), to = pieceCenter(land);
    const v = new THREE.Vector3();
    const place = () => {
      const canvas = t.renderer && t.renderer.domElement;
      if (!canvas || !t.camera || !t.boardGroup) return;
      const r = canvas.getBoundingClientRect();
      const screen = (x, z) => {
        v.set(x, y, z);
        t.boardGroup.localToWorld(v);
        v.project(t.camera);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      };
      const A = screen(from.x, from.z);
      let B = screen(to.x, to.z);
      let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      if (d < 96) { B = { x: A.x + (dx / d) * 96, y: A.y + (dy / d) * 96 }; dx = B.x - A.x; dy = B.y - A.y; d = 96; }
      const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
      const HL = 24, HW = 17;
      const neck = { x: B.x - ux * HL, y: B.y - uy * HL };
      const f = (n) => n.toFixed(1);
      const line = `M${f(A.x)} ${f(A.y)}L${f(neck.x)} ${f(neck.y)}`;
      const tri = `M${f(B.x)} ${f(B.y)}L${f(neck.x + nx * HW)} ${f(neck.y + ny * HW)}L${f(neck.x - nx * HW)} ${f(neck.y - ny * HW)}Z`;
      shaftBack.setAttribute("d", line); shaft.setAttribute("d", line); dots.setAttribute("d", line);
      headBack.setAttribute("d", tri); head.setAttribute("d", tri);
      svg.dataset.from = `${Math.round(A.x)},${Math.round(A.y)}`;
      svg.dataset.to = `${Math.round(B.x)},${Math.round(B.y)}`;
    };
    place();
    return { svg, hook: place };
  }

  const BUILD = { 1: build1, 2: build2, 3: build3, 4: build4, 5: build5 };

  // (Tests: how it's drawn. "over" everything, shows "through" what hides
  // it, or on the "page".)
  function drawn(made) {
    if (made.svg) return "page";
    let over = true, through = false;
    made.obj.traverse((x) => {
      if (!x.isMesh) return;
      if (x.material.depthTest !== false) over = false;
      if (x.material.depthFunc === THREE.GreaterDepth) through = true;
    });
    return over ? "over" : through ? "through" : "in place";
  }

  function show(info) {
    const t = host.three();
    if (!t || !t.boardGroup || !info || !info.piece) return;
    const kind = ARROW_VERSIONS[at].n;
    const same = shown && shown.kind === kind && shown.info.piece.id === info.piece.id
      && shown.info.dir[0] === info.dir[0] && shown.info.dir[1] === info.dir[1];
    if (same) return;
    clear();
    const made = BUILD[kind](info, t);
    if (made.obj) { made.obj.name = "arrow-lab"; t.boardGroup.add(made.obj); }
    shown = { ...made, kind, info };
    if (made.hook && t.frameHooks) t.frameHooks.add(made.hook);
    if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__ARROW_LAB__ = { version: kind, shown: { piece: info.piece.id, dir: info.dir.slice(), drawn: drawn(made) } };
  }

  if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__ARROW_LAB__ = { version: ARROW_VERSIONS[at].n, shown: null };

  return {
    show,
    hide: clear,
    version: () => ARROW_VERSIONS[at].n,
    // (Tests: the lab's own objects, to look at.)
    object: () => (shown ? shown.obj || null : null),
    dispose() {
      clear();
      bar.node.remove();
    },
  };
}
