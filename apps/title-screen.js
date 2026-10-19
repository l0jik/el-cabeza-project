/* The title screen: Nova's page opens on the Horizon · Build splash (user:
   "I want to make 5 Horizon · Build (from From your logos) to be the
   splash screen that appears when the app is first opened"). Asked, the
   user chose: a title menu on the splash ("When the video ends, the logo
   stays on screen with NOVA breathing, and a few choices fade in under
   it"), every time the app opens (a tap at any moment skips the rest of
   the video), and held on the logo until a tap.

   Not a module: build/build.js puts it in Nova's page as it is, ahead of
   the app's script, so it's up at once while the app loads (WORLD_NAMES is
   filled in there, from themes/realities.js). The app (apps/unified.jsx)
   waits for the choice (window.ecTitle.chosen: { action, world }) before
   it mounts, so nothing of the story plays under the title, then says
   when it's up (window.ecTitle.done()) and the title fades away over it.

   Choices, by where the player is in the story:
     a new player             Begin                (the story, at Big Glutts)
     partway through          Continue             (where they left off)
     after the story          Continue in <world>  (the last one played)
                              Other realities      (the theme switcher)
   and, with any progress, "Restart the story" (a second tap to be sure).
   A tap anywhere but the choices takes the first.

   Not shown when the page is reached from inside the game (another world's
   menu: ?world=, a scene's link, ?switcher, ?restart=story, ?jump=, coming
   back with the browser's Back) or under automation (the tests); ?title
   shows it anyway, and ?title=auto as a player would have it. */
