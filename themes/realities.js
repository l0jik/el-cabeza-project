/* The other realities (user: at the end of the story, the meaning of
   life, the universe and everything turns out to be this game, and there's
   a menu to explore other dimensions: every other version of the game).

   WORLDS: the three of Nova's own places (they switch in place: `nova`,
   its theme's name), and the other pages of the site (`href`): Lluvia,
   Cromo, and the Theme Lab's ten design worlds (?theme=<id>). Each has a
   picture (`shot`: a screenshot of it, made by tools/channel_shots.mjs,
   beside the page), shown here and on the den's television, where after
   the story each click of the knob is the next one (den-tv.js).

   createRealitiesMenu: the menu itself, over the void at the end
   (den-ending.js) or over the den (Nova's "Other realities"). */

// The Lab's ten, each with a one-line description (user: not "From the
// Theme Lab", a very brief line on what the theme is).
const LAB = [
  ["swiss", "Swiss Design", "A rational grid, one red, nothing extra."],
  ["bauhaus", "Bauhaus", "Circle, square, triangle, in primary paint."],
  ["destijl", "De Stijl", "Mondrian's black lines and primary fields."],
  ["elementarism", "Elementarism", "The grid set against a 45° diagonal."],
  ["brutalist", "Brutalism", "Raw concrete: poured, cast, stencilled."],
  ["newTypography", "New Typography", "The board set like a Tschichold page."],
  ["corporateSwiss", "Corporate Swiss", "A 1960s information system, consoles and all."],
  ["neoBrutalist", "Neo-Brutalism", "Flat paint, thick outlines, hard shadows."],
  ["minimalMono", "Minimal Mono", "Black, white, and almost nothing else."],
  ["ultimateFusion", "Ultimate Fusion", "Swiss, De Stijl and Brutalism in one machine."],
];

export const WORLDS = [
  { id: "den", name: "The Den, 1975", line: "Home. The fire, the records, the set.", nova: "standard" },
  { id: "neon", name: "Neon", line: "The board in light, at the edge of the Singularity.", nova: "neon" },
  { id: "store", name: "Big Glutts", line: "Games & Hobby Dept., the day you found it.", nova: "tienda" },
  { id: "lluvia", name: "Lluvia", line: "A city in the rain, far below.", href: "el-cabeza-lluvia.html" },
  { id: "cromo", name: "Cromo", line: "Steel and stone, quiet and exact.", href: "el-cabeza-cromo.html" },
  ...LAB.map(([id, name, line]) => ({ id: `lab-${id}`, name, line, href: `el-cabeza-lab.html?theme=${id}` })),
].map((w) => ({ ...w, shot: `el-cabeza-channel-${w.id}.jpg` }));

