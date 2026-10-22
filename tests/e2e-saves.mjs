/* Save & carry (chassis/saves.js; user: "saves that survive clearing the
   browser or carry to another device"; chose a cloud code plus a file):
   everything this browser keeps for the game, as a file the browser
   offers to keep and reads back, and as a code on the game's own server
   (server/relay.js, run here on a free port and reached with ?relay=).

   - The sheet, from the dock (Save & carry) and the phone's menu.
   - With no server set up (the placeholder address): the cloud part says
     so; the file still works.
   - A save downloaded holds the game's keys, and loaded in a fresh
     browser puts them back (the page starts over on them).
   - Saved to the cloud: a code; typed on another browser it restores;
     saved again, the same code is updated; a link with ?restore=CODE
     restores on any page without the sheet.

   node tests/e2e-saves.mjs */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDockPanel } from "./dock-helpers.mjs";

const D = "file:///home/user/el-cabeza-project/dist";
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? "  " + extra : ""}`); if (!ok) fails++; };
const poll = async (fn, ms = 8000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, step)); } };

// The server, on a free port, its saves in a scratch folder.
const dataDir = mkdtempSync(join(tmpdir(), "ec-saves-"));
// (or, with RELAY set, a server already running: the same one on Cloudflare
// under wrangler dev, RELAY=ws://127.0.0.1:8790; see server/README.md)
const relay = process.env.RELAY ? null : spawn(process.execPath, ["server/relay.js", "--port", "0", "--data", dataDir], { cwd: "/home/user/el-cabeza-project", stdio: ["ignore", "pipe", "pipe"] });
const port = relay ? await new Promise((resolve, reject) => {
  let out = "";
  relay.stdout.on("data", (d) => { out += d; const m = /listening on (\d+)/.exec(out); if (m) resolve(parseInt(m[1], 10)); });
  relay.stderr.on("data", (d) => { out += d; });
  relay.on("exit", () => reject(new Error("relay exited: " + out)));
  setTimeout(() => reject(new Error("relay never listened: " + out)), 15000);
}) : 0;
const RELAY = process.env.RELAY || `ws://127.0.0.1:${port}`;
console.log(relay ? `relay on ${port}` : `relay at ${RELAY}`);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--allow-file-access-from-files"] });
const SEED = { "el-cabeza:show-points": "0", "el-cabeza:check-alert": "0", "el-cabeza:last-world": "noir", "elcabeza.ciudad.time": "night" };
async function open({ page: file = "standard", seed = null, query = "", relayOn = true }) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, acceptDownloads: true });
  await ctx.addInitScript(({ s }) => { window.__EC_TEST_HOOKS__ = true; if (s) Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, { s: seed });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const q = [relayOn ? `relay=${encodeURIComponent(RELAY)}` : "", query].filter(Boolean).join("&");
  await page.goto(`${D}/el-cabeza-${file}.html${q ? "?" + q : ""}`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__), 30000, 250);
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
const keys = (page) => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(el-cabeza:|elcabeza\.|ec:)/.test(k)) o[k] = localStorage.getItem(k); } return o; });
async function openSheet(page) {
  await openDockPanel(page);
  await page.locator('[data-testid="open-saves"]').click();
  return !!(await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="saves-sheet"]'); return e && getComputedStyle(e.parentElement).visibility === "visible"; }), 4000));
}
const note = (page) => page.evaluate(() => { const e = document.querySelector('[data-testid="saves-note"]'); return e ? { text: e.textContent, kind: e.getAttribute("data-kind") } : null; });

