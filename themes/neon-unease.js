/* The Singularity's first visit in the story (LostNudge, neon-singularity.js):
   the silence there isn't quite silence at first. A heartbeat and a ringing
   in the ears as the sphere comes up, gone again in about three seconds
   (user: the ring with more reverb and lower, and both fading to silence
   after about three seconds; the caller stops it). Out through the
   summons' way out (neon.js summonOutput: past the master the event horizon
   zeroes, at the interface channel's level, muted with everything else).
   Lub-dub thumps a phone's speaker can still carry (a falling 150 -> 52 Hz
   body, not just sub-bass), and for the ring one steady sine at 2.64 kHz
   (no beating: user), most of it heard through a smooth, dark room.

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

  // The ring: one steady sine (user: no vibrato, no bouncing; it was two
  // sines 2.5 Hz apart, beating), into a smooth room whose tail dies away
  // evenly (an exponential decay, RT60 about 2.6 s, its noise smoothed),
  // so the whole thing goes down in a straight line when it fades.
  const ringG = ctx.createGain(); ringG.gain.value = 0;
  const rings = [2640].map((f) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 1;
    o.connect(g).connect(ringG);
    o.start();
    return o;
  });
  const room = ctx.createConvolver();
  {
    const RT60 = 2.6, len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    const k = 6.9 / (RT60 * ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { lp = lp * 0.7 + (Math.random() * 2 - 1) * 0.3; d[i] = lp * Math.exp(-k * i); }
    }
    room.buffer = ir;
  }
  const dry = ctx.createGain(); dry.gain.value = 0.62;
  const wet = ctx.createGain(); wet.gain.value = 2.3;
  ringG.connect(dry).connect(bus);
  ringG.connect(room); room.connect(wet).connect(bus);

  // The heartbeat on its own fader, so it can stop before the ring does.
  const beatG = ctx.createGain(); beatG.gain.value = 1;
  beatG.connect(bus);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.8;
  lp.connect(beatG);
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
    /* fadeS: the heartbeat fades out over it. ringS: the ring fades over
       that long, a steady exponential slide (a straight line down in
       loudness, about 9 dB a second) to -30 dB, the room's own tail dying away with it; the
       last of it is let go over a further 0.6 s. Without ringS, all of it
       ramps straight to silence over fadeS. */
    stop(fadeS = 1.2, ringS = 0) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      const t = ctx.currentTime;
      const ramp = (param, at, to) => { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, at); };
      ramp(beatG.gain, t + fadeS, 0);
      let total = fadeS;
      if (ringS > 0) {
        const g = ringG.gain, from = Math.max(0.0005, g.value);
        g.cancelScheduledValues(t);
        g.setValueAtTime(from, t);
        g.exponentialRampToValueAtTime(from * 0.03, t + ringS);
        g.setValueAtTime(0, t + ringS + 0.01);
        total = Math.max(fadeS, ringS) + 0.6;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(bus.gain.value, t);
        bus.gain.setValueAtTime(bus.gain.value, t + total - 0.6);
        bus.gain.linearRampToValueAtTime(0, t + total);
      } else {
        ramp(bus.gain, t + fadeS, 0);
      }
      setTimeout(() => {
        rings.forEach((o) => { try { o.stop(); } catch (e) { /* done */ } });
        try { bus.disconnect(); } catch (e) { /* gone */ }
      }, total * 1000 + 400);
    },
  };
}

/* ...and after the ring, the drone (user: the ring, then silence for
   about four seconds, then this): the user's recording of an industrial
   pulse drone, looped (tools/neon_sphere_drone.py: its steady part, the
   join crossfaded; DRONE_LOOP from there), out the same way as the ring.
   A file beside the page, fetched when the sphere comes up; from disk
   (file:) there's no fetching, so no drone there.

   createDrone(audio) -> { start(delayS, fadeS), stop(fadeS) } */
const DRONE_URL = "el-cabeza-neon-sphere-drone.mp3";
const DRONE_FROM = 1.0, DRONE_LOOP = 21.5, DRONE_LEVEL = 0.5;
export function createDrone(audio) {
  const out = audio && audio.summonOutput ? audio.summonOutput() : null;
  let buf = null, src = null, bus = null, startAt = 0, fadeIn = 2.5, wanted = false, stopped = false;
  const hook = () => { if (typeof window !== "undefined" && window.__EC_TEST_HOOKS__) window.__EC_DRONE__ = () => ({ loaded: !!buf, playing: !!src, stopped, wanted, startsIn: src && out && out.ctx ? Math.max(0, startAt - out.ctx.currentTime) : null }); };
  hook();
  if (!out || !out.ctx) return { start() {}, stop() { stopped = true; } };
  const { ctx, dest } = out;
  const play = () => {
    if (!buf || src || stopped || !wanted) return;
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(dest);
    const at = Math.max(ctx.currentTime + 0.05, startAt);
    bus.gain.setValueAtTime(0.0001, at);
    bus.gain.exponentialRampToValueAtTime(DRONE_LEVEL, at + fadeIn);
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.loopStart = DRONE_FROM; src.loopEnd = DRONE_FROM + DRONE_LOOP;
    src.connect(bus);
    src.start(at, DRONE_FROM);
  };
  if (!(typeof location !== "undefined" && location.protocol === "file:")) {
    fetch(DRONE_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then((b) => ctx.decodeAudioData(b)).then((b) => { buf = b; play(); }).catch(() => { /* none, then */ });
  }
  return {
    // In `delayS` seconds, fading up over `fadeS` (or as soon as it's here).
    start(delayS = 0, fadeS = 2.5) { if (stopped || wanted) return; wanted = true; startAt = ctx.currentTime + delayS; fadeIn = fadeS; out.resume(); play(); },
    stop(fadeS = 1.2) {
      if (stopped) return;
      stopped = true;
      if (!src) return;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + fadeS);
      const s = src, b = bus; src = null;
      s.stop(t + fadeS + 0.05);
      setTimeout(() => { try { b.disconnect(); } catch (e) { /* gone */ } }, (fadeS + 0.2) * 1000);
    },
  };
}
