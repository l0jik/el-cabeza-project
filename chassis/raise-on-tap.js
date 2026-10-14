/* Buttons that sit dimmed over the game till they're wanted (user, of the
   corner menu's Rules tab and the City's clock: "Dim the circled buttons
   ... a tap or hover before a click on a mouse will raise them 100%
   again", at 60%, the Rules tab in every world). Their CSS holds them at
   60% and lifts them under a mouse (hover: hover) or while [data-raised];
   this keeps [data-raised] for a touch screen, which has no hover: the
   first tap on the button raises it and a second opens it. Raised by a
   tap, it goes back down after RAISE_MS, at a tap anywhere else, or when
   what it opened closes. A mouse's click and a key's open it at once.

   const lift = useRaise(rootRef, open);
   <div data-raised={lift.raised ? "true" : "false"} onPointerDown={lift.onPointerDown}>
   ...its click: if (!open && lift.firstTapRaises(e)) return; (then open it) */
import { useEffect, useRef, useState } from "react";

export const RAISE_MS = 5000;

export function useRaise(rootRef, open) {
  const [raised, setRaised] = useState(false);
  const pointer = useRef("mouse");
  // (what it opened, closed: down again)
  useEffect(() => { if (!open) setRaised(false); }, [open]);
  useEffect(() => {
    if (!raised || open || typeof document === "undefined") return undefined;
    const down = setTimeout(() => setRaised(false), RAISE_MS);
    const away = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setRaised(false); };
    document.addEventListener("pointerdown", away, true);
    return () => { clearTimeout(down); document.removeEventListener("pointerdown", away, true); };
  }, [raised, open]);
  return {
    raised,
    onPointerDown: (e) => { pointer.current = e.pointerType || "mouse"; },
    // A tap (a finger or a pen; a key's click has no detail) on it while
    // it's down: taken to raise it, and nothing else.
    firstTapRaises: (e) => {
      const tap = !!e && e.detail > 0 && pointer.current !== "mouse";
      pointer.current = "mouse";
      if (!tap || raised) return false;
      setRaised(true);
      return true;
    },
  };
}
