/* Standard's den (themes/den-room.js, den-fx.js, den-audio.js):
   1. The room is built round the board: the pit's sofas, the four walls,
      the ceiling, the fire, the coffee table with the box on it, in a
      few dozen draw calls.
   2. Whatever the camera has gone behind steps aside: a sofa whose back
      is between a low camera and the board, a wall the camera is past,
      the ceiling when the camera is above it. Back in the pit, all of
      them are there again.
   3. The sound menu: The room and Pieces, each switched on its own.
   4. The stereo console: "Choose music" in the sound menu opens the music
      panel (both sources empty until the tracks come), the camera goes over
      to the console and comes back when it closes; a track lent by the
      test plays on the record player (the platter turns) and stops; a tap
      on the turntable in the room opens the panel too.
   5. The room's sound: the fire is louder from the fireplace's side of the
      pit than from the far side; the clock's hour chime plays.
   6. The south wall's doorway opens onto a hall; the coffee table has its
      snack mix, piece by piece.
   7. Nova (phone menu): its "Choose music" opens the music panel;
      Standard (the den) to Neon, where the den is gone, and back to
      Standard, where it's built again. */
import { chromium } from "playwright";
import { openDockPanel } from "./dock-helpers.mjs";

// A second of a soft tone, as a WAV data URL: the test's record.
function toneWav() {
  const rate = 22050, n = rate, data = Buffer.alloc(44 + n * 2);
  data.write("RIFF", 0); data.writeUInt32LE(36 + n * 2, 4); data.write("WAVE", 8); data.write("fmt ", 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 330) * 3000), 44 + i * 2);
  return "data:audio/wav;base64," + data.toString("base64");
}
const TRACKS = [{ id: "t1", title: "Test tone", artist: "The tests", medium: "record", url: toneWav(), loop: true }];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
let failures = 0;
const check = (l, c, d) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && d ? " — " + d : ""}`); };
const q = (page, id) => page.locator(`[data-testid="${id}"]`);
const stereo2 = (page) => page.evaluate(() => window.__DEN_STEREO__ && window.__DEN_STEREO__().playing);
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

{
  console.log("the den (Standard)");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  const stereo = () => page.evaluate(() => window.__DEN_STEREO__ && window.__DEN_STEREO__());
  check("the room is up", await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__)));
  const scene = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    const byName = (n) => { let f = null; t.scene.traverse((o) => { if (o.name === n) f = o; }); return f; };
    let meshes = 0; t.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
    const vis = (n) => { const g = byName(n); return g ? g.visible : null; };
    return {
      groups: ["den-core", "den-wallN", "den-wallE", "den-wallS", "den-wallW", "den-ceiling", "den-sofaN", "den-sofaS", "den-sofaW", "den-table"].map((n) => [n, vis(n)]),
      meshes, fire: (() => { let n = 0; t.scene.traverse((o) => { if (o.material && o.material.isShaderMaterial && o.material.uniforms && o.material.uniforms.uTime) n++; }); return n; })(),
    };
  });
  let s = await scene();
  check("the pit's sofas, the four walls, the ceiling and the coffee table are all there", s.groups.every(([, v]) => v === true), JSON.stringify(s.groups));
  check("a fire burns in the fireplace", s.fire >= 1, String(s.fire));
  check(`the whole room is a few dozen draw calls (${s.meshes})`, s.meshes > 20 && s.meshes < 200, String(s.meshes));

  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(2000);
  const pieces = await page.evaluate(() => {
    const ps = window.__DEN_THREE__.pieceGroup.children.filter((c) => c.userData.kind === "piece");
    return { n: ps.length, opaque: ps.every((m) => [].concat(m.material).every((x) => !x.transparent)) };
  });
  check(`the pieces are Tienda's opaque wood (${pieces.n})`, pieces.n >= 10 && pieces.opaque, JSON.stringify(pieces));
  const at = async (patch) => { await page.evaluate((p) => window.__EC_TEST_CAM__(p), patch); await page.waitForTimeout(2600); return scene(); };
  const vis = (s2, n) => (s2.groups.find(([k]) => k === n) || [])[1];
  // theta 0 puts the camera on the south side (+z) of the pit.
  s = await at({ theta: 0, phi: 1.33, radius: 44 });
  check("low and pulled back past the south sofa: it steps aside", vis(s, "den-sofaS") === false, JSON.stringify(s.groups));
  check("...while the far sofa and the far wall stay", vis(s, "den-sofaN") === true && vis(s, "den-wallN") === true, JSON.stringify(s.groups));
  // Pulled far out overhead, the camera stops under the ceiling (the
  // room box, standard.js freeCamera.room), so the ceiling stays.
  s = await at({ theta: 0, phi: 0.02, radius: 140 });
  const camY = await page.evaluate(() => { const t = window.__DEN_THREE__; const p = t.camera.position.clone(); t.boardGroup.worldToLocal(p); return p.y; });
  const ceilY = await page.evaluate(() => {
    let y = null, g = null;
    window.__DEN_THREE__.scene.traverse((o) => { if (o.name === "den-ceiling") g = o; });
    if (g) g.traverse((m) => { if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); const top = m.geometry.boundingBox.max.y + m.position.y; y = y == null ? top : Math.max(y, top); } });
    return y;
  });
  check(`high above, top-down: the camera stops under the ceiling (${camY.toFixed(1)} under ${ceilY == null ? "?" : ceilY.toFixed(1)}), which stays`, vis(s, "den-ceiling") === true && (ceilY == null || camY < ceilY - 3), JSON.stringify({ camY, ceilY, groups: s.groups }));
  check("...and no sofa hides (none is in the way)", ["den-sofaN", "den-sofaS", "den-sofaW"].every((n) => vis(s, n) === true), JSON.stringify(s.groups));
  s = await at({ theta: 0, phi: 0.95, radius: 20 });
  check("back at the table, everything is there again", s.groups.every(([, v]) => v === true), JSON.stringify(s.groups));

  // The sound menu.
  await openDockPanel(page).catch(() => {});
  await q(page, "sound-button").click();
  check("the speaker opens the sound menu: All sounds, The room, Pieces",
    (await q(page, "sound-menu").count()) === 1 && (await q(page, "sound-ch-room").count()) === 1 && (await q(page, "sound-ch-pieces").count()) === 1);
  await q(page, "sound-ch-room").fill("0");
  await page.waitForTimeout(700);
  const a = await page.evaluate(() => window.__DEN_AUDIO__ && window.__DEN_AUDIO__());
  check("The room off silences the fire, the clock and the rain", a && a.channelsOff.room === true && a.gates.room < 0.01, JSON.stringify(a));
  check("...and leaves the pieces", a && a.channelsOff.pieces === false, JSON.stringify(a));
  await q(page, "sound-ch-room").fill("100");

  // The stereo: the music panel from the sound menu, the camera's visit.
  check("the sound menu offers the music", (await q(page, "sound-music").count()) === 1);
  await q(page, "sound-music").click();
  await page.waitForTimeout(400);
  check("...which opens the music panel", (await q(page, "music-panel").count()) === 1);
  check("...the record player has its record, the 8-track its five tapes", (await q(page, "music-track-dangerous-dashing").count()) === 1 && (await q(page, "music-track-tape-parse").count()) === 1 && (await q(page, "music-empty-record").count()) === 0 && (await q(page, "music-empty-8track").count()) === 0);
  check("...and the dock steps aside", (await page.locator('[data-testid="sound-menu"]').count()) === 0);
  await page.waitForTimeout(3200);
  const near = await page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let c = null; t.scene.traverse((o) => { if (o.name === "den-console") c = o; });
    const box = new t.camera.position.constructor();
    c.children[0].getWorldPosition(box);
    return t.camera.position.distanceTo(box);
  });
  const s1 = await stereo();
  check(`the camera has gone over to the console (${Math.round(near)} units from it, visit ${s1 && s1.focus.toFixed(2)})`, s1 && s1.focus > 0.9 && near < 75, JSON.stringify(s1));
  await page.mouse.click(8, 300); // outside the panel puts it away
  await waitFor(async () => { const st = await stereo(); return st && st.focus < 0.02; }, 12000);
  const s2 = await stereo();
  check("closing it brings the camera back", (await q(page, "music-panel").count()) === 0 && s2 && s2.focus < 0.02, JSON.stringify(s2));

  // The room's sound from where the camera is, and the hour's chime.
  const fireAt = async (theta) => { await page.evaluate((th) => window.__EC_TEST_CAM__({ theta: th, phi: 1.1, radius: 40 }), theta); await page.waitForTimeout(2600); return page.evaluate(() => window.__DEN_AUDIO__().fire.near); };
  const fireSide = await fireAt(Math.PI), farSide = await fireAt(0);
  check(`the fire is louder from its own side of the pit (${fireSide.toFixed(2)} vs ${farSide.toFixed(2)})`, fireSide > farSide * 1.4);
  const chimes = await page.evaluate(() => window.__DEN_CHIME_NOW__ && window.__DEN_CHIME_NOW__());
  check("the clock's hour chime plays", chimes >= 1, String(chimes));

  // The doorway's hall, and the snack mix.
  const room = await page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let hall = false, snacks = 0;
    t.scene.traverse((o) => {
      if (o.isMesh && o.geometry && o.parent && o.parent.name === "den-wallS") { o.geometry.computeBoundingBox(); if (o.geometry.boundingBox.min.z > 92) hall = true; }
      if (o.isInstancedMesh && o.parent && o.parent.name === "den-table") snacks += o.count;
    });
    return { hall, snacks };
  });
  check("the south wall's doorway opens onto a hall", room.hall);
  check(`the bowl holds snack mix, piece by piece (${room.snacks})`, room.snacks >= 100);
  await page.keyboard.press("Escape");
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("the den's stereo, with a record");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((tracks) => { window.__EC_TEST_HOOKS__ = true; window.__DEN_TEST_TRACKS__ = tracks; }, TRACKS);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__));
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  // A tap on the turntable, in the room, opens the panel (once the camera
  // has settled where the test put it: the software renderer is slow).
  await page.evaluate(() => window.__EC_TEST_CAM__({ theta: Math.PI, phi: 1.28, radius: 50 }));
  const discAt = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let disc = null; t.scene.traverse((o) => { if (o.userData && o.userData.music === "record" && o.geometry && o.geometry.type === "CircleGeometry") disc = o; });
    const v = new t.camera.position.constructor(); disc.getWorldPosition(v); v.project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
  let at = await discAt();
  await waitFor(async () => { await page.waitForTimeout(400); const b = await discAt(); const still = Math.hypot(b.x - at.x, b.y - at.y) < 1.5; at = b; return still; }, 15000);
  for (let i = 0; i < 2 && (await q(page, "music-panel").count()) === 0; i++) {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(500);
    at = await discAt();
  }
  check("a tap on the turntable opens the music panel", (await q(page, "music-panel").count()) === 1);
  check("...listing the record", (await q(page, "music-track-t1").count()) === 1);
  await q(page, "music-track-t1").click();
  await page.waitForTimeout(1500);
  const spin = () => page.evaluate(() => { let p = null; window.__DEN_THREE__.scene.traverse((o) => { if (o.userData && o.userData.music === "record" && o.geometry && o.geometry.type === "CircleGeometry") p = o.parent; }); return p.rotation.y; });
  const r1 = await spin();
  await page.waitForTimeout(700);
  const r2 = await spin();
  const a1 = await page.evaluate(() => window.__DEN_AUDIO__());
  check("it plays on the record player", a1.music && a1.music.id === "t1" && a1.music.medium === "record" && !a1.music.paused, JSON.stringify(a1.music));
  check("...and the platter turns", Math.abs(r2 - r1) > 0.5, `${r1} -> ${r2}`);
  check("...Stop is offered", (await q(page, "music-stop").count()) === 1);
  // The panel put away: a now-playing chip to pause it or turn it down.
  check("no chip while the panel is open", (await q(page, "music-chip").count()) === 0);
  await page.mouse.click(8, 300); // outside the panel puts it away
  await page.waitForTimeout(600);
  check("the panel away: the now-playing chip", await q(page, "music-chip").isVisible());
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(400);
  const p1 = await page.evaluate(() => window.__DEN_AUDIO__());
  const s1 = await spin();
  await page.waitForTimeout(600);
  const s2 = await spin();
  check("...its pause pauses the record, in its place", p1.music && p1.music.id === "t1" && p1.music.paused, JSON.stringify(p1.music));
  check("...and the platter stops", Math.abs(s2 - s1) < 0.05, `${s1} -> ${s2}`);
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(400);
  check("...again: it plays on", !(await page.evaluate(() => window.__DEN_AUDIO__())).music.paused);
  await q(page, "music-chip-volume").fill("30");
  await page.waitForTimeout(400);
  const g = (await page.evaluate(() => window.__DEN_AUDIO__())).gates.stereo;
  check("...its slider turns the music down", Math.abs(g - 0.09) < 0.02, String(g));
  await q(page, "music-chip-volume").fill("100");
  await q(page, "music-chip-title").click();
  await page.waitForTimeout(400);
  check("...its title opens the stereo again", (await q(page, "music-panel").count()) === 1);
  await q(page, "music-stop").click();
  await page.waitForTimeout(400);
  const a2 = await page.evaluate(() => window.__DEN_AUDIO__());
  check("Stop stops it", !a2.music && (await stereo2(page)) === null);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("On a phone the now-playing chip folds down to a pause button");
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((tracks) => { window.__EC_TEST_HOOKS__ = true; window.__DEN_TEST_TRACKS__ = tracks; }, TRACKS);
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__));
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  await q(page, "sound-button").click();
  await q(page, "sound-music").click();
  await page.waitForTimeout(500);
  await q(page, "music-track-t1").click();
  await page.waitForTimeout(500);
  await page.mouse.click(8, 300); // outside the panel puts it away
  await page.waitForTimeout(800);
  const chip = q(page, "music-chip");
  const w = async () => (await chip.boundingBox()).width;
  const pausedNow = async () => (await page.evaluate(() => window.__DEN_AUDIO__())).music.paused;
  check("playing: just a round pause button", (await chip.getAttribute("data-folded")) === "true" && (await w()) < 36 && (await q(page, "music-chip-volume").count()) === 0, String(await w()));
  const col = await q(page, "focus-corner").boundingBox(), cb = await chip.boundingBox();
  check("...at the top of the corner column", Math.abs(cb.x - col.x) < 3 && cb.y < col.y, JSON.stringify({ cb, col }));
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(600);
  check("a tap opens it out (still playing): what's playing, the volume", !(await pausedNow()) && (await w()) > 150 && (await q(page, "music-chip-title").textContent()) === "Test tone" && (await q(page, "music-chip-volume").isVisible()));
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(400);
  check("...then its button pauses it, and it stays open", (await pausedNow()) && (await chip.getAttribute("data-folded")) === "false");
  await q(page, "music-chip-volume").fill("40");
  await page.waitForTimeout(300);
  const g = (await page.evaluate(() => window.__DEN_AUDIO__())).gates.stereo;
  check("...the volume turns", Math.abs(g - 0.16) < 0.03, String(g));
  await page.mouse.click(300, 200);
  await page.waitForTimeout(600);
  check("a tap anywhere else folds it back (still paused)", (await pausedNow()) && (await chip.getAttribute("data-folded")) === "true" && (await w()) < 36);
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(400);
  await q(page, "music-chip-toggle").click();
  await page.waitForTimeout(400);
  check("open again, play: it plays on", !(await pausedNow()));
  await openDockPanel(page);
  await page.waitForTimeout(700);
  check("the dock's panel open: the chip steps away", await chip.evaluate((e) => getComputedStyle(e).opacity === "0" && getComputedStyle(e).pointerEvents === "none"));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("The den's own record: Dangerous Dashing, off the turntable");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; }); // no test tracks: the den's own
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__));
  // A game under way, the title out of the way (as the stereo test above).
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__EC_TEST_CAM__({ theta: Math.PI, phi: 1.28, radius: 50 }));
  const discAt = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let disc = null; t.scene.traverse((o) => { if (o.userData && o.userData.music === "record" && o.geometry && o.geometry.type === "CircleGeometry") disc = o; });
    const v = new t.camera.position.constructor(); disc.getWorldPosition(v); v.project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
  let at = await discAt();
  await waitFor(async () => { await page.waitForTimeout(400); const b = await discAt(); const still = Math.hypot(b.x - at.x, b.y - at.y) < 1.5; at = b; return still; }, 15000);
  for (let i = 0; i < 2 && (await q(page, "music-panel").count()) === 0; i++) {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(500);
    at = await discAt();
  }
  check("the music panel lists the record", (await q(page, "music-track-dangerous-dashing").count()) === 1);
  await q(page, "music-track-dangerous-dashing").click();
  const playing = await waitFor(async () => {
    const a = await page.evaluate(() => window.__DEN_AUDIO__());
    return a.music && a.music.id === "dangerous-dashing" && a.music.medium === "record" && !a.music.paused;
  }, 10000);
  check("...and it plays on the record player (the file beside the page)", playing);
  const t0 = await page.evaluate(() => { const a = window.__DEN_AUDIO__(); return a.music && a.music.time; });
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => { const a = window.__DEN_AUDIO__(); return a.music && a.music.time; });
  check("...the needle moving through it", typeof t1 === "number" && t1 > (t0 || 0), `${t0} -> ${t1}`);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("The book by the chair: a tap takes the camera to it");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_BOOK__));
  const book = () => page.evaluate(() => window.__DEN_BOOK__());
  const bookWorld = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let bk = null; t.scene.traverse((o) => { if (o.userData && o.userData.book) bk = o; });
    bk.geometry.computeBoundingSphere();
    const v = bk.geometry.boundingSphere.center.clone(); bk.localToWorld(v);
    const p = v.clone().project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { w: [v.x, v.y, v.z], x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, z: p.z };
  });
  let entered = false;
  for (const theta of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    // The heading first (the board turns, the room with it), then the aim.
    await page.evaluate((theta) => window.__EC_TEST_CAM__({ dollhouse: false, theta, phi: 1.1, radius: 40 }), theta);
    await page.waitForTimeout(2500);
    const w = (await bookWorld()).w;
    await page.evaluate((w) => window.__EC_TEST_CAM__({ target: w }), w);
    await page.waitForTimeout(2500);
    const at = await bookWorld();
    if (at.z >= 1 || at.x < 30 || at.x > 1070 || at.y < 60 || at.y > 680) continue;
    await page.mouse.click(at.x, at.y);
    entered = await waitFor(async () => { const b = await book(); return b.goal === 1 && b.w > 0.99; }, 6000);
    if (entered) break;
  }
  check("a tap on the book takes the camera to it", entered);
  const view = await page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let bk = null; t.scene.traverse((o) => { if (o.userData && o.userData.book) bk = o; });
    bk.geometry.computeBoundingBox();
    const bb = bk.geometry.boundingBox; const pts = [];
    for (const x of [bb.min.x, bb.max.x]) for (const z of [bb.min.z, bb.max.z]) { const v = new t.camera.position.constructor(x, bb.max.y, z); bk.localToWorld(v); v.project(t.camera); pts.push(v); }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    // (The catcher is a little bigger than the book and squared to the room,
    // so its box overstates it: the centre and the size are what count.)
    const c = new t.camera.position.constructor(); bk.geometry.computeBoundingSphere(); c.copy(bk.geometry.boundingSphere.center); bk.localToWorld(c); c.project(t.camera);
    return { cx: c.x, cy: c.y, spanX: Math.max(...xs) - Math.min(...xs), spanY: Math.max(...ys) - Math.min(...ys) };
  });
  check("...the book in the middle, filling the view", Math.abs(view.cx) < 0.15 && Math.abs(view.cy) < 0.15 && Math.max(view.spanX, view.spanY) > 1.4, JSON.stringify(view));
  check("...with the way back shown", await page.evaluate(() => { const h = document.querySelector('[data-testid="den-book-hint"]'); return !!h && h.classList.contains("on"); }));
  await page.mouse.click(550, 400);
  check("a tap anywhere comes back", await waitFor(async () => (await book()).goal === 0, 3000));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("The rules leaflet on the coffee table");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__));
  check("no How to play in the corner", (await q(page, "how-to-play").count()) === 0);
  check("...the Room view house is there", await q(page, "room-view-corner").isVisible());
  const leafAt = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let leaf = null; t.scene.traverse((o) => { if (o.userData && o.userData.rules && o.geometry && o.geometry.type === "PlaneGeometry") leaf = o; });
    const v = new t.camera.position.constructor(); leaf.getWorldPosition(v); v.project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
  let at = await leafAt();
  await waitFor(async () => { await page.waitForTimeout(400); const b = await leafAt(); const still = Math.hypot(b.x - at.x, b.y - at.y) < 1.5; at = b; return still; }, 15000);
  const hintOn = () => page.evaluate(() => { const h = document.querySelector('[data-testid="den-rules-hint"]'); return !!h && h.classList.contains("on"); });
  await page.mouse.move(at.x - 200, at.y - 200);
  await page.mouse.move(at.x, at.y, { steps: 4 });
  check("the mouse over the leaflet: a \"?\" pops up", await waitFor(hintOn, 4000));
  check("...and the cursor points", (await page.evaluate(() => window.__DEN_THREE__.renderer.domElement.style.cursor)) === "pointer");
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(500);
  check("a tap on it opens the rules at the Quick card",
    (await q(page, "info-overlay").getAttribute("data-open")) === "true" && (await q(page, "rules-card-quick").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  // A mouse wheel spun fast, in small smooth steps (a Mac's): it only
  // zooms out, never jumps to a view (it once read as a trackpad flick).
  const camDist = () => page.evaluate(() => { const t = window.__DEN_THREE__; const p = t.camera.position.clone(); t.boardGroup.worldToLocal(p); return p.length(); });
  const d0 = await camDist();
  await page.mouse.move(40, 400);
  for (let i = 0; i < 24; i++) await page.mouse.wheel(0, 24);
  await page.waitForTimeout(2500);
  const d1 = await camDist();
  check("a fast spin of small wheel steps zooms out, no view jump", d1 > d0 * 1.3, `${d0.toFixed(1)} -> ${d1.toFixed(1)}`);
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("Focus: just the board");
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; });
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-standard.html");
  await waitFor(() => page.evaluate(() => !!window.__DEN_ROOM__ && !!window.__DEN_THREE__ && !!window.__DEN_FOCUS__));
  const focus = () => page.evaluate(() => window.__DEN_FOCUS__());
  const settled = (on) => waitFor(async () => { const f = await focus(); return f.on === on && (on ? f.w > 0.99 : f.w < 0.01); }, 12000);
  check("the focus button is in the corner", await q(page, "focus-corner").isVisible());
  await q(page, "focus-corner").click();
  check("...a tap: focus comes on and settles", await settled(true));
  const f1 = await focus();
  check("...the room drops away under the board", f1.lift > 0.7, JSON.stringify(f1));
  check("...the fog closes in to just past the board", f1.fogNear < 80, JSON.stringify(f1));
  const veil = await page.evaluate(() => { const v = document.querySelector('[data-testid="den-focus-veil"]'); return v ? { op: Number(v.style.opacity), vis: v.style.visibility, rx: parseFloat(v.style.getPropertyValue("--ix1")) - parseFloat(v.style.getPropertyValue("--ix0")) } : null; });
  check("...the veil is over the room, round the board", veil && veil.op > 0.95 && veil.vis === "visible" && veil.rx > 120, JSON.stringify(veil));
  check("...the button says so", (await q(page, "focus-corner").getAttribute("data-on")) === "true");
  await page.mouse.move(600, 300); // a hover brings a dimmed one back up
  await page.waitForTimeout(700);
  const dimmed = await page.evaluate(() => ({
    lights: document.documentElement.classList.contains("ec-lights-down"),
    corner: [...document.querySelectorAll('[data-testid="room-view-corner"], [data-testid="focus-corner"], button[aria-label$="full screen"]')].map((b) => Number(getComputedStyle(b).opacity)),
    masthead: getComputedStyle(document.querySelector("[data-masthead] > div")).filter,
  }));
  check("...the corner buttons dim with the lights", dimmed.lights && dimmed.corner.length >= 2 && dimmed.corner.every((o) => o < 0.5), JSON.stringify(dimmed));
  check("...and so does the masthead", /brightness/.test(dimmed.masthead), dimmed.masthead);
  await page.keyboard.press("f");
  check("F leaves it", await settled(false));
  check("...the room back in place", (await focus()).lift < 0.01);
  await page.keyboard.press("f");
  check("F again: back in", await settled(true));
  await page.keyboard.press("Escape");
  check("Escape leaves it", await settled(false));
  // The dock's switch (with the camera views, once a game is under way).
  await openDockPanel(page);
  await page.locator("button", { hasText: "Begin Game" }).click();
  await page.waitForTimeout(1500);
  await openDockPanel(page);
  const sw = q(page, "focus-switch");
  check("the dock has a Focus switch", await sw.isVisible());
  await sw.click();
  check("...on", (await sw.getAttribute("aria-checked")) === "true" && (await focus()).on);
  await q(page, "room-view").click();
  check("Room View leaves focus", !(await focus()).on && (await sw.getAttribute("aria-checked")) === "false");
  check("...the corner's house goes grey while it's the view", (await q(page, "room-view-corner").getAttribute("data-active")) === "true");
  check("...and the page's lights are back up", !(await page.evaluate(() => document.documentElement.classList.contains("ec-lights-down"))));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  // The lamps: each of them toggles it on its own (the console's, the
  // credenza's two, the two ceiling globes; not the arc lamp by the chair).
  const lampCount = await page.evaluate(() => { let n = 0; window.__DEN_THREE__.scene.traverse((o) => { if (o.userData && o.userData.focusLamp) n++; }); return n; });
  check("five lamps are switches", lampCount === 5, String(lampCount));
  const lampAt = (k) => page.evaluate((k) => {
    const t = window.__DEN_THREE__;
    const lamps = []; t.scene.traverse((o) => { if (o.userData && o.userData.focusLamp) lamps.push(o); });
    const v = new t.camera.position.constructor(); lamps[k].getWorldPosition(v); v.project(t.camera);
    const r = t.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, z: v.z };
  }, k);
  const toggled = [];
  for (let k = 0; k < lampCount; k++) {
    let ok = false;
    for (const theta of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      // Aimed at the lamp, from across the room, inside it: the heading
      // first (the board turns, and the room with it), then the aim.
      await page.evaluate((theta) => window.__EC_TEST_CAM__({ dollhouse: false, theta, phi: 1.3, radius: 40 }), theta);
      await page.waitForTimeout(2500);
      await page.evaluate((k) => {
        const t = window.__DEN_THREE__;
        const lamps = []; t.scene.traverse((o) => { if (o.userData && o.userData.focusLamp) lamps.push(o); });
        const v = new t.camera.position.constructor(); lamps[k].getWorldPosition(v);
        window.__EC_TEST_CAM__({ target: [v.x, v.y, v.z] });
      }, k);
      await page.waitForTimeout(2500);
      const at = await lampAt(k);
      if (at.z >= 1 || at.x < 30 || at.x > 1070 || at.y < 30 || at.y > 700) continue;
      const before = (await focus()).on;
      await page.mouse.click(at.x, at.y);
      ok = await waitFor(async () => (await focus()).on !== before, 3000);
      if (ok) break;
    }
    toggled.push(ok);
  }
  check("a tap on any one of the lamps toggles focus", toggled.length === 5 && toggled.every(Boolean), JSON.stringify(toggled));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await page.close();
}