(() => {
  const W = window, D = document;
  const title = { active: false };
  W.ecTitle = title;

  // The video: the splash's build-L5 (tools/splash), key framed at HOLD_FROM.
  // Its last breath runs HOLD_FROM to HOLD_TO (title.js: NOVA from 0.3 s
  // after the poster settles at 3.9 s, the breaths from 1.6 s after that,
  // each 1.7 s); held, it breathes that one again and again.
  const HOLD_FROM = 7.5, HOLD_TO = 9.2;
  const WORLD_NAMES = __WORLD_NAMES__;

  let forced = false;
  try {
    const url = new URL(W.location.href), q = url.searchParams;
    // (?title=auto: as a player would have it, the automation aside.)
    const asked = q.get("title"), asPlayer = asked === "auto";
    forced = asked !== null && !asPlayer;
    if (asked !== null) {
      q.delete("title");
      W.history.replaceState(null, "", url.pathname + (q.toString() ? `?${q}` : "") + url.hash);
    }
    const nav = W.performance && W.performance.getEntriesByType ? W.performance.getEntriesByType("navigation")[0] : null;
    const inside = ["fresh", "switcher", "world", "scene", "jump", "restart"].some((k) => q.has(k)) || (nav && nav.type === "back_forward");
    if (!forced && (inside || (navigator.webdriver && !asPlayer))) return;
  } catch (e) { return; }

  /* Where the player is. (apps/novaStory.jsx keeps the story's record,
     themes/realities.js the last world played.) */
  let rec = null, last = null;
  try { rec = JSON.parse(W.localStorage.getItem("el-cabeza:story") || "null"); } catch (e) { /* a new player, then */ }
  try { last = W.localStorage.getItem("el-cabeza:last-world"); if (last === "neon") last = "futuris"; } catch (e) { /* none */ }
  const ended = !!(rec && rec.ended), owned = !!(rec && rec.owned);
  if (!WORLD_NAMES[last]) last = null;
  const first = ended
    ? { action: "continue", word: "Continue", sub: `in ${WORLD_NAMES[last || "den"]}`, world: last || "den" }
    : owned ? { action: "continue", word: "Continue", sub: "where you left off" } : { action: "begin", word: "Begin", sub: "" };

  const CSS = `
html.ec-splash-on { background: #120C08; }
.ec-splash { position: fixed; inset: 0; z-index: 5000; overflow: hidden; background: #120C08; color: #EBCB93;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; cursor: pointer;
  font-family: 'Josefin Sans', 'Gill Sans', 'Century Gothic', 'Avenir Next', sans-serif; transition: opacity 0.7s ease; }
.ec-splash.gone { opacity: 0; pointer-events: none; }
/* (Inside the stage, so it moves with the picture; its middle exactly
   behind the picture, its drawn-out edges past the screen's.) */
.ec-splash-back { position: absolute; left: 50%; top: 50%; width: calc(min(100vw, 56.25vh) * 4); height: calc(min(100vh, 177.7778vw) * 1.8571);
  transform: translate(-50%, -50%); filter: blur(16px); }
.ec-splash-stage { position: absolute; inset: 0; transform-origin: 50% var(--o, 0px); transition: transform 0.9s cubic-bezier(.22,.7,.2,1); }
.ec-splash.menu-on .ec-splash-stage { transform: translateY(var(--dy, 0px)) scale(var(--s, 1)); }
/* The picture itself, as large as fits, its edges fading into the blur. */
.ec-splash-video { position: absolute; left: 50%; top: 50%; width: min(100vw, 56.25vh); height: min(100vh, 177.7778vw); transform: translate(-50%, -50%);
  object-fit: cover; display: block; background: transparent;
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 4%, #000 96%, transparent), linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
  -webkit-mask-composite: source-in; mask-image: linear-gradient(to bottom, transparent, #000 4%, #000 96%, transparent), linear-gradient(to right, transparent, #000 5%, #000 95%, transparent);
  mask-composite: intersect; transition: opacity 0.25s ease; }
.ec-splash-video.dip { opacity: 0; }
.ec-splash-menu { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 18px 16px max(26px, env(safe-area-inset-bottom)); opacity: 0; pointer-events: none; }
.ec-splash.menu-on .ec-splash-menu { pointer-events: auto; }
.ec-splash-menu > * { opacity: 0; transform: translateY(8px); transition: opacity 0.7s ease, transform 0.7s ease; }
.ec-splash.menu-on .ec-splash-menu { opacity: 1; }
.ec-splash.menu-on .ec-splash-menu > * { opacity: 1; transform: none; }
.ec-splash.menu-on .ec-splash-menu > :nth-child(2) { transition-delay: 0.15s; }
.ec-splash.menu-on .ec-splash-menu > :nth-child(3) { transition-delay: 0.3s; }
.ec-splash.leaving .ec-splash-menu > * { opacity: 0; transition-delay: 0s; transition-duration: 0.35s; }
:where(.ec-splash button) { all: unset; box-sizing: border-box; cursor: pointer; text-align: center; touch-action: manipulation; }
.ec-splash button:focus-visible { outline: 1px solid rgba(235, 203, 147, 0.8); outline-offset: 5px; border-radius: 2px; }
.ec-splash-primary { display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 54px; padding: 8px 18px; }
.ec-splash-primary .w { display: flex; align-items: center; gap: 18px; font-weight: 400; font-size: 22px; line-height: 1; letter-spacing: 0.34em;
  text-transform: uppercase; color: #F2D9A4; padding-left: 0.34em; text-shadow: 0 0 18px rgba(240, 192, 116, 0.35); }
.ec-splash-primary .w::before, .ec-splash-primary .w::after { content: ""; width: 42px; height: 1.5px; background: #C29A5C; flex: 0 0 auto; transition: width 0.4s ease; }
.ec-splash-primary:hover .w::before, .ec-splash-primary:hover .w::after, .ec-splash-primary:focus-visible .w::before, .ec-splash-primary:focus-visible .w::after { width: 58px; }
.ec-splash-primary .s { font-weight: 300; font-size: 13px; letter-spacing: 0.14em; color: rgba(235, 203, 147, 0.72); }
.ec-splash-second { min-height: 44px; padding: 10px 16px; font-weight: 300; font-size: 15px; letter-spacing: 0.3em; text-transform: uppercase; padding-left: calc(16px + 0.3em);
  color: rgba(217, 181, 118, 0.88); transition: color 0.3s ease; }
.ec-splash-second:hover { color: #F2D9A4; }
.ec-splash-restart { min-height: 40px; padding: 10px 14px; font-weight: 300; font-size: 12px; letter-spacing: 0.14em; color: rgba(235, 203, 147, 0.5);
  text-decoration: underline; text-decoration-color: rgba(235, 203, 147, 0.25); text-underline-offset: 4px; transition: color 0.3s ease; }
.ec-splash-restart:hover { color: rgba(235, 203, 147, 0.8); }
.ec-splash-restart.sure { color: #F4C9B0; text-decoration-color: rgba(244, 201, 176, 0.6); }
@media (prefers-reduced-motion: reduce) { .ec-splash-stage, .ec-splash-menu > *, .ec-splash-video { transition: none; } }
`;

  const el = (tag, cls, attrs = {}) => {
    const n = D.createElement(tag);
    if (cls) n.className = cls;
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const style = el("style");
  style.textContent = CSS;
  D.head.appendChild(style);
  D.documentElement.classList.add("ec-splash-on");
  const root = el("div", "ec-splash", { "data-testid": "title-screen", "data-state": "playing", role: "dialog", "aria-label": "El Cabeza Nova" });
  const back = el("canvas", "ec-splash-back", { width: "64", height: "52", "aria-hidden": "true" });
  const stage = el("div", "ec-splash-stage");
  // The sharp file where the screen has the pixels for it and the line's not
  // saving data; the lighter one otherwise (both beside the page).
  const conn = navigator.connection || {};
  const px = Math.min(W.screen.width, W.screen.height) * (W.devicePixelRatio || 1);
  const light = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "") || px < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const video = el("video", "ec-splash-video", { muted: "", playsinline: "", "webkit-playsinline": "", preload: "auto", poster: "el-cabeza-title-poster.jpg", "aria-hidden": "true", "data-testid": "title-video" });
  video.muted = true;
  video.playsInline = true;
  // (VP9 where a browser has no H.264, as some builds of Chromium.)
  const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"') !== "";
  video.src = !h264 ? "el-cabeza-title-720.webm" : light ? "el-cabeza-title-720.mp4" : "el-cabeza-title.mp4";
  stage.appendChild(video);
  const menu = el("div", "ec-splash-menu");
  const primary = el("button", "ec-splash-primary", { type: "button", "data-testid": "title-primary", "data-action": first.action });
  const word = el("span", "w");
  word.textContent = first.word;
  primary.appendChild(word);
  if (first.sub) { const s = el("span", "s"); s.textContent = first.sub; primary.appendChild(s); }
  menu.appendChild(primary);
  let second = null, restart = null;
  if (ended) {
    second = el("button", "ec-splash-second", { type: "button", "data-testid": "title-realities" });
    second.textContent = "Other realities";
    menu.appendChild(second);
  }
  if (ended || owned) {
    restart = el("button", "ec-splash-restart", { type: "button", "data-testid": "title-restart" });
    restart.textContent = "Restart the story";
    menu.appendChild(restart);
  }
  stage.insertBefore(back, video);
  root.append(stage, menu);
  D.body.appendChild(root);

  let resolveChoice;
  title.chosen = new Promise((r) => { resolveChoice = r; });
  title.active = true;
  title.choice = null;

  /* ------------------------------------------------ the picture */

  /* Behind the picture, the picture again, tiny, its edges drawn out to the
     sides and above and below it, and blurred: so the room round it on any
     screen is the frame's own edge colours (the table's, then the
     ground's), lined up with it. 16 x 28 in the middle of 64 x 52. */
  const bctx = back.getContext("2d");
  const paint = () => {
    try {
      if (video.readyState < 2) return;
      bctx.drawImage(video, 24, 12, 16, 28);
      bctx.drawImage(back, 24, 12, 1, 28, 0, 12, 24, 28);
      bctx.drawImage(back, 39, 12, 1, 28, 40, 12, 24, 28);
      bctx.drawImage(back, 0, 12, 64, 1, 0, 0, 64, 12);
      bctx.drawImage(back, 0, 39, 64, 1, 0, 40, 64, 12);
    } catch (err) { /* not yet */ }
  };
  let state = "playing";
  const setState = (s) => { state = s; root.setAttribute("data-state", s); };
  const holdLoop = () => {
    // past the last breath (or ended): back to its start, a key frame
    if (state !== "held" && state !== "leaving") return;
    if (video.ended || video.currentTime >= HOLD_TO) {
      video.currentTime = HOLD_FROM;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
  };
  if (video.requestVideoFrameCallback) {
    const onFrame = () => { paint(); holdLoop(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  } else {
    const tick = () => { if (!root.isConnected) return; paint(); holdLoop(); W.requestAnimationFrame(tick); };
    W.requestAnimationFrame(tick);
  }
  video.addEventListener("ended", () => { if (state === "playing") hold(); else holdLoop(); });
  video.addEventListener("seeked", paint);
  video.addEventListener("error", () => { if (state === "playing") hold(); });

  const reduce = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    // A still logo, no morph and no breathing.
    video.addEventListener("loadedmetadata", () => { video.currentTime = HOLD_FROM; }, { once: true });
    W.setTimeout(() => hold(true), 50);
  } else {
    const p = video.play();
    // (No autoplay, e.g. a phone saving power: the logo, held.)
    if (p && p.catch) p.catch(() => { if (state === "playing") hold(true); });
  }

  /* The room for the menu: the logo (its emblem to NOVA, 22% to 88.5% of
     the frame's height) eased up, and down in size if it must, to sit in
     the middle of what's above the menu. */
  const fit = () => {
    const vw = W.innerWidth, vh = W.innerHeight, V = Math.min(vh, (vw * 1920) / 1080);
    const top = (vh - V) / 2, menuH = menu.offsetHeight, pad = 16;
    const avail = Math.max(120, vh - menuH - pad);
    const s = Math.min(1, avail / (0.665 * V));
    const c = 0.665 * V * s, want = pad + (avail - c) / 2;
    const dy = Math.min(0, want - (top + 0.22 * V * s));
    stage.style.setProperty("--o", `${top}px`);
    stage.style.setProperty("--s", s.toFixed(4));
    stage.style.setProperty("--dy", `${dy.toFixed(1)}px`);
  };
  W.addEventListener("resize", fit);

  // The video over (or skipped): the logo held, breathing, and the menu.
  function hold(still = false) {
    if (state !== "playing" && state !== "skipping") return;
    setState("held");
    fit();
    root.classList.add("menu-on");
    if (still) { try { video.pause(); video.currentTime = HOLD_FROM; } catch (e) { /* as it is */ } }
    else holdLoop();
  }
  // A tap while it plays: a dip to the logo, held.
  function skip() {
    if (state !== "playing") return;
    setState("skipping");
    video.classList.add("dip");
    W.setTimeout(() => {
      const show = () => { video.classList.remove("dip"); hold(); };
      try {
        video.currentTime = HOLD_FROM;
        video.addEventListener("seeked", show, { once: true });
        W.setTimeout(show, 900); // (in case the seek's slow to say so)
      } catch (e) { show(); }
    }, 260);
  }

  /* ------------------------------------------------ the choices */

  let sureTimer = 0;
  function choose(action) {
    if (state !== "held") return;
    if (action === "restart" && restart && !restart.classList.contains("sure")) {
      restart.classList.add("sure");
      restart.textContent = "Tap again to restart the story";
      clearTimeout(sureTimer);
      sureTimer = W.setTimeout(() => { restart.classList.remove("sure"); restart.textContent = "Restart the story"; }, 4000);
      return;
    }
    setState("leaving");
    root.classList.add("leaving");
    // Full screen, from this tap (as every screen of the game asks at its
    // first; not where a browser can't, as an iPhone's).
    try {
      const de = D.documentElement;
      if (!D.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(() => {});
    } catch (e) { /* not offered */ }
    title.choice = action === "continue" && first.world ? { action, world: first.world } : { action };
    resolveChoice(title.choice);
    // (If the app never says it's up, the title goes anyway.)
    W.setTimeout(() => title.done(), 15000);
  }
  let gone = false;
  title.done = () => {
    if (gone) return;
    gone = true;
    root.classList.add("gone");
    W.setTimeout(() => {
      W.removeEventListener("resize", fit);
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) { /* gone anyway */ }
      root.remove();
      style.remove();
      D.documentElement.classList.remove("ec-splash-on");
      title.active = false;
    }, 760);
  };

  root.addEventListener("click", (e) => {
    if (state === "playing") { skip(); return; }
    if (state !== "held") return;
    const b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (b === second) choose("realities");
    else if (b === restart) choose("restart");
    else choose(first.action);
  });
  W.addEventListener("keydown", (e) => {
    if (!root.isConnected || gone) return;
    if (state === "playing" && (e.key === "Enter" || e.key === " " || e.key === "Escape")) { e.preventDefault(); skip(); return; }
    if (state === "held" && (e.key === "Enter" || e.key === " ") && !(D.activeElement && D.activeElement.closest && D.activeElement.closest(".ec-splash button"))) {
      e.preventDefault();
      choose(first.action);
    }
  });
})();
