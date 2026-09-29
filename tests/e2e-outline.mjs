/* The pieces' outline shells sit a hair above the board, never flush
   with it (Tienda and Standard, themes/wood-set.js SHELL_LIFT; Cromo,
   Lluvia and the Lab's outlined directions the same).

   Flush, the strip of the shell's floor that shows in front of a piece's
   base was the board's own plane, drawn from thin wedge triangles, and at
   a low view the board won in patches: the line under a Cabeza broke into
   dashes that crawled as the view turned (a user's video of Tienda). So:
   at rest every shell's floor is SHELL_LIFT above the board and its body
   sits on the board; while a block rolls, the chassis has stripped the
   whole offset (theme.outlineYOffset), so the shell is centred on the
   body as it always was mid-roll; and once it lands, the new shell is
   lifted again. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";
import { SHELL_LIFT } from "../themes/wood-set.js";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

// Each piece's body and shell floor heights, in board space.
const floors = (page, hook) => page.evaluate((hook) => {
  const t = typeof window[hook] === "function" ? window[hook]() : window[hook];
  const out = {};
  t.boardGroup.updateMatrixWorld(true);
  const inv = t.boardGroup.matrixWorld.clone().invert();
  t.pieceGroup.children.forEach((o) => {
    const kind = o.userData && o.userData.kind;
    if (kind !== "piece" && kind !== "shell") return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    (out[o.userData.pieceId] = out[o.userData.pieceId] || {})[kind] = bb.min.y;
  });
  return out;
}, hook);

async function run(name, hook, init = null) {
  console.log(`\n${name}`);
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; window.__TIENDA_MUSIC_ONLY__ = "none"; });
  if (init) await page.addInitScript(init);
  await page.goto(`file:///home/user/el-cabeza-project/dist/el-cabeza-${name}.html`);
  await page.waitForTimeout(2500);
  // Lluvia opens on its descent: straight to the board.
  const straight = page.locator('[data-testid="lluvia-straight-to-board"]');
  if (await straight.count()) { await straight.click(); await page.waitForTimeout(1200); }
  const lid = page.locator('[data-testid="tienda-open-box"]');
  if (await lid.count()) { await lid.click(); await page.waitForTimeout(2000); }
  for (let i = 0; i < 40 && !(await page.evaluate((h) => !!window[h] && !!(typeof window[h] === "function" ? window[h]() : window[h]).pieceGroup, hook)); i++) await page.waitForTimeout(250);

  const rest = await floors(page, hook);
  const ids = Object.keys(rest);
  const lifted = ids.filter((id) => Math.abs(rest[id].shell - SHELL_LIFT) < 0.0005);
  const seated = ids.filter((id) => Math.abs(rest[id].piece) < 0.0005);
  check(`every shell's floor is ${SHELL_LIFT} above the board (${lifted.length}/${ids.length})`, ids.length >= 10 && lifted.length === ids.length,
    JSON.stringify(ids.filter((id) => !lifted.includes(id)).map((id) => [id, rest[id].shell])));
  check(`every piece sits on the board (${seated.length}/${ids.length})`, seated.length === ids.length);

  // A roll: the Chato (two squares long) rolls forward.
  await openDockPanel(page);
  await page.locator('[data-testid="dock-panel"] button', { hasText: /Begin Game|Try a Game/ }).first().click();
  await page.waitForTimeout(1500);
  const mover = await page.evaluate(() => (window.__EC_TEST_PIECES__ || []).find((p) => p.owner === "dark" && p.type === "chato"));
  const moved = await page.evaluate((id) => window.__EC_TEST_MOVE__(id, "S"), mover.id);
  // Mid-roll the shell and body share the roll's pivot; the shell must be
  // centred on the body (the whole at-rest lift stripped).
  let mid = null;
  for (let i = 0; i < 200 && !mid; i++) {
    mid = await page.evaluate(({ hook, id }) => {
      const t = typeof window[hook] === "function" ? window[hook]() : window[hook];
      let mesh = null, shell = null;
      t.boardGroup.traverse((o) => { if (o.userData && o.userData.pieceId === id) { if (o.userData.kind === "piece") mesh = o; if (o.userData.kind === "shell") shell = o; } });
      if (!mesh || !shell || mesh.parent === t.pieceGroup || shell.parent !== mesh.parent) return null;
      return { dx: shell.position.x - mesh.position.x, dy: shell.position.y - mesh.position.y, dz: shell.position.z - mesh.position.z };
    }, { hook, id: mover.id });
    if (!mid) await page.waitForTimeout(20);
  }
  check("a block rolls", moved && !!mid);
  if (mid) check("mid-roll the shell is centred on the body (the lift stripped)", Math.hypot(mid.dx, mid.dy, mid.dz) < 1e-6, JSON.stringify(mid));
  await page.waitForTimeout(2500);
  const after = await floors(page, hook);
  check("after the roll the new shell is lifted again", after[mover.id] && Math.abs(after[mover.id].shell - SHELL_LIFT) < 0.0005, JSON.stringify(after[mover.id]));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

await run("tienda", "__TIENDA_THREE__");
await run("standard", "__DEN_THREE__");
await run("cromo", "__EC_TEST_THREE__");
await run("lluvia", "__EC_TEST_THREE__");
// The Lab: De Stijl, one of its directions with an outline.
await run("lab", "__EC_TEST_THREE__", () => { try { localStorage.setItem("el-cabeza:lab-theme", "destijl"); } catch (e) { /* none */ } });
await browser.close();
console.log(failures === 0 ? "\nOUTLINE E2E PASSED" : `\nOUTLINE E2E FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