{
  console.log("Nova: the den, Neon, and back");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  // The control bar, chosen (a phone opens Nova with the floating piece).
  await page.addInitScript(() => { window.__EC_TEST_HOOKS__ = true; try { localStorage.setItem("el-cabeza:story", JSON.stringify({ owned: true })); localStorage.setItem("el-cabeza:nova-layout", "bar"); } catch (e) { /* none */ } }); // bought: Nova opens at home
  await page.goto("file:///home/user/el-cabeza-project/dist/el-cabeza-nova.html");
  const denUp = () => page.evaluate(() => {
    const t = window.__DEN_THREE__;
    let den = false;
    if (window.__DEN_ROOM__ && t && t.scene) t.scene.traverse((o) => { if (o.name === "den-room") den = true; });
    return den;
  });
  check("Nova opens in the den", await waitFor(denUp));
  // The phone menu's way to the music: "Choose music" opens the panel.
  await q(page, "shell-menu-button").click();
  await page.waitForTimeout(300);
  const musicRow = q(page, "shell-menu-music");
  check("the phone menu offers the music", (await musicRow.count()) === 1);
  await musicRow.scrollIntoViewIfNeeded();
  await musicRow.click();
  await page.waitForTimeout(500);
  check("...which puts the menu away and opens the music panel", (await q(page, "music-panel").count()) === 1);
  await page.mouse.click(8, 300); // outside the panel puts it away
  await page.waitForTimeout(300);
  // Into Neon the menu turns on the TV (no prompt); back, the prompt.
  const switchTheme = async (prompt) => {
    await q(page, "shell-menu-button").click();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__DEN_LURE_SKIP__ && window.__DEN_LURE_SKIP__(41000)); // (past the set's 40 s wait, den-fx.js lure)
    await q(page, "shell-menu-switch-theme").click();
    if (!prompt) return;
    await waitFor(async () => (await page.locator(".ec-hold-modal-word").count()) > 0);
    await page.locator(".ec-hold-modal-word").click({ force: true });
  };
  await switchTheme(false);
  check("switched to Neon, through the TV", await waitFor(async () => (await q(page, "shell-anomaly").count()) > 0, 30000));
  check("...and the den has gone with Standard", await page.evaluate(() => window.__DEN_ROOM__ === false && !window.__DEN_THREE__));
  await page.waitForTimeout(1200);
  await switchTheme(true);
  check("back to Standard: the den is built again", await waitFor(denUp, 15000));
  check(`no page errors (${errs.length})`, errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall passed");
process.exit(failures ? 1 : 0);