console.log("No server set up");
{
  const { ctx, page, errs } = await open({ page: "standard", relayOn: false, seed: SEED });
  check("the sheet opens from the dock", await openSheet(page));
  const n = await page.locator('[data-testid="saves-cloud-note"]').textContent().catch(() => "");
  check("...the cloud says it isn't set up yet", /isn.t set up yet/.test(n), n);
  check("...and offers no cloud buttons", (await page.locator('[data-testid="saves-cloud-save"]').count()) === 0);
  check("the file's buttons are there", (await page.locator('[data-testid="saves-download"]').count()) === 1 && (await page.locator('[data-testid="saves-load"]').count()) === 1);
  await page.keyboard.press("Escape");
  check("Escape puts it away", !!(await poll(() => page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="saves-sheet"]').parentElement).visibility === "hidden"), 3000)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

let code = "", file = "";
console.log("A save made: the file, and the cloud");
{
  const { ctx, page, errs } = await open({ page: "standard", seed: SEED });
  check("the sheet opens", await openSheet(page));
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.locator('[data-testid="saves-download"]').click()]);
  file = join(dataDir, dl.suggestedFilename());
  await dl.saveAs(file);
  const save = JSON.parse(readFileSync(file, "utf8"));
  check("a file downloaded, named for the day", /^el-cabeza-save-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check("...a save of the game's, with its version", save.app === "el-cabeza" && save.format === 1 && /^\d+\.\d+\.\d+$/.test(save.version), JSON.stringify({ app: save.app, format: save.format, version: save.version }));
  check("...holding the keys this browser keeps", Object.entries(SEED).every(([k, v]) => save.keys[k] === v) && Object.keys(save.keys).length >= Object.keys(SEED).length, JSON.stringify(Object.keys(save.keys)));
  check("...and none of anyone else's", Object.keys(save.keys).every((k) => /^(el-cabeza:|elcabeza\.|ec:)/.test(k)));
  check("...the sheet says so", /Saved as el-cabeza-save/.test((await note(page)).text));
  await page.locator('[data-testid="saves-cloud-save"]').click();
  const got = await poll(async () => { const n = await note(page); return n && /^Saved as [A-Z2-9]{4}-[A-Z2-9]{4}\./.test(n.text) ? n : null; }, 8000);
  check("saved to the cloud: a code", !!got, JSON.stringify(await note(page)));
  code = await page.locator('[data-testid="saves-code"]').textContent().catch(() => "");
  check("...shown with its copy buttons", /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) && (await page.locator('[data-testid="saves-copy-link"]').count()) === 1, code);
  check("...kept in this browser", !!(await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("el-cabeza:cloud-save")).code; } catch (e) { return null; } })));
  // a change, saved again: the same code
  await page.evaluate(() => localStorage.setItem("el-cabeza:show-points", "1"));
  await page.locator('[data-testid="saves-cloud-save"]').click();
  const again = await poll(async () => { const n = await note(page); return n && /^Updated /.test(n.text) ? n : null; }, 8000);
  check("saved again: the same code, updated", !!again && again.text.includes(code), JSON.stringify(await note(page)));
  await page.evaluate(() => localStorage.setItem("el-cabeza:show-points", "0"));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("Restored from the code, on another browser and page");
{
  const { ctx, page, errs } = await open({ page: "futuris" });
  const before = await keys(page);
  check("a fresh browser: none of the keys", !("el-cabeza:last-world" in before) && !("elcabeza.ciudad.time" in before));
  check("the sheet opens", await openSheet(page));
  await page.locator('[data-testid="saves-code-input"]').fill(code.toLowerCase().replace("-", ""));
  await page.locator('[data-testid="saves-cloud-restore"]').click();
  const after = await poll(async () => { const k = await keys(page); return k["el-cabeza:last-world"] === "noir" ? k : null; }, 15000);
  check("the code restores them (typed in any case, without the dash)", !!after && after["elcabeza.ciudad.time"] === "night" && after["el-cabeza:show-points"] === "1", JSON.stringify(after));
  check("...and the page starts over on them", !!(await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__ && performance.getEntriesByType("navigation").length > 0 && document.visibilityState === "visible"), 20000)));
  check("...the cloud code carried with them", await page.evaluate((c) => { try { return JSON.parse(localStorage.getItem("el-cabeza:cloud-save")).code === c; } catch (e) { return false; } }, code));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("A link with the code");
{
  const { ctx, page, errs } = await open({ page: "cromo", query: `restore=${code}` });
  const after = await poll(async () => { const k = await keys(page); return k["el-cabeza:last-world"] === "noir" ? k : null; }, 20000);
  check("?restore=CODE restores on any page", !!after && after["elcabeza.ciudad.time"] === "night", JSON.stringify(after));
  const url = await poll(() => page.evaluate(() => (location.search.includes("restore=") ? null : location.href)), 20000);
  check("...and the word's gone from the address", !!url, url);
  await openSheet(page);
  const n = await note(page);
  check("...the sheet notes it", !!n && /^Restored \d+ things? from/.test(n.text), JSON.stringify(n));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("The file loaded on another browser");
{
  const { ctx, page, errs } = await open({ page: "standard", relayOn: false });
  check("a fresh browser: none of the keys", !("el-cabeza:last-world" in (await keys(page))));
  check("the sheet opens", await openSheet(page));
  await page.locator('[data-testid="saves-file"]').setInputFiles(file);
  const after = await poll(async () => { const k = await keys(page); return k["el-cabeza:last-world"] === "noir" ? k : null; }, 15000);
  check("the file puts the keys back", !!after && after["el-cabeza:show-points"] === "0" && after["elcabeza.ciudad.time"] === "night", JSON.stringify(after));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("A wrong code, a wrong file");
{
  const { ctx, page, errs } = await open({ page: "standard" });
  await openSheet(page);
  await page.locator('[data-testid="saves-code-input"]').fill("ZZZZ-ZZZZ");
  await page.locator('[data-testid="saves-cloud-restore"]').click();
  const n = await poll(async () => { const x = await note(page); return x && x.kind === "err" ? x : null; }, 8000);
  check("an unknown code is refused, nothing touched", !!n && /no save with that code/.test(n.text) && !("el-cabeza:last-world" in (await keys(page))), JSON.stringify(n));
  await page.locator('[data-testid="saves-code-input"]').fill("abc");
  await page.locator('[data-testid="saves-cloud-restore"]').click();
  const n2 = await poll(async () => { const x = await note(page); return x && /eight letters/.test(x.text) ? x : null; }, 4000);
  check("a short code is refused", !!n2, JSON.stringify(await note(page)));
  await page.locator('[data-testid="saves-file"]').setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":"world"}') });
  const n3 = await poll(async () => { const x = await note(page); return x && /isn.t an El Cabeza save/.test(x.text) ? x : null; }, 4000);
  check("a file that isn't a save is refused", !!n3, JSON.stringify(await note(page)));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

console.log("The phone's menu");
{
  // (The phone's bar layout: Nova's, at home, with the bar chosen.)
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__EC_TEST_HOOKS__ = true;
    try {
      localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true }));
      localStorage.setItem("el-cabeza:nova-layout", "bar");
      ["el-cabeza:singularity-seen", "el-cabeza:commercial-aired", "el-cabeza:special-order-noted"].forEach((k) => localStorage.setItem(k, "1"));
    } catch (e) { /* none */ }
  });
  const page = await ctx.newPage();
  await page.goto(`${D}/el-cabeza-nova.html`);
  await poll(() => page.evaluate(() => !!window.__EC_TEST_SET_PIECES__), 30000, 250);
  await page.waitForTimeout(800);
  await page.locator('[data-testid="shell-menu-button"]').first().click();
  const row = page.locator('[data-testid="shell-menu-saves"]');
  const there = !!(await poll(async () => (await row.count()) === 1, 4000));
  check("Save & carry in the phone's menu", there);
  if (there) {
    await row.click();
    check("...opens the sheet", !!(await poll(() => page.evaluate(() => { const e = document.querySelector('[data-testid="saves-sheet"]'); return e && getComputedStyle(e.parentElement).visibility === "visible"; }), 4000)));
  }
  await ctx.close();
}

await browser.close();
if (relay) relay.kill();
console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
process.exit(fails ? 1 : 0);
