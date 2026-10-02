/* A volume fader, standing up (user: "make the slider vertical on all of
   them for the volume"): all the way down is off, the speaker with the X.
   Used by the dock's sound popover (chassis) and the phone bar's menu
   (MobileShell), one fader alone or a row of them like a mixing desk.

   It's still a native range input, only turned on its side: keyboard,
   screen readers and tests (fill) treat it as the slider it is, and a
   turned input is the one way to stand it up that every phone browser
   draws the same. Its value is 0-100; `level` and `onLevel` are 0..1. */
import React from "react";

export default function VolumeFader({ level, onLevel, label, hint, testid, height = 112, accent, color, muted, dim, labelFont }) {
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  const off = pct <= 0;
  return (
    <div
      title={hint || undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 62, flexShrink: 0, opacity: dim ? 0.45 : 1 }}
    >
      <span aria-hidden="true" style={{ font: `500 10.5px/1 ${labelFont || "'IBM Plex Mono', monospace"}`, color: muted, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", height: 12 }}>
        {off ? "off" : `${pct}`}
      </span>
      <div style={{ position: "relative", width: 30, height, touchAction: "none" }}>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onLevel(Number(e.target.value) / 100)}
          aria-label={`${label} volume`}
          aria-orientation="vertical"
          aria-valuetext={off ? "off" : `${pct}%`}
          data-testid={testid}
          data-level={pct}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: height,
            height: 30,
            margin: 0,
            // Turned a quarter anticlockwise: its left end, off, at the bottom.
            transform: `translate(-50%, -50%) rotate(-90deg)`,
            accentColor: accent,
            cursor: "pointer",
            touchAction: "none",
          }}
        />
      </div>
      <SpeakerGlyph level={pct / 100} color={muted} />
      <span style={{ font: `500 11.5px/1.2 ${labelFont || "'IBM Plex Sans', sans-serif"}`, color, textAlign: "center", maxWidth: 62, overflowWrap: "anywhere" }}>{label}</span>
    </div>
  );
}

// The speaker: crossed out when off, one wave when low, two when up.
export function SpeakerGlyph({ level, color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {level <= 0 ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : level < 0.5 ? (
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}
