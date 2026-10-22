/* The title screen: Nova's page opens on the Horizon · Build splash (user:
   "I want to make 5 Horizon · Build (from From your logos) to be the
   splash screen that appears when the app is first opened"). Asked, the
   user chose: a title menu on the splash ("When the video ends, the logo
   stays on screen with NOVA breathing, and a few choices fade in under
   it"; then, "Make it 6.2 seconds before the button appears"; then, "I
   don't want begin to show up until both El Cabeza and the word Nova have
   already shown up. BEGIN should be the last thing to show up on the
   screen. Also, as soon as BEGIN is on screen, though, you should
   immediately be able to click on it": the choices come in once NOVA is
   in, and a finger's tap on one counts as it lifts), every time the app
   opens, and held on the logo until a choice. (The video's board turns
   into the emblem a little more slowly now, and once it's whole the
   board's ghost comes and goes in the disc, user; tools/splash.)
   Then
   (user: "Tapping anywhere on the splash screen, I don't want that.
   I want it to, you have to hit the buttons") only the buttons choose:
   a tap off them, while the video plays or after, chooses nothing. (On a
   keyboard, Escape skips the rest of the video.) And full screen first
   (user: "Need the splash screen to automatically go full screen. That
   should be the first thing it does."): a page can't go full screen by
   itself, only from a tap, a click or a key, so the first one, wherever
   it lands, does that, and only that off the buttons.

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

   Not shown when the page is reached from inside the game (another world's
   menu: ?world=, a scene's link, ?switcher, ?restart=story, ?jump=, coming
   back with the browser's Back) or under automation (the tests); ?title
   shows it anyway, and ?title=auto as a player would have it. */
