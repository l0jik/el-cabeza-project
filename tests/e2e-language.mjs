/* The game's languages (chassis/i18n.js; user: "Go ahead with the
   Argentine Spanish translation ... I also want a Vietnamese translation
   included as well in the same fashion"; the pick: "For the language
   picker, go with 2 and 4").

   - The device's language guessed: a Spanish phone (es-AR) gets Spanish
     at once on the title, a Vietnamese one Vietnamese; ?lang= wins over it.
   - The title's EN · ES · VI line under Begin: a press puts every word on
     it in that language, kept for the next visit.
   - The dock's badge (a computer: a foot icon, left of the piece guide's;
     a phone: the end of the "… to move" line): its two letters, a press
     opens the three, a choice changes the game's words at once.
   - In Spanish and Vietnamese, the setup and the corner menu have none of
     their English left; in English, the words are as they always were.

   node tests/e2e-language.mjs */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

const DIST = "file:///home/user/el-cabeza-project/dist";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };
const poll = async (fn, ms = 15000, step = 150) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
};
const DESK = { viewport: { width: 1280, height: 800 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(path, { locale = "en-US", view = DESK, init = null } = {}) {
  const ctx = await browser.newContext({ ...view, locale });
  await ctx.addInitScript((init) => {
    window.__EC_TEST_HOOKS__ = true;
    window.__TIENDA_MUSIC_ONLY__ = "none";
    if (init && init.laws) window.__EC_LAWS__ = init.laws;
  }, init);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${DIST}/${path}`);
  return { ctx, page, errs };
}
const titleLang = (page) => page.evaluate(() => { const r = document.querySelector('[data-testid="title-screen"]'); return r && r.getAttribute("data-lang"); });
const beginWord = (page) => page.evaluate(() => { const b = document.querySelector('[data-testid="title-primary"]'); return b ? b.textContent.trim() : null; });
const htmlLang = (page) => page.evaluate(() => document.documentElement.lang);
// The title's video skipped to its logo (Escape), the menu up.
async function toMenu(page) {
  await poll(() => page.evaluate(() => { const r = document.querySelector('[data-testid="title-screen"]'); return r && r.getAttribute("data-state") === "playing"; }), 10000);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  return poll(() => page.evaluate(() => document.querySelector('[data-testid="title-screen"]').getAttribute("data-state") === "held"), 8000);
}
// The setup's words (the dock's panel), as a player reads them.
const panelText = (page) => page.evaluate(() => { const p = document.querySelector('[data-testid="dock-panel"]'); return p ? p.innerText : ""; });
// English that mustn't be left in the setup in another language ("Manual"
// is Spanish too).
const ENGLISH = [/\bBegin Game\b/i, /\bOpponent\b/i, /\bHuman\b/i, /\bOnline\b/i, /\bStandard\b/i, /\bto move\b/i, /\bReplay a game\b/i, /\bSave & carry\b/i];
const englishIn = (text) => ENGLISH.filter((re) => re.test(text)).map((re) => re.source);

/* ---------------- the title ---------------- */
console.log("\nthe title: the device's language, ?lang=, the EN · ES · VI line");
{
  const { ctx, page, errs } = await open("el-cabeza-nova.html?title", { locale: "es-AR" });
  check("a Spanish (Argentina) device: the title in Spanish", await poll(async () => (await titleLang(page)) === "es"), await titleLang(page));
  check("...Begin says Empezar", /^EMPEZAR$/i.test((await beginWord(page)) || ""), await beginWord(page));
  check("...the page's lang is es-AR", (await htmlLang(page)) === "es-AR", await htmlLang(page));
  check("no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open("el-cabeza-nova.html?title", { locale: "vi-VN" });
  check("a Vietnamese device: the title in Vietnamese", await poll(async () => (await titleLang(page)) === "vi"), await titleLang(page));
  check("...Begin says Bắt đầu", /^BẮT ĐẦU$/i.test((await beginWord(page)) || ""), await beginWord(page));
  await ctx.close();
}
{
  const { ctx, page } = await open("el-cabeza-nova.html?title&lang=vi", { locale: "es-AR" });
  check("?lang=vi wins over a Spanish device", await poll(async () => (await titleLang(page)) === "vi"), await titleLang(page));
  await ctx.close();
}
{
  const { ctx, page, errs } = await open("el-cabeza-nova.html?title");
  check("an English device: the title in English, as it was", await poll(async () => (await titleLang(page)) === "en") && /^BEGIN$/i.test((await beginWord(page)) || ""), `${await titleLang(page)} ${await beginWord(page)}`);
  check("...the menu's up", !!(await toMenu(page)));
  const line = await page.evaluate(() => [...document.querySelectorAll('[data-testid="title-languages"] button')].map((b) => ({ c: b.getAttribute("data-lang"), t: b.textContent, on: b.classList.contains("on") })));
  check("...the line under Begin: EN · ES · VI, EN lit", line.map((b) => b.t).join(" ") === "EN ES VI" && line.find((b) => b.on).c === "en", JSON.stringify(line));
  const under = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="title-primary"]').getBoundingClientRect(), l = document.querySelector('[data-testid="title-languages"]').getBoundingClientRect();
    return l.top >= b.bottom - 2 && l.height > 0 && l.width < b.width * 2;
  });
  check("...under Begin", under);
  await page.locator('[data-testid="title-languages"] button[data-lang="es"]').click();
  check("ES pressed: Begin in Spanish at once", await poll(async () => /^EMPEZAR$/i.test((await beginWord(page)) || ""), 4000), await beginWord(page));
  check("...ES lit", await page.evaluate(() => document.querySelector('[data-testid="title-languages"] button[data-lang="es"]').classList.contains("on")));
  check("...kept", (await page.evaluate(() => localStorage.getItem("el-cabeza:language"))) === "es");
  check("...still the title (a language press doesn't begin)", await page.evaluate(() => !!document.querySelector('[data-testid="title-screen"]') && !document.querySelector("#root canvas")));
  // (The title takes ?title off the address: back with it, as a player's
  // next visit would have the title.)
  await page.goto(`${DIST}/el-cabeza-nova.html?title`);
  check("reloaded: Spanish, as chosen", await poll(async () => (await titleLang(page)) === "es"), await titleLang(page));
  check("no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

/* ---------------- the dock's badge ---------------- */
console.log("\nthe dock's badge: a computer");
{
  const { ctx, page, errs } = await open("el-cabeza-standard.html?lang=es");
  await page.waitForTimeout(2500);
  check("the dock's panel opens", await openDockPanel(page));
  await page.waitForTimeout(700);
  const badge = page.locator('[data-testid="language-badge"]');
  check("one badge, reading ES", (await badge.count()) === 1 && (await badge.innerText()).trim() === "ES", await badge.innerText().catch(() => "none"));
  const where = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="language-badge"]').getBoundingClientRect();
    const p = document.querySelector('[data-testid="dock-panel"]').getBoundingClientRect();
    return { inFoot: b.bottom > p.bottom - 48 && b.top < p.bottom && b.left > p.left && b.right < p.right };
  });
  check("...among the foot icons", where.inFoot, JSON.stringify(where));
  const es = await panelText(page);
  check("the setup in Spanish: no English left", !englishIn(es).length, englishIn(es).join(", "));
  check("...Empezar partida", /EMPEZAR PARTIDA/i.test(es), es.replace(/\n+/g, " | "));
  await badge.click();
  const list = page.locator('[data-testid="language-list"]');
  check("pressed: the three languages, each in its own words", (await poll(async () => (await list.count()) === 1, 3000)) && /Tiếng Việt/i.test(await list.innerText()) && /Español/i.test(await list.innerText()) && /English/i.test(await list.innerText()), await list.innerText().catch(() => "none"));
  const placed = await page.evaluate(() => {
    const l = document.querySelector('[data-testid="language-list"]').getBoundingClientRect(), b = document.querySelector('[data-testid="language-badge"]').getBoundingClientRect();
    return { above: l.bottom <= b.top + 2 && b.top - l.bottom < 40, onScreen: l.top >= 0 && l.left >= 0 && l.right <= innerWidth };
  });
  check("...just above the badge, on the screen", placed.above && placed.onScreen, JSON.stringify(placed));
  await page.locator('[data-testid="language-list"] [data-lang="vi"]').click();
  check("Tiếng Việt chosen: the page's lang is vi", await poll(async () => (await htmlLang(page)) === "vi", 6000), await htmlLang(page));
  check("...the badge reads VI", await poll(async () => (await badge.innerText()).trim() === "VI", 4000));
  const vi = await poll(async () => { const t = await panelText(page); return /BẮT ĐẦU VÁN/i.test(t) && t; }, 6000);
  check("...the setup in Vietnamese at once, no English left", !!vi && !englishIn(vi).length, vi ? englishIn(vi).join(", ") : await panelText(page));
  check("...the list closed, the panel still open", (await list.count()) === 0 && (await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true");
  check("...kept", (await page.evaluate(() => localStorage.getItem("el-cabeza:language"))) === "vi");
  await badge.click();
  await page.locator('[data-testid="language-list"] [data-lang="en"]').click();
  const en = await poll(async () => { const t = await panelText(page); return /Begin Game/i.test(t) && t; }, 6000);
  check("back to English: the words as they always were", !!en && /Opponent/i.test(en) && /to move/i.test(en), en || (await panelText(page)));
  check("no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

console.log("\nthe dock's badge: a phone");
{
  const { ctx, page, errs } = await open("el-cabeza-standard.html?lang=vi", { view: PHONE });
  await page.waitForTimeout(2500);
  check("the dock's panel opens", await openDockPanel(page));
  await page.waitForTimeout(700);
  const at = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="language-badge"]');
    if (!b) return null;
    const r = b.getBoundingClientRect(), line = b.parentElement.getBoundingClientRect();
    return { text: b.innerText.trim(), inLine: r.top >= line.top - 4 && r.bottom <= line.bottom + 4, atEnd: line.right - r.right < 24, lineText: b.parentElement.innerText };
  });
  check("one badge, at the end of the turn line, reading VI", !!at && at.text === "VI" && at.inLine && at.atEnd && /LƯỢT CỦA/i.test(at.lineText), JSON.stringify(at));
  await page.locator('[data-testid="language-badge"]').tap();
  check("tapped: the list", await poll(async () => (await page.locator('[data-testid="language-list"]').count()) === 1, 3000));
  await page.locator('[data-testid="language-list"] [data-lang="es"]').tap();
  check("Español chosen: the turn line in Spanish", !!(await poll(async () => /MUEVE/i.test(await page.evaluate(() => document.querySelector('[data-testid="language-badge"]').parentElement.innerText)), 6000)));
  check("no page errors", !errs.length, errs.join(" | "));
  await ctx.close();
}

/* ---------------- the corner menu ---------------- */
console.log("\nthe corner menu, in play");
for (const [lang, word, english] of [["vi", /Luật/, /\b(laws|each side|board)\b/i], ["es", /Leyes|leyes/, /\b(laws|each side|the board)\b/i]]) {
  const { ctx, page, errs } = await open(`el-cabeza-standard.html?lang=${lang}`, { init: { laws: { slide: true, shoving: true, shoveOwn: false } } });
  await page.waitForTimeout(2500);
  await openDockPanel(page);
  await page.locator('[data-dock-role="begin"]').first().click();
  await page.mouse.move(4, 400);
  await page.waitForTimeout(1500);
  if ((await page.locator('[data-testid="dock-panel"]').getAttribute("data-open")) === "true") { await page.mouse.click(4, 400); await page.waitForTimeout(600); }
  const tab = page.locator('[data-testid="corner-menu-tab"]');
  check(`[${lang}] the corner menu's up`, !!(await poll(async () => (await tab.count()) === 1, 8000)));
  await tab.hover();
  await tab.click();
  const card = await poll(async () => { const c = page.locator('[data-testid="corner-menu-card"]'); return (await c.count()) && (await c.innerText()); }, 4000);
  check(`[${lang}] its card in the language`, !!card && word.test(card) && !english.test(card), card ? card.replace(/\n+/g, " | ") : "no card");
  check(`[${lang}] no page errors`, !errs.length, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
