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
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
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
  await openDockPanel(page);
  await poll(() => has(page, "story-back-to-store"), 10000);
  await q(page, "story-back-to-store").click();
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
  const loaded = await poll(() => page.evaluate(() => {
    const ims = [...document.querySelectorAll(".td-clerk-shot")];
    return ims.length === 15 && ims.every((i) => i.complete && i.naturalWidth === 368 && i.naturalHeight === 474) ? ims.length : null;
  }), 15000);
  check(`every photograph loads (${loaded || 0} of 15)`, loaded === 15);
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
    if (shots && [0, 1, 6, 7, 14].includes(st.step)) { await page.waitForTimeout(1100); await page.screenshot({ path: `${shots}/${phone ? "phone" : "desk"}-step${st.step}.png` }); }
    if (st.shot && st.shot.includes("clerk-phone")) {
      paCaption = !!(await poll(() => page.evaluate(() => !!document.querySelector(".td-clerk-pa")), 4000));
    }
    if (!(await has(page, "tienda-clerk-next"))) break;
    await q(page, "tienda-clerk-next").click();
    await page.waitForTimeout(250);
  }
  check(`fifteen shots in twelve frames (${lines.length} shots, ${frames.size} frames)`, lines.length === 15 && frames.size === 12);
  check("the lines are the user's, verbatim", lines[0].includes("Hi there! Can I help you with something?") && lines[7].includes("Afternoon! El Cabeza, you said?") && lines[14].includes("Is there anything else I can help you with today?"));
  check("the PA page's caption comes up with the phone call", paCaption);
  check("it ends with Stay a while and Go home, confused.", (await has(page, "tienda-clerk-stay")) && (await has(page, "tienda-clerk-go-home")));
  await q(page, "tienda-clerk-stay").click();
  check("stay a while: a slip with the way home", await poll(() => has(page, "tienda-leave-go-home"), 4000) && !(await has(page, "tienda-clerk")));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
