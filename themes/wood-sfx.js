/* Wooden blocks on a board: the game's own knocks, shared by Tienda and
   Standard (Tienda's sounds, first written in tienda-audio.js).

   A hardwood block struck is a few close modes, short, over a contact
   click; under it, the board. Tienda's is a folding board on a table (a
   hollow, boxy knock and the table's low thud); Standard's is a solid
   slab (a tight, dull knock and a short thud, nothing hollow).

   How low a landing sounds follows the face that meets the board, and a
   little the whole piece (landingSize): a 1x3 laid on its long side lands
   lower than the same 1x3 stood on end. */

export const massOf = (units) => Math.max(1, Math.min(8, units || 1));

/* The "size" a landing is struck at (the hit's pitch goes as 1/sqrt).
   contact: how many squares the landing face covers. The face sets most
   of it and the piece's cube root the rest, so a single cube is 1 and a
   2x2x2 flat is 8, as before; a 1x3 on end is 1.44, on its side 4.33.
   Without a contact face (an older caller), the piece's cubes. */
export function landingSize(units, contact) {
  const m = massOf(units);
  if (!contact) return m;
  const c = Math.max(1, Math.min(m, contact));
  return c * Math.cbrt(m);
}

export function createWoodSfx(ctx, out, { board: boardKind = "folding" } = {}) {
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return s;
  }

  // The board under the block, `board` scaling how much of it there is.
  function boardUnder(t, size, level, board) {
    if (boardKind === "solid") {
      // A solid slab: a tight, dull knock (filtered noise, gone fast) and
      // a short thud, with no ring to it.
      const n = noise(t, 0.06), bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = 520 / Math.sqrt(size * 0.6 + 0.4); bp.Q.value = 1.4;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(level * 1.1 * board, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      n.connect(bp).connect(ng).connect(out);
      const th = ctx.createOscillator(); th.frequency.setValueAtTime(115 / Math.sqrt(size * 0.4 + 0.6), t); th.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      const tg = ctx.createGain(); tg.gain.setValueAtTime(level * 0.6 * board * Math.min(1.6, size * 0.5), t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      th.connect(tg).connect(out); th.start(t); th.stop(t + 0.1);
      return;
    }
    // The folding board: a hollow, boxy knock; the table, a low thud.
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(230 / Math.sqrt(size * 0.6 + 0.4), t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(level * 0.9 * board, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.15);
    const th = ctx.createOscillator(); th.frequency.setValueAtTime(90, t); th.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    const tg = ctx.createGain(); tg.gain.setValueAtTime(level * 0.7 * board * Math.min(1.6, size * 0.5), t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    th.connect(tg).connect(out); th.start(t); th.stop(t + 0.18);
  }

  // A hardwood block struck: a few close modes, short, and the board below.
  function hit(t, { size = 1, level = 0.12, bright = 1, board = 1 } = {}) {
    const base = 1650 / Math.sqrt(size) * bright;
    [[1, 1, 0.05], [1.58, 0.55, 0.035], [2.43, 0.3, 0.022], [3.6, 0.15, 0.015]].forEach(([k, a, d]) => {
      const o = ctx.createOscillator(); o.frequency.value = base * k * (1 + (Math.random() - 0.5) * 0.03);
      const g = ctx.createGain(); g.gain.setValueAtTime(level * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * (0.8 + size * 0.15));
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
    });
    // The contact click.
    const c = noise(t, 0.02), chp = ctx.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 2500;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(level * 0.6, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(chp).connect(cg).connect(out);
    if (board > 0) boardUnder(t, size, level, board);
  }

  const now = () => ctx.currentTime;
  return {
    hit,
    select() { hit(now(), { size: 0.8, level: 0.07, bright: 1.15, board: 0.2 }); },
    deselect() { hit(now(), { size: 0.9, level: 0.06, board: 0.5 }); },
    blocked() { const t = now(); hit(t, { size: 1.6, level: 0.06, bright: 0.7, board: 0.6 }); hit(t + 0.11, { size: 1.8, level: 0.05, bright: 0.65, board: 0.6 }); },
    // The edge dragging over the lacquer as it tips.
    rollStart(units, durationMs) {
      const m = massOf(units), t = now(), dur = Math.max(0.15, (durationMs || 350) / 1000);
      const n = noise(t, dur), bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900 / Math.sqrt(m); bp.Q.value = 1.1;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012 + m * 0.003, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      n.connect(bp).connect(g).connect(out);
    },
    // Loudness follows the piece's weight; pitch, the face it lands on.
    landing(units, contact) {
      const m = massOf(units);
      // Test-only: a test that sets window.__EC_TEST_LANDINGS__ = [] sees
      // each landing's cubes, face and size (tests/e2e-wood-sounds.mjs).
      if (typeof window !== "undefined" && Array.isArray(window.__EC_TEST_LANDINGS__)) window.__EC_TEST_LANDINGS__.push({ units, contact, size: landingSize(units, contact) });
      hit(now(), { size: landingSize(units, contact), level: 0.09 + 0.03 * Math.log2(m), bright: 1, board: 1 });
    },
    capture() {
      const t = now();
      hit(t, { size: 4, level: 0.2, board: 1.4 });
      // The crushed piece knocked over: a few small bounces.
      [0.09, 0.2, 0.28, 0.34].forEach((d, i) => hit(t + d, { size: 0.9, level: 0.06 / (i + 1), bright: 1.2, board: 0.3 }));
    },
  };
}
