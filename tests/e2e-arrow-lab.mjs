/* The slide-arrow lab (?arrowlab; user, 2026-10-29: "Slide drag indicator
   arrows should be more visible, like always on top... But let's test 5
   implementations to see the best way before making any changes";
   chassis/arrow-lab.js).

   In Futuris with Slide on, a Chato picked and dragged east. Without the
   lab, today's arrow lights and there's no lab bar. With ?arrowlab=1,
   each of the five in turn (the bar's ›): the drag shows it, for the
   Chato and east, drawn the way it says (over everything, through what
   hides it, or on the page, there at least 96 px long), today's arrow
   unlit; dragged back, it's gone, and nothing has moved. One showing
   while the version's changed becomes the new one at once. Let go while
   it shows, the Chato slides as ever. A reload keeps the lab and the
   version last looked at; the bar's ✕ leaves it, and today's arrow is
   back.

   node tests/e2e-arrow-lab.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const URL = "file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let fails = 0, checks = 0;
const check = (name, ok, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`); };
const P = (id, type, owner, row, col, w, h, z) => ({ id, type, owner, row, col, w, h, z });
const POSITION = [
  P("dark-cabeza", "cabeza", "dark", 0, 0, 1, 1, 1), P("light-cabeza", "cabeza", "light", 9, 9, 1, 1, 1),
  P("dark-chato", "chato", "dark", 4, 3, 1, 2, 2),
];

const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
await ctx.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__EC_LAWS__ = { slide: true, threeActions: true }; });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

// A game begun with the Chato on (4, 3), the Chato picked. Where it is on
// the screen, and a drag's way east (a square and a half).
async function begin(query = "") {
  await page.goto(`${URL}${query}`);
  await page.waitForTimeout(1500);
  await page.evaluate((ps) => window.__EC_TEST_SET_PIECES__(ps), POSITION);
  await page.waitForTimeout(300);
  await openDockPanel(page);
  await page.locator("button", { hasText: /Begin Game|Try a Game/ }).click();
  await page.waitForTimeout(1200);
  const from = await page.evaluate(() => window.__EC_TEST_SCREEN_POS__("dark-chato"));
  const east = await page.evaluate(() => { const a = window.__EC_TEST_CUBE_POS__(4, 3), b = window.__EC_TEST_CUBE_POS__(4, 4); return { x: (b.x - a.x) * 1.5, y: (b.y - a.y) * 1.5 }; });
  await page.mouse.click(from.x, from.y);
  await page.waitForTimeout(400);
  return { from, east };
}
const out = async ({ from, east }) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + (east.x * i) / 8, from.y + (east.y * i) / 8);
  await page.waitForTimeout(250);
};
// (Back to where it began, inside the dead zone: no slide chosen.)
const back = async ({ from, east }) => {
  for (let i = 7; i >= 0; i--) await page.mouse.move(from.x + (east.x * i) / 8, from.y + (east.y * i) / 8);
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(300);
};
const state = () => page.evaluate(() => {
  const t = window.__EC_TEST_THREE__();
  const svg = document.querySelector('[data-testid="arrow-lab-screen"]');
  const bar = document.querySelector('[data-testid="arrow-lab-bar"]');
  const chato = window.__EC_TEST_PIECES__.find((p) => p.id === "dark-chato");
  return {
    today: t.slideArrowGroup.visible,
    lab: window.__ARROW_LAB__ || null,
    object: !!t.boardGroup.getObjectByName("arrow-lab"),
    bar: bar ? bar.dataset.version : null,
    svg: svg ? { from: svg.dataset.from, to: svg.dataset.to } : null,
    at: chato && [chato.row, chato.col],
  };
});

console.log("\n[today's arrow, no lab]");
{
  const g = await begin();
  await out(g);
  const s = await state();
  check("a drag east lights today's arrow; no lab bar, no lab", s.today && s.bar === null && s.lab === null && !s.object, JSON.stringify(s));
  await back(g);
  const b = await state();
  check("...dragged back, it's out and the Chato hasn't moved", !b.today && b.at.join() === "4,3", JSON.stringify(b));
}

console.log("\n[the lab, ?arrowlab=1]");
const DRAWN = { 1: "over", 2: "through", 3: "over", 4: "over", 5: "page" };
{
  const g = await begin("?arrowlab=1");
  const about = await page.locator('[data-testid="arrow-lab-about"]').innerText();
  check("the bar's on version 1, On top, and says how to see it", (await state()).bar === "1" && /flat arrow lying on the piece's top/.test(about) && /pick a piece of yours/.test(about), about);
  for (let n = 1; n <= 5; n++) {
    await out(g);
    const s = await state();
    const lab = s.lab || {};
    check(`${n}: the drag shows it for the Chato, east, drawn ${DRAWN[n]}; today's arrow unlit`,
      lab.version === n && lab.shown && lab.shown.piece === "dark-chato" && lab.shown.dir.join() === "0,1" && lab.shown.drawn === DRAWN[n] && !s.today && s.object === (n !== 5), JSON.stringify(s));
    if (n === 5) {
      const [ax, ay] = s.svg ? s.svg.from.split(",").map(Number) : [0, 0], [bx, by] = s.svg ? s.svg.to.split(",").map(Number) : [0, 0];
      check("...on the page over the game, at least 96 px long", !!s.svg && Math.hypot(bx - ax, by - ay) >= 95, JSON.stringify(s.svg));
    }
    await back(g);
    const b = await state();
    check(`${n}: dragged back, it's gone; the Chato hasn't moved`, b.lab && b.lab.shown === null && !b.object && !b.svg && !b.today && b.at.join() === "4,3", JSON.stringify(b));
    if (n < 5) {
      await page.locator('[data-testid="arrow-lab-next"]').click();
      await page.waitForTimeout(200);
      check(`› to version ${n + 1}`, (await state()).bar === String(n + 1));
    }
  }
  // One showing becomes the next one at once (5 › 1).
  await out(g);
  await page.evaluate(() => document.querySelector('[data-testid="arrow-lab-next"]').click());
  await page.waitForTimeout(250);
  const swapped = await state();
  check("changed while it shows: version 1 at once, over everything, the page's arrow gone", swapped.bar === "1" && swapped.lab.shown && swapped.lab.shown.drawn === "over" && swapped.object && !swapped.svg, JSON.stringify(swapped));
  // Let go: the slide's played as ever.
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const slid = await state();
  check("let go while it shows: the Chato slides a square east, the lab's arrow gone", slid.at.join() === "4,4" && slid.lab.shown === null && !slid.object, JSON.stringify(slid));
  await page.locator('[data-testid="arrow-lab-next"]').click();
  await page.locator('[data-testid="arrow-lab-next"]').click();
  await page.waitForTimeout(200);
}

console.log("\n[kept, and left]");
{
  await begin();
  check("a reload without ?arrowlab keeps the lab, on the version last looked at (3)", (await state()).bar === "3");
  await Promise.all([page.waitForNavigation(), page.locator('[data-testid="arrow-lab-exit"]').click()]);
  const g = await begin();
  await out(g);
  const s = await state();
  check("✕ leaves it: no bar, and a drag lights today's arrow again", s.bar === null && s.lab === null && s.today, JSON.stringify(s));
  await back(g);
}

check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
await browser.close();
console.log(`\narrow lab: ${checks} checks, ${fails} failed`);
if (fails) { console.log("ARROW LAB E2E FAILED"); process.exit(1); }
