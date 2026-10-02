/* The Singularity's first visit in the story (LostNudge, neon-singularity.js):
   the silence there isn't quite silence. A heartbeat, faint at first, and a
   thin ringing in the ears, rising the more the player pokes around, at its
   height when they see their own hand going to wireframe. Out through the
   summons' way out (neon.js summonOutput: past the master the event horizon
   zeroes, at the interface channel's level, muted with everything else).
   Lub-dub thumps a phone's speaker can still carry (a falling 150 -> 52 Hz
   body, not just sub-bass), and two close sines above 5 kHz beating slowly
   for the ring.

   createUnease(audio) -> { set(level 0..1), level(), stop(fadeS) } */

export function createUnease(audio) {
  const out = audio && audio.summonOutput ? audio.summonOutput() : null;
  let level = 0, stopped = false, timer = 0;
  const hook = () => { if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__EC_UNEASE__ = () => ({ level, stopped, sound: !!(out && out.ctx) }); };
  hook();
  if (!out || !out.ctx) {
    return { set(v) { level = Math.max(0, Math.min(1, v)); }, level: () => level, stop() { stopped = true; } };
  }
  out.resume();
  const { ctx, dest } = out;
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(dest);
  bus.gain.setTargetAtTime(1, ctx.currentTime, 0.6);

  // The ring: two sines 6 Hz apart (a slow beating), barely there at first.
  const ringG = ctx.createGain(); ringG.gain.value = 0;
  const rings = [5180, 5186].map((f) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0.5;
    o.connect(g).connect(ringG);
    o.start();
    return o;
  });
  ringG.connect(bus);

  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.8;
  lp.connect(bus);
  function thump(t, k) {
    const amp = (0.06 + 0.5 * level) * k;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(lp);
    o.start(t); o.stop(t + 0.34);
  }
  // Slower and softer at rest, quicker as it rises.
  function beat() {
    if (stopped) return;
    const t = ctx.currentTime + 0.03;
    thump(t, 1);
    thump(t + 0.26 - 0.06 * level, 0.68);
    timer = setTimeout(beat, (1.3 - 0.58 * level) * 1000);
  }
  beat();

  function set(v) {
    if (stopped) return;
    level = Math.max(0, Math.min(1, v));
    ringG.gain.setTargetAtTime(0.003 + 0.022 * level * level, ctx.currentTime, 0.8);
  }
  set(0);
  return {
    set,
    level: () => level,
    stop(fadeS = 1.2) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0, t, fadeS / 3);
      setTimeout(() => {
        rings.forEach((o) => { try { o.stop(); } catch (e) { /* done */ } });
        try { bus.disconnect(); } catch (e) { /* gone */ }
      }, fadeS * 1000 + 400);
    },
  };
}