const CSS = `
.ec-realities { position: fixed; inset: 0; z-index: 1600; display: flex; flex-direction: column; align-items: center;
  padding: max(28px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)); overflow-y: auto;
  background: radial-gradient(ellipse at 50% 30%, rgba(40,22,70,0.72), rgba(4,2,10,0.94) 70%); color: #efe9ff;
  font: 400 15px/1.45 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; opacity: 0; transition: opacity 0.9s ease; }
.ec-realities.on { opacity: 1; }
.ec-realities h2 { margin: 10px 0 4px; font: 300 clamp(26px, 6vw, 40px)/1.1 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 0.32em; text-transform: uppercase; text-align: center; text-wrap: balance; }
.ec-realities p.sub { margin: 0 0 22px; opacity: 0.7; letter-spacing: 0.06em; text-align: center; }
.ec-realities ul { list-style: none; margin: 0; padding: 0; width: min(100%, 980px);
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 14px; }
.ec-realities li button { all: unset; box-sizing: border-box; display: flex; flex-direction: column; width: 100%; cursor: pointer;
  border: 1px solid rgba(190,160,255,0.28); border-radius: 10px; overflow: hidden; background: rgba(18,10,34,0.75);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease; }
.ec-realities li button:hover, .ec-realities li button:focus-visible { transform: translateY(-2px); border-color: rgba(214,190,255,0.9);
  box-shadow: 0 0 22px rgba(150,100,255,0.45); }
.ec-realities li button:focus-visible { outline: 2px solid #cdb4ff; outline-offset: 2px; }
.ec-realities .shot { aspect-ratio: 4 / 3; width: 100%; background: #0b0614 center / cover no-repeat; }
.ec-realities .txt { padding: 9px 12px 11px; display: flex; flex-direction: column; gap: 2px; }
.ec-realities .name { font-weight: 600; letter-spacing: 0.04em; }
.ec-realities .line { font-size: 13px; opacity: 0.72; }
.ec-realities .here { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #cdb4ff; }
/* Restart story, at the very bottom (user): quiet, and it asks once more
   before it does it. (No Stay button above it: the "You are here" card
   is the way to stay, user.) */
.ec-realities .restart { all: unset; cursor: pointer; margin-top: 26px; padding: 9px 22px; border-radius: 999px;
  border: 1px solid rgba(214,190,255,0.32); letter-spacing: 0.14em; text-transform: uppercase; font-size: 11.5px; opacity: 0.8;
  touch-action: manipulation; /* (the second tap mustn't read as a double-tap zoom) */
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease; }
.ec-realities .restart:hover, .ec-realities .restart:focus-visible { opacity: 1; background: rgba(205,180,255,0.1); }
.ec-realities .restart:focus-visible { outline: 2px solid #cdb4ff; outline-offset: 3px; }
.ec-realities .restart.sure { opacity: 1; border-color: rgba(255,170,190,0.85); color: #ffd6df; background: rgba(255,120,150,0.12); }
/* Held a moment before anything can be picked (lockMs: after the
   revelation, user: taps still coming from the scene picked a world before
   the words above had been read): the choices dim and the taps go nowhere,
   a hairline under the words filling until they're live. */
.ec-realities ul { transition: opacity 0.9s ease, filter 0.9s ease; }
.ec-realities.locked ul, .ec-realities.locked .restart { pointer-events: none; opacity: 0.32; filter: saturate(0.4); }
.ec-realities .hold { width: min(60vw, 240px); height: 1px; margin: -12px 0 20px; background: rgba(205,180,255,0.18); overflow: hidden; }
.ec-realities .hold i { display: block; height: 100%; width: 100%; background: rgba(205,180,255,0.75); transform-origin: left; transform: scaleX(0); }
.ec-realities.locked .hold i { animation: ecRealHold var(--hold-ms, 3500ms) linear forwards; }
.ec-realities:not(.locked) .hold { opacity: 0; transition: opacity 0.6s ease; }
@keyframes ecRealHold { to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .ec-realities, .ec-realities li button { transition: none; } }
`;

/* Restart story (the menu's last button): Nova starts the story over in
   place (it registers how with onStoryRestart); any other page goes to
   Nova's page to do it there (?restart=story, apps/unified.jsx). */
let restartHere = null;
export function onStoryRestart(fn) {
  restartHere = fn;
  return () => { if (restartHere === fn) restartHere = null; };
}
export const RESTART_HREF = "el-cabeza-nova.html?restart=story";

/* The menu. `current`: the Nova place you're in (marked "You are here");
   onPick(world); onStay() for staying where you are: a tap on the "You
   are here" card, or Escape (there's no Stay button: user, the card
   already says it). `title` / `sub` say what it is. Returns { el, close }. */
