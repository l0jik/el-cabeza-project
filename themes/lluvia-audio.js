/* Lluvia's sound: the city's own score, and the game's cues played on
   its instruments.

   The score (createScore in themes/lluvia-city.js) is the synth one: slow
   detuned pads and a brass swell, rain and a low drone, a siren or a
   spinner now and then, thunder, and from down the street, once in a
   while, a đàn bầu, a zither or a far cải lương voice. The game starts
   it at Begin Game and winds it down at the end, with the same
   wind-down contract as the other themes (beginFadeOut/resetWindDown).

   The cues: a terminal blip to pick a piece up, a whoosh as it moves, a
   heavy wet thunk where it lands (the big drum under the heaviest), and
   thunder, brass and drum when a Cabeza is crushed. Thunder is also
   announced on themes/lluvia-bus.js so the sky can flash with it. */

import { createScore } from "./lluvia-city.js";
import { bus } from "./lluvia-bus.js";

export const hasAudio = true;
const LEVEL = 0.9; // the score's own master level

export function createAudio() {
  let score = null, I = null;
  let muted = false, windingDown = false;

  function ensureGraph() {
    if (score) return;
    try {
      score = createScore({ onThunder: (delay, level) => bus.emit("thunder", delay, level) });
      I = score && score.inst;
      if (score && muted) score.mute(true);
    } catch (e) {
      score = null; I = null;
    }
  }
  function ensureStarted() {
    ensureGraph();
    if (score) score.resume();
  }
  const at = () => I.ctx.currentTime + 0.01;
  const ready = () => { ensureGraph(); return !!I; };

  function setMaster(v, ramp) {
    if (!I) return;
    const g = I.master.gain, t = I.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (ramp) g.linearRampToValueAtTime(v, t + ramp); else g.setValueAtTime(v, t);
  }
  function bedsOff() {
    if (!I) return;
    I.ambient(false); I.drips(0);
    const t = I.ctx.currentTime;
    I.rainG.gain.setTargetAtTime(0, t, 0.8);
    I.droneG.gain.setTargetAtTime(0, t, 0.8);
  }

  function beginGameFadeIn() {
    ensureStarted();
    if (!I) return;
    setMaster(muted ? 0 : LEVEL);
    score.city(); // rain, drone, drips and the pads' slow cycle
  }
  function beginFadeOut(seconds) {
    if (windingDown) return;
    windingDown = true;
    if (!I) return;
    I.ambient(false); I.drips(0);
    setMaster(0, seconds || 3);
  }
  function resetWindDown(restoreVolume) {
    if (!windingDown) return;
    windingDown = false;
    if (!I) return;
    if (restoreVolume === true) {
      score.resume();
      setMaster(muted ? 0 : LEVEL, 0.6);
      score.city();
    } else if (restoreVolume === "sfxOnly") {
      setMaster(muted ? 0 : LEVEL);
      bedsOff();
    }
  }
  function setMuted(m) {
    muted = m;
    if (score) score.mute(m);
  }
  function setZoom(z) {
    if (!I || windingDown) return;
    // Pulled back, the rain is louder; in close, the pieces are.
    I.rainG.gain.setTargetAtTime(0.1 + 0.05 * (1 - z), I.ctx.currentTime, 0.6);
  }
  function setTension(v) {
    if (!I || windingDown) return;
    I.droneG.gain.setTargetAtTime(0.055 + 0.05 * v, I.ctx.currentTime, 1.5);
  }

  /* ---- cues ---- */
  function thump(t, f, level, dur) {
    const c = I.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); I.out(g, 1, 0.25); o.start(t); o.stop(t + dur + 0.05);
  }
  function splash(t, level, centre) {
    const c = I.ctx, n = I.noise(t, 0.2), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(centre, t); bp.frequency.exponentialRampToValueAtTime(centre * 0.5, t + 0.15);
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp).connect(g); I.out(g, 1, 0.35);
  }
  function blip(t, freqs, level, step) {
    const c = I.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "square"; freqs.forEach((f, k) => o.frequency.setValueAtTime(f, t + k * step));
    lp.type = "lowpass"; lp.frequency.value = 2600;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + freqs.length * step + 0.05);
    o.connect(lp).connect(g); I.out(g, 1, 0.3); o.start(t); o.stop(t + freqs.length * step + 0.08);
  }
  const mass = (v) => Math.max(1, Math.min(8, v || 1));

  return {
    ensureStarted, beginGameFadeIn, setZoom, setMuted, setTension, beginFadeOut, resetWindDown,
    playSelect() { if (ready()) score.select(); },
    playDeselect() { if (ready()) score.close(); },
    playBlocked() { if (!ready()) return; const t = at(); blip(t, [180], 0.03, 0.06); blip(t + 0.1, [150], 0.03, 0.06); },
    playRollStart(volumeUnits, durationMs) {
      if (!ready()) return;
      const m = mass(volumeUnits);
      I.whoosh(at(), Math.max(0.2, (durationMs || 400) / 1000), 0.025 + 0.008 * m);
    },
    playLanding(volumeUnits) {
      if (!ready()) return;
      const m = mass(volumeUnits), t = at();
      thump(t, 46 + 24 / m, 0.07 * Math.sqrt(m), 0.14 + 0.03 * m);
      splash(t, 0.035 + 0.01 * m, 1500 / Math.sqrt(m));
      if (m >= 4) I.trongChau(t + 0.01, 0.06 + 0.01 * m);
    },
    playCapture() {
      if (!ready()) return;
      const t = at();
      I.thunder(t, 0.26);
      I.trongChau(t, 0.28); I.trongChau(t + 0.28, 0.22);
      I.brass(t + 0.05, [38, 45, 50, 53, 57], 2.4, 0.02);
    },
    playWin() {
      if (!ready()) return;
      const t = at();
      I.brass(t, [50, 57, 62, 66, 69], 3, 0.022);
      I.jingle(t + 0.5);
      I.far(() => I.danBau(t + 1.4, 62, 4.5, 3, 0.045), -0.3);
    },
    playMenu() { if (ready()) I.far(() => I.ghostVoice(at(), [[69, 0], [72, 0.3], [69, 0.6], [67, 0.85]], 6, 0.016), 0.2); },
    fadeOutMenu() {}, stopMenu() {},
    playRulesOpen() { if (ready()) I.bell(at(), I.mtof(84), 0.03, 1.2); },
    playRulesClose() { if (ready()) I.bell(at(), I.mtof(79), 0.024, 1); },
    playRulesTab() { if (ready()) score.key(); },
    playPowerOn() { ensureStarted(); if (I) score.begin(); },
    playPowerOff() {
      if (!ready()) return;
      const t = at();
      I.bell(t, 146.8, 0.07, 3);
      I.pad(t, [38, 45, 50, 53], 3.5, 0.016, false);
      I.whoosh(t + 0.2, 1.6, 0.04);
    },
    playDockOpen() { if (ready()) I.whoosh(at(), 0.32, 0.03); },
    playDockClose() { if (ready()) I.whoosh(at(), 0.26, 0.022); },
    // Neon-only effects; the chassis calls every audio method unconditionally.
    playFlicker() {}, playArc() {}, playGlitch() {},
    playSingularityOpen() {}, playSingularityClose() {}, playSingularityBell() {}, playSingularityDismiss() {},
    startSingularityHum() {}, updateSingularityHum() {}, stopSingularityHum() {},
    continueSingularityHumThroughCollapse() {}, startSingularityCollapseRoar() {},
    cutSingularityAudioToSilence() {}, resumeAudioAfterSingularity() {},
    dispose() { if (score) score.stop(); },
  };
}
