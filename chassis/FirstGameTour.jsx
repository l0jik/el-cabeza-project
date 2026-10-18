import React, { useEffect, useLayoutEffect, useState } from "react";

/* A new player's first game, walked through (user, 2026-10-17: "They
   click begin a game, and then a little pop-up will say, "Welcome to your
   first game of El Cabeza." Copyright 1975 ... You are the light / ash
   colored pieces, and you're trying to get your disc to the other
   player's back row or use your blocks to crush their disc ... this needs
   to be a walkthrough basically as to how to play the game ... it'll
   say, you get to move first ... you have two action points ... the board
   is fully rotatable and zoomable. They click on a piece and it'll say
   what it is. And then it'll show what the movements are. And it'll kind
   of zoom in on it a little bit ... We need to create a first-time player
   walkthrough tutorial").

   The chassis runs it (ElCabeza3D.jsx, tourStep) and hands this the
   moment as `tour`. As the game begins, three cards over the board, one
   after another: the welcome, the turn, the board. Then a card at the
   top while your first turn is played: tap a piece and it says what the
   piece is, how far it moves and how many times a turn, its squares lit
   and the camera a little closer (the chassis's frameTourPiece). Once
   your turn's done, a card for the other side's turn, which stays until
   it's put away or a piece is picked on your next; then it's over. Any
   card can skip it. Kept as done on the device (TOUR_KEY), so it comes once;
   ?fresh forgets it. A world offers it with theme.firstGameTour (the
   store, before the game's bought: tienda.js). */

export const TOUR_KEY = "el-cabeza:first-game-tour";
export function tourDone() {
  try { return window.localStorage.getItem(TOUR_KEY) === "done"; } catch (e) { return false; }
}
export function markTourDone() {
  try { window.localStorage.setItem(TOUR_KEY, "done"); } catch (e) { /* storage unavailable */ }
}

// The cards over the board, in order; then "pieces" (the first turn) and
// "foe" (the other side's turn after it).
export const TOUR_CARDS = ["welcome", "turn", "board"];

const WORDS = ["no", "one", "two", "three", "four", "five"];
const word = (n) => WORDS[n] || String(n);
const mono = "'IBM Plex Mono', monospace";
const sans = "'IBM Plex Sans', sans-serif";

// What a card says: { title, sub, body: [...], rows: [[label, text]], note }.
function cardText(t) {
  const tap = t.touch ? "Tap" : "Click";
  const tapLow = t.touch ? "tap" : "click";
  const foe = t.foe;
  switch (t.step) {
    case "welcome":
      return {
        title: (t.copy && t.copy.title) || "Welcome to your first game of El Cabeza.",
        sub: (t.copy && t.copy.fine) || null,
        body: [
          `You're ${t.mine}${t.mineHint ? `, the ${t.mineHint} pieces` : ""}. The computer plays ${foe}${t.foeHint ? `, the ${t.foeHint}` : ""}.`,
          `To win, get your disc, the Cabeza, onto ${foe}'s back row, or crush ${foe}'s Cabeza with one of your blocks.`,
        ],
      };
    case "turn":
      return {
        title: t.youFirst ? "You move first." : `${foe} moves first.`,
        body: [
          `Every turn you have ${word(t.budget)} actions${t.split ? `, shared by up to ${word(t.split)} pieces` : ", all for one piece"}. A roll or a step is one action${t.hasOpa ? "; the big Opa's move takes two" : ""}.`,
          // (The Punto law cuts the opening turn by one: said where it's on.)
          t.punto ? `${t.youFirst ? "Your" : `${foe}'s`} very first turn has one action fewer: this game plays the Punto law.` : null,
          t.dots || null,
        ],
      };
    case "board":
      return {
        title: "The board turns and zooms.",
        body: [
          t.touch ? "Drag a finger across it to turn it all the way round, and pinch to zoom in or out." : "Drag across it to turn it all the way round, and scroll to zoom in or out.",
          "Look from wherever you like: it doesn't change the game.",
        ],
      };
    case "pieces": {
      if (t.waiting) return { title: `${foe} is moving.`, body: ["Your turn's next."] };
      const l = t.lesson;
      if (!l) {
        return {
          title: `${tap} one of your pieces.`,
          body: ["Each one moves its own way. This card says what it is, and the squares it can move to light up."],
        };
      }
      const rows = [["Moves", l.moves], ["A turn", l.turn]];
      if (l.aim) rows.push(["Aim", l.aim]);
      (l.extra || []).forEach((x) => rows.push(["Also", x]));
      return { title: l.name, sub: l.what || null, rows, note: t.status || null };
    }
    case "foe":
      return t.waiting
        ? { title: `${foe}'s turn.`, body: ["The computer moves now, and then it's your turn again.", `From here on, ${tapLow} any of your pieces to see what it does.`] }
        : { title: "Your turn again.", body: [`${tap} any of your pieces to see what it does. Good luck!`] };
    default:
      return null;
  }
}

