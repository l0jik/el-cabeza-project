/* ABOUT's "The original El Cabeza" link (chassis/ElCabeza3D.jsx
   playOriginal): it closes INFO and sets up a plain game with the basic
   rules only. On the Futuris page, laws switched on at boot (window.__EC_LAWS__)
   are cleared. In Nova (apps/unified.jsx), taken from the Futuris theme, it
   also switches back to the Standard theme. And the disclaimer at ABOUT's
   foot, last of all, under a world's sound credits where it has them. */
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--allow-file-access-from-files"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const openAbout = (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "about" } })));
const lawsInPlay = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("el-cabeza:open-rules", { detail: { tab: "game" } })));
  await page.waitForTimeout(300);
  const n = await page.locator('[data-testid^="rules-game-law-"]').count();
  await page.mouse.click(6, 6);
  await page.waitForTimeout(400);
  return n;
};
// The INFO title's colour tells the themes apart (Standard: dark ink on
// paper; Futuris: pale on glass).
const theme = (page) => page.evaluate(() => {
  const h = document.querySelector('[data-testid="info-overlay"] h2');
  const [r] = getComputedStyle(h).color.match(/\d+/g).map(Number);
  return r > 128 ? "futuris" : "standard";
});

{
  console.log("[futuris page]");
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
  await page.addInitScript(() => { try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } }); // been to the Singularity: the extras are open (engine/journey.js; e2e-journey.mjs tests the lock)
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_LAWS__ = { threeActions: true, slide: true, shoving: true }; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-futuris.html");
  await page.waitForTimeout(1500);
  check("the game starts with three laws on", (await lawsInPlay(page)) === 3);
  await openAbout(page);
  await page.waitForTimeout(400);
  const text = await page.locator('[data-testid="info-body"]').textContent();
  check("ABOUT says the original is the basic rules alone", /The original El Cabeza is played with its basic rules alone/.test(text));
  // The disclaimer, at the bottom (user: "put the disclaimer at the bottom
  // of the About tab"): unofficial, non-commercial, and whom it isn't
  // affiliated with or endorsed by, named.
  const last = await page.evaluate(() => { const ps = [...document.querySelectorAll('[data-testid="info-body"] p')]; const l = ps[ps.length - 1]; return l ? { id: l.getAttribute("data-testid"), text: l.textContent.replace(/\s+/g, " "), shown: l.getBoundingClientRect().height > 0 } : null; });
  check("ABOUT ends with the disclaimer", !!last && last.id === "info-disclaimer" && last.shown, JSON.stringify(last));
  check("...unofficial and non-commercial, not affiliated with or endorsed by the game's creators or the magazine", !!last && /unofficial, non-commercial implementation/.test(last.text) && /not affiliated with or endorsed by them/.test(last.text) && /Jaime Poniachik and Enrique Lindenbaum/.test(last.text) && /Revista Humor y Juegos/.test(last.text), last && last.text);
  await page.locator('[data-testid="play-original"]').click();
  await page.waitForTimeout(800);
  check("the link closes INFO", (await page.locator('[data-testid="info-overlay"]').getAttribute("data-open")) === "false");
  const cue = await page.evaluate(() => {
    const a = window.__EC_LAST_ORIGINAL_CUE__;
    return a ? { src: a.src.split("/").pop(), playing: !a.paused, duration: a.duration } : null;
  });
  // (The cue is a file beside the page now, no longer inlined in it:
  // build.js COMMON_FILES, the efficiency round.)
  check("...and plays the muzak cue (about 5.5 s)", !!cue && cue.src === "el-cabeza-original-cue.mp3" && cue.playing && cue.duration > 5 && cue.duration < 6, JSON.stringify(cue));
  check("...and the game now has no laws", (await lawsInPlay(page)) === 0);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("[nova]");
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
  await page.addInitScript(() => { try { localStorage.setItem("el-cabeza:singularity-seen", "1"); } catch (e) { /* none */ } }); // been to the Singularity: the extras are open (engine/journey.js; e2e-journey.mjs tests the lock)
  // ...and past the commercial and its special order (as the other den
  // tests seed it): otherwise the den holds everything but the order card
  // until it's answered, the masthead's hold included.
  await page.addInitScript(() => { try { localStorage.setItem("el-cabeza:commercial-aired", "1"); localStorage.setItem("el-cabeza:special-order-noted", "1"); } catch (e) { /* none */ } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  // The game's bought, so Nova opens at home (apps/novaStory.jsx).
  await page.addInitScript(() => { try { localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); } catch (e) { /* none */ } });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  await page.waitForTimeout(2000);
  check("Nova opens on the Standard theme", (await theme(page)) === "standard");
  // (the den credits its recorded sounds: the disclaimer comes under them)
  await openAbout(page);
  await page.waitForTimeout(400);
  const tail = await page.evaluate(() => [...document.querySelectorAll('[data-testid="info-body"] p')].slice(-2).map((p) => p.getAttribute("data-testid")));
  check("the den's ABOUT: the disclaimer last, under the sound credits", tail[0] === "info-sound-credits" && tail[1] === "info-disclaimer", JSON.stringify(tail));
  await page.mouse.click(6, 6);
  await page.waitForTimeout(500);
  // Hold the masthead, then confirm CONNECT: over to Futuris. The hold
  // is the invisible zone kept over the title each frame (apps/unified.jsx):
  // pressed only once it's there, on top, under the pointer (on a slow
  // runner the frame that puts it there can come late; CI, 2026-10-17,
  // the hold never began and CONNECT never came).
  await page.evaluate(() => document.fonts && document.fonts.ready);
  let spot = null;
  for (let i = 0; i < 40 && !spot; i++) {
    spot = await page.evaluate(() => {
      const zone = document.querySelector(".ec-masthead-hold-zone");
      const title = document.querySelector(".ec-title");
      if (!zone || !title) return null;
      const t = title.getBoundingClientRect(), z = zone.getBoundingClientRect();
      const x = t.left + t.width / 2, y = t.top + t.height / 2;
      if (!t.width || x < z.left || x > z.right || y < z.top || y > z.bottom) return null;
      return document.elementFromPoint(x, y) === zone ? { x, y } : null;
    });
    if (!spot) await page.waitForTimeout(250);
  }
  const under = spot ? "" : await page.evaluate(() => { const t = document.querySelector(".ec-title"); if (!t) return "no title"; const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el ? `${el.tagName.toLowerCase()}.${el.className}` : "nothing"; });
  check("the masthead's hold zone is over the title, on top", !!spot, under);
  const box = await page.locator("h1").first().boundingBox();
  const at = spot || { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(4400);
  await page.mouse.up();
  await page.locator(".ec-hold-modal-word").waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  await page.locator(".ec-hold-modal-word").click({ force: true });
  await page.waitForTimeout(3500);
  check("holding the masthead and confirming switches to Futuris", (await theme(page)) === "futuris");
  await openAbout(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="play-original"]').click();
  await page.waitForTimeout(3500);
  check("the original-game link brings Nova back to Standard", (await theme(page)) === "standard");
  check("...with the muzak cue still playing through the theme switch",
    await page.evaluate(() => !!window.__EC_LAST_ORIGINAL_CUE__ && !window.__EC_LAST_ORIGINAL_CUE__.paused));
  check("...with INFO closed", (await page.locator('[data-testid="info-overlay"]').getAttribute("data-open")) === "false");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nORIGINAL GAME LINK E2E PASSED" : `\nORIGINAL GAME LINK E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
