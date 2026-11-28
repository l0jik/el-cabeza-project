/* Nova, back at the store after the whole story (owned, the Singularity
   seen): the store has moved on (the six appliances on the table, their
   ad on the standee, "Housewares" on its card), and asking for another
   copy is the Games-counter scene in the user's photographs
   (themes/tienda-overlay.js ClerkScene): every frame's photograph loads,
   a tap goes on, merged frames crossfade within, the PA page's caption
   comes up with the phone call, and it ends with "Stay a while" and
   "Go home, confused.".

   node tests/e2e-clerk.mjs [--shots DIR] */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html";
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 20000, step = 250) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const has = async (page, id) => (await q(page, id).count()) > 0;

for (const phone of [false, true]) {
  console.log(`\n${phone ? "phone" : "desktop"}: back at the store after the story`);
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    try {
      if (!sessionStorage.getItem("clerk-test-seeded")) {
        sessionStorage.setItem("clerk-test-seeded", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
        localStorage.setItem("el-cabeza:singularity-seen", "1");
        // (Past the commercial and its special order, as the other den
        // tests seed it: otherwise the den holds everything but the order
        // card until it's answered, and the dock won't open.)
        localStorage.setItem("el-cabeza:commercial-aired", "1");
        localStorage.setItem("el-cabeza:special-order-noted", "1");
        // (What an earlier build's tour left saved: the store's music at 0 and
        // its sounds at 9%, which silenced this scene; given back now.)
        localStorage.setItem("el-cabeza:sound-levels", JSON.stringify({ music: 0, store: 0.09 }));
      }
    } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await page.goto(URL);
  check("opens at home", await poll(() => page.evaluate(() => !!window.__DEN_THREE__), 30000));
  await page.waitForTimeout(1500);
  // (No "Back to the store" button any more, user: the test's own way there.)
  await page.evaluate(() => window.__EC_TEST_BACK_TO_STORE__());
  check("back to the store", await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000));
  await page.waitForTimeout(2500);
  const table = await page.evaluate(() => {
    const t = window.__TIENDA_THREE__;
    let appliances = 0, ad = 0;
    t.scene.traverse((o) => {
      if (o.name === "tienda-appliance") appliances++;
      const m = o.material;
      if (m && !Array.isArray(m) && m.map && m.map.image && m.map.image.naturalWidth === 640 && m.map.image.naturalHeight === 1425) ad++;
    });
    return { appliances, ad };
  });
  check(`the appliances on the table (${table.appliances} parts)`, table.appliances >= 20);
  check("the standee shows the housewares ad", table.ad >= 1, JSON.stringify(table));
  const hiddenChrome = await page.evaluate(() => [...document.querySelectorAll("[data-masthead], [data-dock-piece]")].every((e) => getComputedStyle(e).display === "none"));
  check("no title and no dock piece (El Cabeza is nowhere to be seen)", hiddenChrome);
  if (shots) await page.screenshot({ path: `${shots}/${phone ? "phone" : "desk"}-store.png` });
  // The clerk comes over on his own.
  check("the Games counter scene opens by itself", await poll(() => has(page, "tienda-clerk"), 10000));
  /* Its sound (user: "There's no sound. Did you accidentally turn the sound
     off for this scene as well?"): the tour's old quiet, saved by an earlier
     build (the music at 0, the store's sounds at 9%), given back; the music's
     and the store's paths at full. */
  const snd = await page.evaluate(() => {
    let levels = null; try { levels = JSON.parse(localStorage.getItem("el-cabeza:sound-levels") || "null"); } catch (e) { /* none */ }
    const a = window.__TIENDA_AUDIO__ ? window.__TIENDA_AUDIO__() : null;
    return { levels, gates: a && a.gateLevels };
  });
  check("...with its sound: the tour's old quiet (music 0, store sounds 9%) given back, the music's and the store's paths at full", !(snd.levels && (snd.levels.music === 0 || snd.levels.store === 0.09)) && (!snd.gates || (snd.gates.music.every((g) => g === 1) && snd.gates.store.every((g) => g === 1))), JSON.stringify(snd));
  await page.waitForTimeout(500);
  const fsOnTop = await page.evaluate(() => {
    const b = document.querySelector("[data-fullscreen-toggle]");
    if (!b) return "no switch";
    const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const help = document.querySelector('[data-testid="how-to-play"]');
    return (b === top || b.contains(top)) && (!help || getComputedStyle(help).visibility === "hidden") ? true : `top: ${top && (top.className || top.tagName)}`;
  });
  check(`...with the full-screen switch still on top, the other corner buttons hidden (${fsOnTop})`, fsOnTop === true);
  const loaded = await poll(() => page.evaluate(() => {
    const ims = [...document.querySelectorAll(".td-clerk-shot")];
    return ims.length === 14 && ims.every((i) => i.complete && i.naturalWidth === 368 && i.naturalHeight === 474) ? ims.length : null;
  }), 15000);
  check(`every photograph loads (${loaded || 0} of 14)`, loaded === 14);
  const lines = [];
  let paCaption = false, frames = new Set();
  for (let i = 0; i < 20; i++) {
    const st = await page.evaluate(() => {
      const L = document.querySelector('[data-testid="tienda-clerk"]');
      const on = document.querySelector('.td-clerk-shot[data-on="true"]');
      return L && { step: +L.dataset.step, frame: +L.dataset.frame, shot: on && on.getAttribute("src"), line: document.querySelector('[data-testid="tienda-clerk-line"]').textContent };
    });
    if (!st) break;
    lines.push(st.line); frames.add(st.frame);
    if (shots && [0, 1, 5, 6, 13].includes(st.step)) { await page.waitForTimeout(1100); await page.screenshot({ path: `${shots}/${phone ? "phone" : "desk"}-step${st.step}.png` }); }
    if (st.shot && st.shot.includes("clerk-phone")) {
      paCaption = !!(await poll(() => page.evaluate(() => !!document.querySelector(".td-clerk-pa")), 4000));
    }
    if (!(await has(page, "tienda-clerk-next"))) break;
    await q(page, "tienda-clerk-next").click();
    await page.waitForTimeout(600);
  }
  check(`fourteen shots in twelve frames (${lines.length} shots, ${frames.size} frames)`, lines.length === 14 && frames.size === 12);
  check("the lines are the user's, verbatim", lines[0].includes("Hi there! Can I help you with something?") && lines[6].includes("Afternoon! El Cabeza, you said?") && lines[13].includes("Is there anything else I can help you with today?"));
  check("the PA page's caption comes up with the phone call", paCaption);
  // Back through it: a swipe, the dots; and a double
  // tap takes only one step.
  const stepNow = () => page.evaluate(() => +document.querySelector('[data-testid="tienda-clerk"]').dataset.step);
  check("no Back button (the dots go back)", !(await has(page, "tienda-clerk-back")));
  await q(page, "tienda-clerk-page-1").click();
  await page.waitForTimeout(600);
  check("the first dot goes back to the first panel", (await stepNow()) === 0);
  await q(page, "tienda-clerk-next").dblclick();
  await page.waitForTimeout(600);
  check("a double tap takes one step, not two", (await stepNow()) === 1, String(await stepNow()));
  const box = await page.locator(".td-clerk-shots").boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(600);
  check("a swipe left goes on", (await stepNow()) === 2, String(await stepNow()));
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(600);
  check("a swipe right goes back", (await stepNow()) === 1, String(await stepNow()));
  await q(page, "tienda-clerk-page-12").click();
  await page.waitForTimeout(600);
  check("the last dot (seen already) goes to the end", (await stepNow()) === 13);
  check("it ends with Stay a while and Go home, confused.", (await has(page, "tienda-clerk-stay")) && (await has(page, "tienda-clerk-go-home")));
  await q(page, "tienda-clerk-stay").click();
  check("stay a while: a slip with the way home", await poll(() => has(page, "tienda-leave-go-home"), 4000) && !(await has(page, "tienda-clerk")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
/* The Pixel Fold's inner screen with its large font (user: "they just
   seem a little bit small. They're not centered vertically ... especially
   on the very last one ... take up as much space as they can without
   having to scroll in any direction"): every frame on the screen, nothing
   to scroll; a frame with no time caption over it, its photograph at
   least 78% of the screen's height (65% before) and centred; the last,
   its two ways out a row under the clipping, the photograph at least 75%
   (57% before), with the story's longer "Go home, confused... with your
   form" too. */
{
  console.log("\nfoldable, large font: each panel as big as the screen allows");
  const ctx = await browser.newContext({ viewport: { width: 898, height: 930 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "html{-webkit-text-size-adjust:150%}"; document.head.append(st); });
    try {
      if (!sessionStorage.getItem("clerk-test-seeded")) {
        sessionStorage.setItem("clerk-test-seeded", "1");
        localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
        localStorage.setItem("el-cabeza:singularity-seen", "1");
        localStorage.setItem("el-cabeza:commercial-aired", "1");
        localStorage.setItem("el-cabeza:special-order-noted", "1");
      }
    } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await poll(() => page.evaluate(() => !!window.__DEN_THREE__), 30000);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__EC_TEST_BACK_TO_STORE__());
  await poll(() => page.evaluate(() => !!window.__TIENDA_THREE__), 30000);
  check("the Games counter scene", !!(await poll(() => has(page, "tienda-clerk"), 15000)));
  await poll(() => page.evaluate(() => [...document.querySelectorAll(".td-clerk-shot")].every((i) => i.complete && i.naturalWidth > 0)), 15000);
  const measure = () => page.evaluate(() => {
    const L = document.querySelector('[data-testid="tienda-clerk"]');
    if (!L) return null;
    const box = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
    const drawn = [...document.querySelectorAll(".td-clerk-print, .td-clerk-when, .td-clerk-tape, .td-clerk-actions")].map((e) => e.getBoundingClientRect());
    const shots = box(".td-clerk-shots"), print = box(".td-clerk-print"), ways = box(".td-clerk-actions");
    return {
      step: +L.dataset.step, frame: +L.dataset.frame, vh: innerHeight, when: !!document.querySelector(".td-clerk-when"),
      photo: Math.round(shots.height), top: Math.round(Math.min(...drawn.map((b) => b.top))), bottom: Math.round(Math.max(...drawn.map((b) => b.bottom))),
      waysBelow: ways ? ways.top >= print.bottom - 1 && ways.bottom <= innerHeight : null,
      scrolls: L.scrollHeight > L.clientHeight + 1 || (getComputedStyle(L).overflowX !== "hidden" && L.scrollWidth > L.clientWidth + 1),
    };
  });
  const rows = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const m = await measure();
    if (!m) break;
    rows.push(m);
    if (!(await has(page, "tienda-clerk-next"))) break;
    await q(page, "tienda-clerk-next").click();
  }
  const plain = rows.filter((m) => !m.when && m.waysBelow === null);
  const off = rows.filter((m) => m.top < 0 || m.bottom > m.vh || m.scrolls);
  check(`every frame on the screen, nothing to scroll (${rows.length} shots)`, rows.length === 14 && off.length === 0, JSON.stringify(off));
  const small = plain.filter((m) => m.photo < 0.78 * m.vh);
  check(`a frame with no time caption: its photograph at least 78% of the screen's height (${plain.map((m) => Math.round((100 * m.photo) / m.vh)).join(", ")}%)`, plain.length >= 10 && small.length === 0, JSON.stringify(small));
  const uneven = plain.filter((m) => Math.abs(m.top - (m.vh - m.bottom)) > 24);
  check("...centred on the screen", uneven.length === 0, JSON.stringify(uneven.map((m) => ({ step: m.step, above: m.top, below: m.vh - m.bottom }))));
  const end = rows[rows.length - 1];
  check(`the last panel: its photograph at least 75% of the screen's height (${end && Math.round((100 * end.photo) / end.vh)}%), the two ways out under the clipping`, !!end && end.step === 13 && end.photo >= 0.75 * end.vh && end.waysBelow === true, JSON.stringify(end));
  // (The story's first time through, the order form in hand: the longer way home.)
  await page.evaluate(() => { document.querySelector('[data-testid="tienda-clerk-go-home"]').textContent = "Go home, confused… with your form"; });
  await page.waitForTimeout(1200);
  const form = await measure();
  check(`...with "Go home, confused… with your form": still at least 75% (${form && Math.round((100 * form.photo) / form.vh)}%), on the screen`, !!form && form.photo >= 0.75 * form.vh && form.waysBelow === true && form.bottom <= form.vh && !form.scrolls, JSON.stringify(form));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
