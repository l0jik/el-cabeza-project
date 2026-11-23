/* The corner menu: the game's rules at the top left, in every world, in
   the world's own look (chassis/corner-menu.js has the data and the ten
   looks). Closed, a tab with a line summing the game up; a tap opens the
   card (the laws and their settings, each side's pieces, the board, a
   way into the rules); a tap outside it, Escape or the tab again close
   it. A law's name opens its rules card; "Rules" opens the game's. The
   tab sits dimmed till it's wanted (raise-on-tap.js): a mouse over it, or
   on a touch screen a first tap, raises it, and a second tap opens it. */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openRules } from "./RulesCards.jsx";
import { cornerMenuParts } from "./corner-menu.js";
import { useRaise } from "./raise-on-tap.js";
import { useLanguage } from "./i18n.js";
import { fontsHref } from "./font-links.js";

// Each look's type, fetched once (a world's own CSS may already have it;
// the den's Caprasimo, for one, comes late): Google's, or the app's copy.
function useFonts(look, fonts) {
  useEffect(() => {
    if (!fonts || typeof document === "undefined") return;
    const id = `cm-fonts-${look}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = fontsHref(fonts);
    document.head.appendChild(link);
  }, [look, fonts]);
}

// below: the px its top stands at instead of its own (out from under the
// replay's bar), or null. Straight there, no glide: it comes up as a
// replay starts playing, so a glide began over the bar.
// onChangeRules: Change rules on the card (where the rules can be chosen:
// the chassis's askChangeRules), or null.
export default function CornerMenu({ look, rules, extra = null, audio = null, below = null, onChangeRules = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const lift = useRaise(ref, open);
  // (Its lines are made in the language: made again when it changes.)
  useLanguage();
  const { tab, card, css, fonts } = cornerMenuParts(look, rules, extra, !!onChangeRules);
  useFonts(look, fonts);

  const shut = () => { setOpen(false); if (audio && audio.playDockClose) audio.playDockClose(); };
  /* The card fitted to the screen as it opens (user: "The bottom of the
     menu circled in red is cut off"): as tall as the room from where it
     stands (under the tab, however tall the phone's size of words makes
     that, and however far down a camera's notch puts it) to the screen's
     foot, the rest a scroll inside it; and as much wider as the words are
     bigger (--cm-tz: the phone's size of words, measured, the app passing
     its large font on), so a piece's name and count keep to a line. */
  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const fit = () => {
      const root = ref.current, card = root && root.querySelector(".cm-card");
      if (!card) return;
      const probe = document.createElement("span");
      probe.textContent = "0";
      probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;line-height:1";
      root.appendChild(probe);
      const tz = Math.max(1, Math.min(2, (parseFloat(getComputedStyle(probe).fontSize) || 100) / 100));
      probe.remove();
      root.style.setProperty("--cm-tz", tz.toFixed(3));
      const top = Math.max(0, card.getBoundingClientRect().top);
      const shell = document.documentElement.classList.contains("ec-shell");
      card.style.maxHeight = shell
        ? `calc(${Math.round(window.innerHeight - top)}px - var(--ec-shell-bottom, 120px) - 10px)`
        : `calc(${Math.round(window.innerHeight - top - 14)}px - env(safe-area-inset-bottom, 0px))`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) shut(); };
    // (Escape closes the menu first, before anything under it.)
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); shut(); } };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown, true); window.removeEventListener("keydown", onKey, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The markup is the look's; what was pressed is read off it.
  const onClick = (e) => {
    const t = e.target.closest && e.target.closest("[data-cm]");
    if (!t) return;
    const what = t.getAttribute("data-cm");
    if (what === "tab") {
      if (open) shut();
      else if (lift.firstTapRaises(e)) return;
      else { setOpen(true); if (audio && audio.playDockOpen) audio.playDockOpen(); }
    } else if (what === "rules") { setOpen(false); openRules("game"); }
    else if (what === "law") { setOpen(false); openRules("moves", t.getAttribute("data-law")); }
    else if (what === "extra" && extra && extra.onClick) { setOpen(false); extra.onClick(); }
    else if (what === "change" && onChangeRules) { setOpen(false); onChangeRules(); }
  };

  return (
    <div
      ref={ref}
      className={`cm cm-${look}`}
      data-testid="corner-menu"
      data-look={look}
      data-open={open ? "true" : "false"}
      data-raised={lift.raised ? "true" : "false"}
      onPointerDown={lift.onPointerDown}
      onClick={onClick}
      style={below != null ? { top: below } : undefined}
    >
      <style>{css}</style>
      <button
        type="button"
        className="cm-tab"
        data-cm="tab"
        data-testid="corner-menu-tab"
        aria-expanded={open}
        dangerouslySetInnerHTML={{ __html: tab }}
      />
      {open && (
        <div
          className="cm-card"
          data-testid="corner-menu-card"
          role="dialog"
          aria-label="This game's rules"
          dangerouslySetInnerHTML={{ __html: card }}
        />
      )}
    </div>
  );
}
