import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t, trIn } from "./i18n.js";

/* Now playing, across the top of the sound menu (the dock's and the
   phone's), in every theme with music (user: "Go with option 4, all
   themes with music, being careful to ensure there is no overlap"): a
   play/pause, the track's title, a thin line for how far into it, and
   the time. Pausing holds the track exactly where it is; playing picks
   it up from there.

   `source.get()` says what's on: { title, at, length, paused, skips }
   (at and length in seconds; either may be missing), or null for
   nothing, and the strip isn't drawn. `source.toggle(paused)` pauses or
   plays. It's read four times a second while the menu is open.

   Back and forward (user, of Orinoco's and Watermark's soundtracks: "if
   you're in a song ... and you want to skip to the next song ... Or ...
   back to the beginning of a song you're currently listening to"), where
   get() says `skips` and there's a `source.skip(dir)` (-1 back, 1
   forward; what back does, the start or the song before, is the
   source's): either side of the play button, as on any player. Then the
   time goes under the title, at the end of its line, so the title keeps
   its room.

   No overlap: the button, the words and the time each have their own
   grid column (with back and forward, the three buttons share the
   first, and the time sits beside the line in a row of its own), a
   fixed 12px gap between them, and the title's box a
   little room on the left for an italic's overhang (Parrish's
   Cormorant). A title too long for its space scrolls (user): it rests a
   moment, glides along to its end, rests, and glides back, over and over
   (a reader who'd rather have no motion can swipe it along instead). The
   strip takes the
   menu's width and never sets it (width 0, min-width 100%), so a long
   title can't push the faders apart, and 12px in from each side. */
const fmt = (s) => {
  if (!(s >= 0) || !isFinite(s)) return null;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const REST_S = 1.6; // the pause at each end
const GLIDE_PX_S = 28; // how fast it moves along
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function NowPlaying({ source, ink, muted, hair, accent, font, testid = "now-playing" }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const got = source && source.get ? source.get() : null;
  // (Tests: a long title, to see it scroll.)
  const testTitle = typeof window !== "undefined" && window.__EC_TEST_HOOKS__ && window.__EC_NP_TITLE__;
  const s = got && testTitle ? { ...got, title: testTitle } : got;
  // How far the title runs past its space (0: it fits).
  const boxRef = useRef(null), textRef = useRef(null);
  const [over, setOver] = useState(0);
  const title = s && s.title;
  const skips = !!(s && s.skips && source.skip);
  useLayoutEffect(() => {
    const measure = () => {
      const b = boxRef.current, t = textRef.current;
      if (!b || !t) return;
      const d = Math.ceil(t.scrollWidth - b.clientWidth);
      setOver(d > 1 ? d : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    const fonts = typeof document !== "undefined" && document.fonts && document.fonts.addEventListener ? document.fonts : null;
    if (fonts) fonts.addEventListener("loadingdone", measure);
    return () => { window.removeEventListener("resize", measure); if (fonts) fonts.removeEventListener("loadingdone", measure); };
  }, [title, skips]);
  if (!s || !s.title) return null;
  const glide = over > 0 && !reducedMotion();
  const glideS = over / GLIDE_PX_S, cycle = 2 * (REST_S + glideS);
  const pc = (t) => `${((t / cycle) * 100).toFixed(2)}%`;
  const anim = glide ? `ec-np-glide-${over}` : null;
  const paused = !!s.paused;
  const pct = s.length > 0 && s.at >= 0 ? Math.max(0, Math.min(100, (s.at / s.length) * 100)) : null;
  const at = fmt(s.at), len = fmt(s.length);
  const btn = {
    height: 32, boxSizing: "border-box", background: "transparent", color: ink, cursor: "pointer", padding: 0, margin: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const toggle = (
    <button
      type="button"
      data-testid={`${testid}-toggle`}
      aria-label={paused ? t("Play {title}", { title: s.title }) : t("Pause {title}", { title: s.title })}
      title={paused ? trIn("Play", "music") : "Pause"}
      onClick={() => { source.toggle(!paused); tick((n) => n + 1); }}
      style={{ ...btn, width: 32, borderRadius: "50%", border: `1.5px solid ${ink}` }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {paused ? <path d="M7 4.5v15l12.5-7.5z" /> : <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" />}
      </svg>
    </button>
  );
  // (Plain marks either side of the round button, |◀ and ▶|.)
  const skip = (dir) => (
    <button
      type="button"
      data-testid={`${testid}-${dir < 0 ? "back" : "next"}`}
      aria-label={dir < 0 ? "Back to the start of the song, or the one before" : "Next song"}
      title={dir < 0 ? "Back" : "Next"}
      onClick={() => { source.skip(dir); tick((n) => n + 1); }}
      style={{ ...btn, width: 26, border: "none", borderRadius: 6 }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {dir < 0 ? <path d="M4.5 4.5h3v15h-3zM20 4.5v15L8.5 12z" /> : <path d="M16.5 4.5h3v15h-3zM4 4.5v15L15.5 12z" />}
      </svg>
    </button>
  );
  const time = (
    <span
      data-testid={`${testid}-time`}
      style={{ fontSize: 11.5, color: muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
    >{at ? (len ? `${at} / ${len}` : at) : paused ? "Paused" : ""}</span>
  );
  const line = (
    <div aria-hidden="true" style={{ height: 3, marginTop: skips ? 0 : 6, flex: skips ? "1 1 0" : undefined, minWidth: 0, borderRadius: 2, background: hair, overflow: "hidden" }}>
      {pct != null && <div style={{ width: `${pct}%`, height: "100%", background: accent }} />}
    </div>
  );
  return (
    <div
      data-testid={testid}
      data-paused={paused ? "true" : "false"}
      style={{
        // (Inset from the menu's edges, so its rule stops short of a
        // theme's inset frame: Parrish's gold one.)
        width: 0, minWidth: "calc(100% - 24px)", boxSizing: "border-box",
        display: "grid", gridTemplateColumns: skips ? "auto minmax(0, 1fr)" : "32px minmax(0, 1fr) auto", alignItems: "center", columnGap: 12,
        padding: "6px 2px 10px", margin: "0 12px 2px", borderBottom: `1px solid ${hair}`,
        color: ink, fontFamily: font,
      }}
    >
      {skips ? (
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>{skip(-1)}{toggle}{skip(1)}</div>
      ) : toggle}
      <div style={{ minWidth: 0, paddingLeft: 3 }}>
        <div
          ref={boxRef}
          data-testid={`${testid}-title`}
          data-scrolls={over > 0 ? "true" : "false"}
          title={s.title}
          style={{
            fontSize: 13.5, fontWeight: 500, lineHeight: 1.25, whiteSpace: "nowrap", opacity: paused ? 0.62 : 1,
            // (No motion wanted: a swipe moves it along instead.)
            overflowX: over > 0 && !glide ? "auto" : "hidden", overflowY: "hidden", scrollbarWidth: "none",
          }}
        >
          {anim && <style>{`@keyframes ${anim} { 0%, ${pc(REST_S)} { transform: translateX(0); } ${pc(REST_S + glideS)}, ${pc(2 * REST_S + glideS)} { transform: translateX(-${over}px); } 100% { transform: translateX(0); } }`}</style>}
          <span
            ref={textRef}
            style={{ display: "inline-block", paddingRight: 3, animation: anim ? `${anim} ${cycle.toFixed(2)}s ease-in-out infinite` : "none" }}
          >{s.title}</span>
        </div>
        {skips ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>{line}{time}</div>
        ) : line}
      </div>
      {!skips && time}
    </div>
  );
}
