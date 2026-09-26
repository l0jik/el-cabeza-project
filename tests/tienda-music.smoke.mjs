/* Tienda's ceiling-speaker music, checked offline: every arrangement the
   composer writes is playable (real notes in a sensible range, times in
   order, inside its own length), has a tune for its lead instrument and
   the full band under it, runs about a minute and a half, and a
   different seed writes a different tune on the same changes. */
import { composeArrangement, TUNES, KEYS } from "../themes/tienda-audio.js";

let failures = 0;
const check = (l, c, extra) => { if (!c) failures++; console.log(`  ${c ? "ok  " : "FAIL"} ${l}${!c && extra ? " — " + extra : ""}`); };

const PITCHED = ["strings", "epiano", "bass", "vibes", "flute"];
for (let t = 0; t < TUNES.length; t++) {
  for (const seed of [1, 777, 90210]) {
    const a = composeArrangement(t, KEYS[t], seed);
    const secs = (a.beats * 60) / a.tempo;
    const bad = a.notes.filter((n) => !Number.isFinite(n.at) || !(n.len > 0) || n.at < 0 || n.at > a.beats || (PITCHED.includes(n.instr) && !(n.m >= 28 && n.m <= 100)));
    const sorted = a.notes.every((n, i) => i === 0 || a.notes[i - 1].at <= n.at);
    const by = {};
    a.notes.forEach((n) => { by[n.instr] = (by[n.instr] || 0) + 1; });
    const lead = a.notes.filter((n) => n.instr === TUNES[t].lead).length;
    check(`tune ${t} seed ${seed}: ${a.notes.length} notes, ${secs.toFixed(0)}s`, bad.length === 0 && sorted && secs > 60 && secs < 180, `${bad.length} bad, sorted ${sorted}`);
    check(`tune ${t} seed ${seed}: lead (${TUNES[t].lead}) and band all play`, lead >= 12 && ["strings", "epiano", "bass", "brush"].every((k) => by[k] > 0), JSON.stringify(by));
  }
  // Every key, many seeds: none may fail to write (a chord with no
  // voicing in range once threw here and silenced the store).
  let thrown = 0, first = "";
  for (let k = 0; k < KEYS.length; k++) for (let seed = 0; seed < 60; seed++) {
    try {
      const a = composeArrangement(t, KEYS[k], seed * 7919 + k);
      if (a.notes.some((n) => ["strings", "epiano", "bass", "vibes", "flute"].includes(n.instr) && !(n.m >= 28 && n.m <= 100))) throw new Error("note out of range");
    } catch (e) { thrown++; if (!first) first = `key ${k} seed ${seed}: ${e.message}`; }
  }
  check(`tune ${t}: writes in every key (${KEYS.length} keys × 60 seeds)`, thrown === 0, `${thrown} failed, first ${first}`);
  const line = (seed) => composeArrangement(t, KEYS[t], seed).notes.filter((n) => n.instr === TUNES[t].lead).map((n) => n.m).join(",");
  check(`tune ${t}: another seed writes another melody`, line(1) !== line(2));
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall tienda music checks passed");
process.exit(failures ? 1 : 0);