export function createRealitiesMenu({ current = null, currentId = null, onPick, onStay, title = "Other realities", sub = "Every version of the game. Pick one.", lockMs = 0 } = {}) {
  if (typeof document === "undefined") return { el: null, close() {} };
  if (!document.querySelector("style[data-ec-realities]")) {
    const st = document.createElement("style"); st.setAttribute("data-ec-realities", ""); st.textContent = CSS; document.head.appendChild(st);
  }
  const el = document.createElement("div");
  el.className = "ec-realities";
  el.setAttribute("data-testid", "realities");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", title);
  const h = document.createElement("h2"); h.textContent = title;
  const p = document.createElement("p"); p.className = "sub"; p.textContent = sub;
  const ul = document.createElement("ul");
  WORLDS.forEach((w) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-testid", `reality-${w.id}`);
    const shot = document.createElement("span"); shot.className = "shot"; shot.style.backgroundImage = `url("${w.shot}")`;
    const txt = document.createElement("span"); txt.className = "txt";
    const name = document.createElement("span"); name.className = "name"; name.textContent = w.name;
    const line = document.createElement("span"); line.className = "line"; line.textContent = w.line;
    txt.append(name, line);
    const isHere = (current && w.nova === current) || (currentId && w.id === currentId);
    if (isHere) { const here = document.createElement("span"); here.className = "here"; here.textContent = "You are here"; txt.append(here); }
    b.append(shot, txt);
    // (Where you are already: you stay.)
    b.onclick = () => { if (locked) return; close(); if (isHere) { if (onStay) onStay(); } else if (onPick) onPick(w); };
    li.append(b); ul.append(li);
  });
  // Restart story: a first tap asks ("Tap again to restart"), a second
  // within four seconds does it.
  const restart = document.createElement("button");
  restart.type = "button"; restart.className = "restart"; restart.textContent = "Restart story";
  restart.setAttribute("data-testid", "realities-restart");
  let sureTimer = null;
  restart.onclick = () => {
    if (locked) return;
    if (!restart.classList.contains("sure")) {
      restart.classList.add("sure"); restart.textContent = "Tap again to restart the story";
      clearTimeout(sureTimer);
      sureTimer = setTimeout(() => { restart.classList.remove("sure"); restart.textContent = "Restart story"; }, 4000);
      return;
    }
    clearTimeout(sureTimer);
    close();
    if (restartHere) restartHere();
    else if (typeof window !== "undefined") window.location.href = RESTART_HREF;
  };
  let locked = lockMs > 0;
  if (locked) {
    el.classList.add("locked");
    el.setAttribute("data-locked", "true");
    el.style.setProperty("--hold-ms", `${lockMs}ms`);
    setTimeout(() => { locked = false; el.classList.remove("locked"); el.setAttribute("data-locked", "false"); }, lockMs);
  }
  const hold = document.createElement("div"); hold.className = "hold"; hold.setAttribute("aria-hidden", "true"); hold.appendChild(document.createElement("i"));
  el.append(h, p, ...(lockMs > 0 ? [hold] : []), ul, restart);
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); if (locked) return; close(); if (onStay) onStay(); } };
  window.addEventListener("keydown", onKey, true);
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", onKey, true);
    clearTimeout(sureTimer);
    el.classList.remove("on");
    setTimeout(() => el.remove(), 700);
  }
  return { el, close };
}

// Where a world goes: Nova's own places in place (go(novaTheme)) when in
// Nova, or Nova's page opened there (?world=) from another page; the
// others by changing page.
/* A reality reached from this menu keeps its way back (the corner
   button, reality-gate.js storyOver) for the rest of the tab's visit,
   even if the story isn't over in this browser's record (user: from a
   preview link's void, ?scene=hall, Lluvia had no way back). */
export const REALITIES_VISIT_KEY = "el-cabeza:realities-visit";
export function goToWorld(w, novaGo) {
  if (w.nova && novaGo) { novaGo(w.nova, w); return; }
  const href = w.nova ? `el-cabeza-nova.html?world=${w.nova}` : w.href;
  if (typeof window === "undefined" || !href) return;
  try { window.sessionStorage.setItem(REALITIES_VISIT_KEY, "1"); } catch (e) { /* the record alone, then */ }
  window.location.href = href;
}