export default function FirstGameTour({ tour, cardRef }) {
  const { step, C, display } = tour;
  const card = TOUR_CARDS.includes(step);
  // A card over the board: Escape skips the tour, as its link does.
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === "Escape") tour.skip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, tour.skip]);
  /* The card at the top keeps below what a world fixes at the top over it
     where the two would meet: the corner menu's tab, and whatever the
     world names (copy.clear; a phone: the store's price tag lay over the
     card's head). */
  const clear = ['[data-testid="corner-menu-tab"]', tour.copy && tour.copy.clear].filter(Boolean).join(", ");
  const [below, setBelow] = useState(0);
  useLayoutEffect(() => {
    if (card) return undefined;
    const place = () => {
      const el = cardRef && cardRef.current;
      if (!el) return;
      const a = el.getBoundingClientRect();
      let low = 0;
      document.querySelectorAll(clear).forEach((x) => {
        const b = x.getBoundingClientRect();
        if (b.width && b.height && b.right > a.left && b.left < a.right && b.top < window.innerHeight / 3) low = Math.max(low, b.bottom);
      });
      setBelow(low ? Math.round(low + 8) : 0);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [card, step, cardRef, clear]);
  const narrow = typeof window !== "undefined" && window.innerWidth < 520;
  // On a wide screen the card at the top keeps to the left, so the board
  // has the room beside it (the lessons' camera frames the piece there).
  const side = !card && typeof window !== "undefined" && window.innerWidth >= 900;
  const text = cardText(tour);
  if (!text) return null;
  const index = TOUR_CARDS.indexOf(step);
  const band = `${(tour.copy && tour.copy.band) || "First game"}${card ? ` · ${index + 1} of ${TOUR_CARDS.length + 1}` : ""}`;
  const primary = card
    ? { label: index < TOUR_CARDS.length - 1 ? "Next ›" : "Let's play ›", onClick: tour.next, testid: "tour-next" }
    : step === "foe" ? { label: "Got it", onClick: tour.finish, testid: "tour-done" } : null;
  const link = card
    ? { label: "Skip the tour", onClick: tour.skip, testid: "tour-skip" }
    : step === "pieces" ? { label: "End the tour", onClick: tour.finish, testid: "tour-end" } : null;
  const body = (
    <div
      ref={cardRef}
      data-testid="tour-card"
      data-step={step}
      role={card ? "dialog" : "status"}
      aria-modal={card ? "true" : undefined}
      aria-live={card ? undefined : "polite"}
      aria-labelledby="ec-tour-title"
      style={{
        ...(card
          ? { position: "relative", width: "min(420px, 100%)", maxHeight: "100%", overflowY: "auto", animation: "ecTourIn 0.32s ease both" }
          : {
              position: "fixed",
              top: below ? below : "calc(var(--ec-shell-top, env(safe-area-inset-top, 0px)) + 12px)",
              left: side ? "max(16px, env(safe-area-inset-left, 0px))" : "50%",
              transform: side ? "none" : "translateX(-50%)",
              zIndex: 13,
              width: side ? 360 : "min(calc(100vw - 32px), 440px)",
              // (A phone on its side: the card scrolls rather than runs off.)
              maxHeight: `calc(100vh - ${below ? below + 12 : 24}px)`,
              overflowY: "auto",
              animation: side ? "ecTourIn 0.3s ease both" : "ecTourDrop 0.3s ease both",
            }),
        boxSizing: "border-box",
        padding: card ? "18px 20px 16px" : narrow ? "10px 13px 9px" : "12px 15px 11px",
        borderRadius: 10,
        background: C.cream,
        border: `1px solid ${C.slateSoft}`,
        boxShadow: "0 14px 40px rgba(0,0,0,0.32)",
        color: C.charcoal,
        fontFamily: sans,
        fontSize: card ? 14.5 : narrow ? 12.5 : 13.5,
        lineHeight: card ? 1.5 : 1.42,
        pointerEvents: "auto",
      }}
    >
      <div data-testid="tour-band" style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.slate, marginBottom: card ? 10 : 6 }}>
        {band}
      </div>
      <h2 id="ec-tour-title" data-testid="tour-title" style={{ margin: 0, fontFamily: display, fontWeight: 600, fontSize: card ? 22 : narrow ? 16.5 : 18, lineHeight: 1.2, textWrap: "balance" }}>
        {text.title}
      </h2>
      {text.sub && (
        <div data-testid="tour-sub" style={{ marginTop: 3, fontFamily: step === "welcome" ? mono : sans, fontSize: step === "welcome" ? 11 : 13, letterSpacing: step === "welcome" ? "0.14em" : 0, color: C.slate }}>
          {text.sub}
        </div>
      )}
      {text.body && (
        <div data-testid="tour-body" style={{ marginTop: card ? 12 : 6, display: "flex", flexDirection: "column", gap: 8 }}>
          {text.body.filter(Boolean).map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}
        </div>
      )}
      {text.rows && (
        <div data-testid="tour-rows" style={{ marginTop: narrow ? 6 : 8, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 10, rowGap: narrow ? 3 : 5, alignItems: "baseline" }}>
          {text.rows.map(([k, v], i) => (
            <React.Fragment key={k + i}>
              <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.slate, whiteSpace: "nowrap" }}>{k}</span>
              <span data-testid={`tour-row-${k.toLowerCase().replace(/\s+/g, "-")}`}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {text.note && (
        <div data-testid="tour-note" style={{ marginTop: narrow ? 6 : 8, paddingTop: narrow ? 5 : 7, borderTop: `1px solid ${C.slateSoft}`, fontWeight: 600 }}>
          {text.note}
        </div>
      )}
      {(primary || link) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: link && primary ? "space-between" : "flex-end", gap: 12, marginTop: card ? 16 : narrow ? 4 : 9 }}>
          {link && (
            <button type="button" data-testid={link.testid} onClick={link.onClick} style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", color: C.slate, fontFamily: sans, fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
              {link.label}
            </button>
          )}
          {primary && (
            <button
              type="button"
              className="ec-btn"
              data-testid={primary.testid}
              onClick={primary.onClick}
              autoFocus={card}
              style={{ background: C.charcoal, color: C.cream, border: `1px solid ${C.charcoal}`, borderRadius: 6, padding: card ? "10px 18px" : "7px 14px", cursor: "pointer", fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}
            >
              {primary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
  const css = "@keyframes ecTourIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes ecTourDrop{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion: reduce){[data-testid=\"tour-card\"]{animation:none!important}}";
  if (!card) return <><style>{css}</style>{body}</>;
  return (
    <div
      data-testid="tour-scrim"
      style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", boxSizing: "border-box", background: "rgba(14,10,6,0.34)" }}
    >
      <style>{css}</style>
      {body}
    </div>
  );
}
