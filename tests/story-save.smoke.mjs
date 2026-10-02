/* The story's save record (apps/novaStory.jsx, localStorage
   "el-cabeza:story"): every writer keeps what the others wrote, starting
   over clears it, and a corrupt or missing record reads as a fresh start.
   The module is JSX, so it's bundled first (esbuild) and loaded from that.

   node tests/story-save.smoke.mjs */
import * as esbuild from "esbuild";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// A localStorage of our own (Node has none).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const KEY = "el-cabeza:story";
const record = () => JSON.parse(store.get(KEY) || "null");

let failures = 0;
const check = (label, cond, detail) => { if (!cond) failures++; console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && detail ? " — " + detail : ""}`); };

// A fresh copy of the module each time (its "this visit" memory starts empty).
let n = 0;
async function fresh() {
  const out = await esbuild.build({
    entryPoints: ["apps/novaStory.jsx"], bundle: true, write: false, format: "esm", platform: "neutral",
    jsx: "automatic", loader: { ".js": "jsx", ".mp3": "empty", ".jpg": "empty", ".webp": "empty", ".png": "empty" },
    define: { "process.env.NODE_ENV": '"production"' }, mainFields: ["module", "main"], logLevel: "error",
  });
  const dir = mkdtempSync(join(tmpdir(), "story-"));
  const file = join(dir, `story-${n++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  const mod = await import(pathToFileURL(file).href);
  rmSync(dir, { recursive: true, force: true });
  return mod;
}

console.log("the story's save record");
{
  store.clear();
  const s = await fresh();
  check("nothing saved: not owned, store not gone, story not over", !s.readOwned() && !s.storeGone() && !s.storyEnded() && !s.hallDue() && s.hallFlares() === 0);
  s.saveOwned(true);
  check("bought: owned", s.readOwned() && record().owned === true);
  s.saveHallFlares(1);
  s.saveStoreGone();
  check("store gone keeps what was there (merged, not replaced)", record().storeGone === true && record().owned === true && record().hallFlares === 1, JSON.stringify(record()));
  s.saveHallDue(true);
  check("hall due, alongside the rest", s.hallDue() && record().storeGone === true && record().hallFlares === 1, JSON.stringify(record()));
  s.saveStoryEnded();
  check("story over: ended, the hall no longer due, the rest kept", s.storyEnded() && !s.hallDue() && record().owned && record().storeGone && record().hallFlares === 1, JSON.stringify(record()));
}
{
  // A later visit reads it all back.
  const s = await fresh();
  check("a later visit reads it all back", s.readOwned() && s.storeGone() && s.storyEnded() && s.hallFlares() === 1);
  s.saveOwned(false);
  check("starting over clears the record", record() === null && !s.readOwned());
}
{
  store.set(KEY, "{not json");
  const s = await fresh();
  check("a corrupt record reads as a fresh start (no throw)", !s.readOwned() && !s.storeGone() && !s.storyEnded() && s.hallFlares() === 0);
}

console.log(failures ? `\nSTORY SAVE FAILED (${failures})` : "\nSTORY SAVE PASSED");
process.exit(failures ? 1 : 0);