(() => {
  const W = window, D = document;
  const title = { active: false };
  W.ecTitle = title;

  // The video: the splash's build-L5 (tools/splash), key framed at HOLD_FROM.
  // Its last two breaths run HOLD_FROM to HOLD_TO (title.js: the emblem
  // whole at 4.9 s, NOVA from 0.3 s after, in by 6.7 s, three breaths from
  // 1.6 s after it came, each 1.7 s; the board's ghost in the disc once
  // round in two, v-build.js); held, it plays those two again and again.
  const HOLD_FROM = 8.5, HOLD_TO = 11.9;
  // The choices come in this far into it, the last thing to: EL CABEZA
  // and NOVA both in (user: "BEGIN should be the last thing to show up on
  // the screen"); the video plays on.
  const MENU_AT = 6.9;
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
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; cursor: default;
  font-family: 'Josefin Sans', 'Gill Sans', 'Century Gothic', 'Avenir Next', sans-serif; transition: opacity 0.7s ease; }
.ec-splash.gone { opacity: 0; pointer-events: none; }
/* (Inside the stage, so it moves with the picture; its middle exactly
   behind the picture, its drawn-out edges past the screen's.) */
.ec-splash-back { position: absolute; left: 50%; top: 50%; width: calc(min(100vw, 56.25vh) * 4); height: calc(min(100vh, 177.7778vw) * 1.8571);
  transform: translate(-50%, -50%); }
.ec-splash-back.css-blur { filter: blur(16px); }
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
/* The way out: the choice squeezed to a line and gone, its rules drawn out
   along it, as the splash plays back to the board over the held logo (the
   stage settling back as it came). */
.ec-splash-rewind { opacity: 0; transition: opacity 0.3s ease; }
.ec-splash-rewind.on { opacity: 1; }
.ec-splash.menu-on.settle .ec-splash-stage { transform: none; transition-duration: 1.6s; }
.ec-splash.leaving .ec-splash-menu > .picked { animation: ecPicked 0.8s cubic-bezier(.55, 0, .75, .2) forwards; }
.ec-splash.leaving .ec-splash-menu > .picked .w::before, .ec-splash.leaving .ec-splash-menu > .picked .w::after { width: 96px; transition: width 0.65s ease; }
@keyframes ecPicked { 0% { opacity: 1; transform: none; } 55% { opacity: 1; transform: scale(1.04, 0.16); } 100% { opacity: 0; transform: scale(1.18, 0.02); } }
@media (prefers-reduced-motion: reduce) { .ec-splash-stage, .ec-splash-menu > *, .ec-splash-video { transition: none; } .ec-splash.leaving .ec-splash-menu > .picked { animation: none; } }
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
  // saving data or slow (under 5 Mbit/s, where the sharp one, 4.4 MB, came
  // in stop and go); the lighter one otherwise (both beside the page).
  const conn = navigator.connection || {};
  const px = Math.min(W.screen.width, W.screen.height) * (W.devicePixelRatio || 1);
  const light = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "") || (conn.downlink > 0 && conn.downlink < 5) || px < 900 || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const video = el("video", "ec-splash-video", { muted: "", playsinline: "", "webkit-playsinline": "", preload: "auto", poster: "el-cabeza-title-poster.jpg", "aria-hidden": "true", "data-testid": "title-video" });
  video.muted = true;
  video.playsInline = true;
  // (VP9 where a browser has no H.264, as some builds of Chromium.)
  const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"') !== "";
  video.src = !h264 ? "el-cabeza-title-720.webm" : light ? "el-cabeza-title-720.mp4" : "el-cabeza-title.mp4";
  stage.appendChild(video);
  /* The splash played back, for the way out (user: "When clicking begin
     on the splash screen, it should play the animation in reverse. Like
     maybe begin like zooms out like vertically, and then as it's doing
     that, then everything goes in reverse"): rendered from the held logo
     back to the board (tools/splash render.mjs rewind), over the picture,
     unseen until it plays; fetched once the menu's up. 4.8 s, the emblem
     coming apart at about its own speed (user, of the first, 2.75 s: "It
     happens so fast you don't really get to see anything"); the button's
     squeeze and the stage's settling back a little slower with it. */
  const rew = el("video", "ec-splash-video ec-splash-rewind", { muted: "", playsinline: "", "webkit-playsinline": "", preload: "none", "aria-hidden": "true", "data-testid": "title-rewind" });
  rew.muted = true;
  rew.playsInline = true;
  const REWIND_SRC = !h264 ? "el-cabeza-title-rewind-720.webm" : light ? "el-cabeza-title-rewind-720.mp4" : "el-cabeza-title-rewind.mp4";
  stage.appendChild(rew);
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
     ground's), lined up with it. 16 x 28 in the middle of 64 x 52.
     The blur's drawn in the canvas itself (at four times that, 256 x 208,
     so it's smooth spread over the screen), not a CSS blur on the canvas:
     an element several screens in size blurred again each time it
     changed, every frame, held up a phone's every frame (user: "it kind
     of gets hung up"). And it's drawn 18 times a second at most, the
     room's colours changing slowly. (A browser that can't blur in a
     canvas, an older iPhone's, keeps the CSS blur.) */
  const bctx = back.getContext("2d");
  const inCanvas = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;
  const small = inCanvas ? D.createElement("canvas") : back;
  if (inCanvas) { small.width = 64; small.height = 52; back.width = 256; back.height = 208; } else back.classList.add("css-blur");
  const sctx = inCanvas ? small.getContext("2d") : bctx;
  let rewinding = false; // (the way out's playback: the picture's from it)
  let paintedAt = -1e4;
  const paint = (now) => {
    const t = W.performance.now();
    if (now !== true && t - paintedAt < 55) return;
    try {
      const v = rewinding ? rew : video;
      if (v.readyState < 2) return;
      sctx.drawImage(v, 24, 12, 16, 28);
      sctx.drawImage(small, 24, 12, 1, 28, 0, 12, 24, 28);
      sctx.drawImage(small, 39, 12, 1, 28, 40, 12, 24, 28);
      sctx.drawImage(small, 0, 12, 64, 1, 0, 0, 64, 12);
      sctx.drawImage(small, 0, 39, 64, 1, 0, 40, 64, 12);
      if (inCanvas) {
        // (The CSS blur's 16 px, about 2.4 of these where it's seen.)
        bctx.clearRect(0, 0, 256, 208);
        bctx.filter = "blur(2.4px)";
        bctx.drawImage(small, 0, 0, 256, 208);
        bctx.filter = "none";
      }
      paintedAt = t;
    } catch (err) { /* not yet */ }
  };
  // (All of it in; or, enough to play to its end at the rate it's coming.)
  const allIn = (v) => { try { const b = v.buffered; return b.length > 0 && v.duration > 0 && b.end(b.length - 1) >= v.duration - 0.05; } catch (e) { return false; } };
  const playsThrough = (v) => v.readyState >= 4 || allIn(v);
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
  const menuDue = () => { if (state === "playing" && video.currentTime >= MENU_AT) hold(); };
  if (video.requestVideoFrameCallback) {
    const onFrame = () => { paint(); menuDue(); holdLoop(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  } else {
    const tick = () => { if (!root.isConnected) return; paint(); menuDue(); holdLoop(); W.requestAnimationFrame(tick); };
    W.requestAnimationFrame(tick);
  }
  video.addEventListener("timeupdate", menuDue);
  // (A video that stalls on a slow line never gets there: the logo, still,
  // and the choices under it, a few seconds on, counted from its start;
  // one that never starts, 20 s on.)
  const stalled = () => { if (state === "playing") hold(true); };
  W.setTimeout(stalled, 20000);
  video.addEventListener("ended", () => { if (state === "playing") hold(); else holdLoop(); });
  video.addEventListener("seeked", () => paint(true));
  video.addEventListener("error", () => { if (state === "playing") hold(); });

  const reduce = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    // A still logo, no morph and no breathing.
    video.addEventListener("loadedmetadata", () => { video.currentTime = HOLD_FROM; }, { once: true });
    W.setTimeout(() => hold(true), 50);
  } else {
    /* Started once it can play to its end without running dry: on a slow
       line it started with a little in and ran stop and go through the
       board's change ("it kind of gets hung up"). Its first frame, the
       board, is up until then (the poster). Once it could start, 3 s more
       at most; and if nothing's coming in at all (a browser that fetches
       only once it's played), started 2.5 s on, as before. */
    let started = false, coming = false;
    const start = () => {
      if (started || state !== "playing") return;
      started = true;
      W.setTimeout(stalled, (MENU_AT + 6) * 1000);
      const p = video.play();
      // (No autoplay, e.g. a phone saving power: the logo, held.)
      if (p && p.catch) p.catch(() => { if (state === "playing") hold(true); });
    };
    if (playsThrough(video)) start();
    else {
      video.addEventListener("canplaythrough", start, { once: true });
      video.addEventListener("canplay", () => W.setTimeout(start, 3000), { once: true });
      video.addEventListener("progress", () => { coming = true; if (playsThrough(video)) start(); });
      W.setTimeout(() => { if (!coming) start(); }, 2500);
      W.setTimeout(start, 9000);
    }
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

  /* The way out's playback, fetched behind the splash: as soon as the
     splash itself is all in (so the two don't share a slow line), or at
     the menu at the latest; a phone's is 2.7 MB, and it plays only once
     it's all in (rewindOut). */
  const fetchRewind = () => {
    if (reduce || rew.src) return;
    rew.preload = "auto";
    rew.src = REWIND_SRC;
    try { rew.load(); } catch (e) { /* as it comes */ }
  };
  video.addEventListener("progress", () => { if (allIn(video)) fetchRewind(); });

  // 6.9 s in (or the video over, or skipped): the menu, the logo held
  // breathing once it's into its last two breaths.
  function hold(still = false) {
    if (state !== "playing" && state !== "skipping") return;
    setState("held");
    fit();
    root.classList.add("menu-on");
    fetchRewind();
    if (still) { try { video.pause(); video.currentTime = HOLD_FROM; } catch (e) { /* as it is */ } }
    else {
      holdLoop();
      // (Skipped to before it had started: breathing from here.)
      if (video.paused && !video.ended) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    }
  }
  // Escape while it plays: a dip to the logo, held.
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

  /* ------------------------------------------------ full screen */

  /* From the first tap, click or key (not Escape, which a browser keeps
     for leaving it), wherever it lands, and any later one that finds the
     page out of it, as the game does (chassis: fullscreenOnFirstTap).
     Not where a browser can't, as an iPhone's. A touch's end counts too,
     a touch that moves never makes a click. */
  let askedAt = -1e4;
  function fullScreen() {
    try {
      const de = D.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (!req || D.fullscreenElement || D.webkitFullscreenElement) return;
      // (Opened from its icon on a home screen it's full screen already:
      // the app's manifest, build/build.js APP_HEAD.)
      if (W.matchMedia && W.matchMedia("(display-mode: fullscreen)").matches) return;
      const now = W.performance.now();
      if (now - askedAt < 1000) return; // (one ask a touch: its end, then its click)
      askedAt = now;
      const p = req.call(de);
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* not offered */ }
  }
  const firstTouch = (e) => {
    if (gone || !e.isTrusted) return;
    if (e.type === "touchend" && e.touches && e.touches.length) return; // (other fingers still down)
    fullScreen();
  };
  root.addEventListener("touchend", firstTouch, true);
  root.addEventListener("click", firstTouch, true);

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
    const picked = action === "realities" ? second : action === "restart" ? restart : primary;
    if (picked) picked.classList.add("picked");
    fullScreen();
    title.choice = action === "continue" && first.world ? { action, world: first.world } : { action };
    rewindOut();
  }

  /* The way out: the splash played back to the board (rew), then the app
     let in under the title, and the title faded off it once it's up (the
     playback over, rewound; the app up, appUp). Not under way in a moment
     (a slow line), or reduced motion: the app's let in at once, and the
     title fades as soon as it's up. (Escape cuts it short.)
     The app's let in only once the playback's over, not as it starts:
     mounting it (its scene built, its first pictures drawn, a phone's
     graphics busy with them) held the playback up, frames late and then
     jumping (user: "it kind of gets hung up ... especially ... after
     begin is pressed and it goes back"). Over the board, the playback's
     last frame held still, the wait shows nothing moving to stop. */
  let rewound = false, appUp = false, letIn = false;
  const goIfDone = () => { if (rewound && appUp) leave(); };
  const letAppIn = () => {
    if (letIn) return;
    letIn = true;
    // (A couple of frames on: what's on the screen drawn first.)
    let sent = false;
    const go = () => { if (sent) return; sent = true; resolveChoice(title.choice); };
    W.requestAnimationFrame(() => W.requestAnimationFrame(go));
    W.setTimeout(go, 150);
    // (If the app never says it's up, the title goes anyway.)
    W.setTimeout(leave, 15000);
  };
  const rewoundNow = () => {
    if (rewound) return;
    rewound = true;
    if (rewinding) paint(true);
    letAppIn();
    goIfDone();
  };
  function rewindOut() {
    if (reduce || !rew.src) { rewoundNow(); return; }
    const giveUp = () => { if (!rewinding) { try { rew.pause(); } catch (e) { /* as it is */ } } rewoundNow(); };
    // Over the logo, crossfaded: its first frame is the held logo's.
    const show = () => {
      if (rewinding || rewound) return;
      rewinding = true;
      rew.classList.add("on");
      root.classList.add("settle");
      W.setTimeout(() => { try { video.pause(); } catch (e) { /* as it is */ } }, 350);
      const tick = () => { if (!rewinding || gone || rew.ended) return; paint(); W.requestAnimationFrame(tick); };
      W.requestAnimationFrame(tick);
      W.setTimeout(rewoundNow, 8000); // (a stalled playback still ends; it's 4.8 s)
    };
    /* Shown once it can play to its end without running dry. Not yet (a
       slow line, Begin straight away): played unseen, so it comes in, the
       logo breathing on over it, then shown from its start; a playback
       stopping and starting read as the splash hanging. Not in 3 s: the
       title fades without it. */
    const ready = () => {
      if (rewinding || rewound || !playsThrough(rew)) return;
      try { if (rew.currentTime > 0.05) rew.currentTime = 0; } catch (e) { /* from where it is */ }
      if (rew.paused) { const q = rew.play(); if (q && q.catch) q.catch(giveUp); }
      show();
    };
    rew.addEventListener("ended", () => { if (rewinding) rewoundNow(); else ready(); });
    try { if (rew.currentTime > 0) rew.currentTime = 0; } catch (e) { /* from where it is */ }
    // (Played in the tap itself, which a phone saving power asks.)
    const p = rew.play();
    if (p && p.catch) p.catch(giveUp);
    if (playsThrough(rew)) show();
    else {
      rew.addEventListener("canplaythrough", ready);
      rew.addEventListener("progress", ready);
      W.setTimeout(() => { if (!rewinding) giveUp(); }, 3000);
    }
  }
  let gone = false;
  // The app's up (apps/unified.jsx): the title goes once the playback's over.
  title.done = () => { appUp = true; goIfDone(); };
  function leave() {
    if (gone) return;
    gone = true;
    root.classList.add("gone");
    W.setTimeout(() => {
      W.removeEventListener("resize", fit);
      rewinding = false;
      for (const v of [video, rew]) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* gone anyway */ } }
      root.remove();
      style.remove();
      D.documentElement.classList.remove("ec-splash-on");
      title.active = false;
    }, 760);
  }

  /* The buttons alone (a tap anywhere else is nothing). A finger's tap on
     one counts as it lifts (user: "as soon as BEGIN is on screen ... you
     should immediately be able to click on it"): the first tap asks for
     full screen too, and the page growing to fill it can move the button
     out from under the click that would come after. A mouse's click, or
     a key on a button, as ever. */
  const which = (b) => (b === primary ? first.action : b === second ? "realities" : b === restart ? "restart" : null);
  let fingerOn = null, tappedAt = -1e4;
  root.addEventListener("pointerdown", (e) => {
    const b = e.pointerType !== "mouse" && e.target && e.target.closest ? e.target.closest(".ec-splash button") : null;
    fingerOn = b ? { b, x: e.clientX, y: e.clientY } : null;
  }, true);
  root.addEventListener("pointerup", (e) => {
    const f = fingerOn;
    fingerOn = null;
    if (!f || state !== "held" || Math.hypot(e.clientX - f.x, e.clientY - f.y) > 14) return;
    const a = which(f.b);
    if (!a) return;
    tappedAt = W.performance.now();
    choose(a);
  }, true);
  root.addEventListener("click", (e) => {
    // (The click a finger's tap makes after it, already counted.)
    if (state !== "held" || W.performance.now() - tappedAt < 800) return;
    const b = e.target && e.target.closest ? e.target.closest(".ec-splash button") : null;
    const a = b && which(b);
    if (a) choose(a);
  });
  W.addEventListener("keydown", (e) => {
    if (!root.isConnected || gone) return;
    if (e.key !== "Escape") { if (e.isTrusted) fullScreen(); return; }
    if (state === "playing") { e.preventDefault(); skip(); }
    else if (state === "leaving" && rewinding) { e.preventDefault(); rewoundNow(); }
  });
})();
