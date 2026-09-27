/* Nova's sound menu, in Neon (theme.soundChannels: Ambience / Pieces /
   Interface):
   1. Desktop (Neon's page, the same theme Nova switches to): the dock's
      speaker opens the menu; Ambience off silences the bed and leaves the
      pieces and the interface; Pieces off silences the game's own sounds;
      the choice holds across a reload; Escape closes the menu.
   2. Nova on a phone: Standard (the den) offers All sounds, The room,
      Music (the stereo) and Pieces; after the switch to Neon the menu shows All sounds and Neon's
      three channels, and each one switches on its own. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

// ---- 1. desktop ----
{
  console.log("Neon, desktop");
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-neon.html");
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(3500);
  await openDockPanel(page).catch(() => {});
  await q(page, "sound-button").click();
  check("the speaker opens the sound menu", (await q(page, "sound-menu").count()) === 1);
  for (const k of ["sound-all", "sound-ch-ambience", "sound-ch-pieces", "sound-ch-interface"]) {
    check(`...with ${k}, on`, (await q(page, k).getAttribute("aria-checked")) === "true");
  }
  const audio = () => page.evaluate(() => window.__EC_TEST_AUDIO__());
  await q(page, "sound-ch-ambience").click();
  await page.waitForTimeout(700);
  let a = await audio();
  check("Ambience off silences the bed", a.gates && a.gates.ambience < 0.01, JSON.stringify(a.gates));
  check("...and leaves the pieces and the interface", a.channelsOff.pieces === false && a.channelsOff.interface === false, JSON.stringify(a.channelsOff));
  check("...with all sound still on", a.gain > 0.1, String(a.gain));
  check("the dock stays open while you use the menu", (await q(page, "dock-panel").getAttribute("data-open")) === "true");
  await q(page, "sound-ch-pieces").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Escape closes the menu", (await q(page, "sound-menu").count()) === 0);
  // A path reads its new level once something sounds through it: a move.
  await page.evaluate(() => window.__EC_TEST_MOVE__("dark-flaco", "S"));
  await page.waitForTimeout(1500);
  a = await audio();
  check("Pieces off silences the game's own sounds", a.gates.pieces < 0.01, JSON.stringify(a.gates));
  check("...and the interface still sounds", a.gates.interface > 0.99, JSON.stringify(a.gates));

  await page.reload();
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await q(page, "sound-button").click();
  check("after a reload, Ambience is still off", (await q(page, "sound-ch-ambience").getAttribute("aria-checked")) === "false");
  check("...Pieces still off", (await q(page, "sound-ch-pieces").getAttribute("aria-checked")) === "false");
  check("...Interface on", (await q(page, "sound-ch-interface").getAttribute("aria-checked")) === "true");
  await page.mouse.click(500, 60);
  await page.waitForTimeout(300);
  check("a press outside closes the menu", (await q(page, "sound-menu").count()) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ---- 2. Nova on a phone ----
{
  console.log("Nova, phone");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await page.waitForTimeout(2500);
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(300);
  check("Standard (the den): All sounds, The room, Music and Pieces", (await q(page, "shell-menu-sound").count()) === 1 && (await q(page, "shell-menu-sound-room").count()) === 1 && (await q(page, "shell-menu-sound-stereo").count()) === 1 && (await q(page, "shell-menu-sound-pieces").count()) === 1);
  await q(page, "shell-menu-switch-theme").click();
  await waitFor(async () => (await page.locator(".ec-hold-modal-word").count()) > 0);
  await page.locator(".ec-hold-modal-word").click({ force: true });
  await waitFor(async () => (await q(page, "shell-anomaly").count()) > 0, 12000);
  await page.waitForTimeout(800);
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(400);
  check("Neon: All sounds and the three channels", (await page.locator("[data-testid=shell-menu-sound] >> text=All sounds").count()) === 1
    && (await page.locator('[data-testid^="shell-menu-sound-"]').count()) === 3);
  const sw = q(page, "shell-menu-sound-ambience");
  await sw.scrollIntoViewIfNeeded();
  await sw.click();
  await page.waitForTimeout(200);
  check("Ambience switches off on its own", (await sw.getAttribute("aria-checked")) === "false" && (await q(page, "shell-menu-sound-pieces").getAttribute("aria-checked")) === "true");
  check("...and All sounds stays on", (await q(page, "shell-menu-sound").getAttribute("aria-checked")) === "true");
  await sw.click();
  await page.waitForTimeout(200);
  check("...and back on", (await sw.getAttribute("aria-checked")) === "true");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
