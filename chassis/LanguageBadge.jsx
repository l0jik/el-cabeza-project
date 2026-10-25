/* The language, in the dock (user: "For the language picker, go with 2 and
   4"): its two letters in a little box, one of the dock's quiet foot icons
   on a computer (left of the piece guide's), at the end of the "… to move"
   line on a phone. A press opens the three over it, each named in its own
   language, the one in use dotted; a press outside or Escape closes it.
   The change is at once, the game as it was (chassis/i18n.js). */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANGUAGES, setLanguage, useLanguage } from "./i18n.js";

const LIST_W = 236;

export default function LanguageBadge({ ink, muted, surface, hair, style, disabled, lockProps, testid = "language-badge" }) {
  const code = useLanguage();
  const [at, setAt] = useState(null);
  const badge = useRef(null), list = useRef(null);
  useEffect(() => {
    if (!at) return undefined;
    const outside = (e) => {
      if ((list.current && list.current.contains(e.target)) || (badge.current && badge.current.contains(e.target))) return;
      setAt(null);
    };
    const key = (e) => { if (e.key === "Escape") setAt(null); };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key); };
  }, [at]);
  const now = LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
  const open = (e) => {
    if (at) { setAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setAt({ left: Math.max(8, Math.min(window.innerWidth - LIST_W - 8, r.left + r.width / 2 - LIST_W / 2)), bottom: window.innerHeight - r.top + 8 });
  };
  return (
    <>
      <button
        ref={badge}
        type="button"
        data-testid={testid}
        data-lang={code}
        aria-haspopup="true"
        aria-expanded={!!at}
        aria-label="Language"
        title="Language"
        disabled={disabled}
        {...lockProps}
        onClick={open}
        style={{
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          background: "transparent",
          border: "none",
          color: muted,
          opacity: at ? 0.85 : 0.45,
          cursor: "pointer",
          transition: "opacity 0.2s ease",
          flexShrink: 0,
          ...style,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.85; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = at ? 0.85 : 0.45; }}
      >
        <span aria-hidden="true" style={{ font: "600 9.5px/1 'IBM Plex Mono', monospace", letterSpacing: "0.06em", border: "1.4px solid currentColor", borderRadius: 4, padding: "3px 3px 2px 4px" }}>
          {now.short}
        </span>
      </button>
      {/* (On the page itself: the dock's panel is scaled as it opens, and
         a fixed list inside it would be placed from the panel, not the
         screen.) */}
      {at && createPortal(
        <div
          ref={list}
          data-testid="language-list"
          role="menu"
          style={{
            position: "fixed",
            left: at.left,
            bottom: at.bottom,
            zIndex: 1045,
            width: LIST_W,
            maxWidth: "calc(100vw - 16px)",
            boxSizing: "border-box",
            padding: "8px 0",
            background: surface,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${hair}`,
            borderRadius: 10,
            boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
            color: ink,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {/* (The same in every language: whoever can't read the one in
             use can still find theirs.) */}
          <div aria-hidden="true" style={{ padding: "6px 16px 9px", fontSize: 9.5, letterSpacing: "0.14em", opacity: 0.6 }}>
            {"Language · Idioma · Ngôn ngữ"}
          </div>
          {LANGUAGES.map((l) => {
            const on = l.code === code;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                data-lang={l.code}
                lang={l.code}
                onClick={() => { setAt(null); setLanguage(l.code); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  background: on ? "rgba(128, 128, 128, 0.12)" : "transparent",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  letterSpacing: "inherit",
                  textTransform: "inherit",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", boxSizing: "border-box", ...(on ? { background: ink } : { border: `1.2px solid ${ink}`, opacity: 0.45 }) }} />
                <span>{l.region ? `${l.name} · ${l.region}` : l.name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
