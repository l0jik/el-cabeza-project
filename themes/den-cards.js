/* The den's 1975 cards (user: all in one style, askance, clear of what
   matters, movable): the thought on coming home with the order ("Finally…
   now I can play a game in peace."), "Free pieces?! Nice!…" after the
   call, and the home-again card after the trip. Cream card, the decade's
   stripes (brown, rust, orange, mustard) across the top, chunky Caprasimo,
   a hard brown shadow; tilted a few degrees and tucked into the upper
   right, out of the board's way (the title holds the top middle, the
   call's slip and the dock the bottom). A drag moves it anywhere; a tap
   is the card's own (onTap). The car's and the hallway's speech balloons
   are another thing (den-trip.js, den-hall.js). */

const CSS = `
.den-card { position: fixed; z-index: 1195; top: calc(17% + env(safe-area-inset-top)); right: max(14px, 3vw); width: min(66vw, 340px);
  touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  --tilt: 3deg; transform: rotate(var(--tilt)); }
.den-card.left { right: auto; left: max(14px, 3vw); --tilt: -3.5deg; }
.den-card.dragging { cursor: grabbing; }
.den-card .card { position: relative; padding: 16px 20px 15px; background: #F3E6C4; border: 3px solid #4A2A14; border-radius: 16px;
  box-shadow: 6px 7px 0 #4A2A14, 0 14px 30px rgba(20,10,4,0.45); color: #4A2A14;
  animation: denCardIn 0.7s cubic-bezier(0.2, 1.6, 0.4, 1) both; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.den-card.dragging .card { transform: scale(1.04); box-shadow: 9px 11px 0 #4A2A14, 0 20px 36px rgba(20,10,4,0.5); }
.den-card .stripes { display: flex; height: 13px; margin: -16px -20px 12px; border-radius: 13px 13px 0 0; overflow: hidden; }
.den-card .stripes i { flex: 1; } .den-card .stripes i:nth-child(1) { background: #6B3A1E; } .den-card .stripes i:nth-child(2) { background: #B4451F; }
.den-card .stripes i:nth-child(3) { background: #E07B22; } .den-card .stripes i:nth-child(4) { background: #E9B23A; }
.den-card .l1 { display: block; font: 400 clamp(19px, 5.2vw, 24px)/1.18 'Caprasimo', 'Cooper Black', Georgia, serif; text-wrap: balance; }
.den-card.loud .l1 { font-size: clamp(24px, 7vw, 34px); line-height: 1.05; color: #B4451F; text-shadow: 2px 2px 0 #E9B23A; }
.den-card .l2 { display: block; margin-top: 8px; font: 400 clamp(17px, 4.8vw, 22px)/1.15 'Caprasimo', 'Cooper Black', Georgia, serif;
  animation: denCardLine 0.6s cubic-bezier(0.2, 1.5, 0.4, 1) 1.1s both; }
.den-card small { display: block; margin-top: 12px; text-align: right; font: 700 11px/1 'Libre Franklin', Arial, sans-serif; letter-spacing: 0.16em;
  text-transform: uppercase; color: #B4451F; }
.den-card.off { transition: opacity 0.6s ease; opacity: 0; pointer-events: none; }
@keyframes denCardIn { from { opacity: 0; transform: translateY(-10px) scale(0.6); } to { opacity: 1; transform: none; } }
@keyframes denCardLine { from { opacity: 0; transform: translateY(8px) scale(0.85); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .den-card .card, .den-card .l2 { animation: none; transition: none; } }
`;

function ensure(doc) {
  if (!doc.querySelector("style[data-den-cards]")) {
    const st = doc.createElement("style"); st.setAttribute("data-den-cards", ""); st.textContent = CSS; doc.head.appendChild(st);
  }
  if (!doc.querySelector('link[href*="family=Caprasimo"]')) {
    const l = doc.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Caprasimo&display=swap";
    doc.head.appendChild(l);
  }
}

/* A card: { testid, l1, l2?, hint?, side: "right" | "left", loud?,
   onTap? }. Returns { el, remove(fadeMs) }. Pointer events on it never
   reach the board or the room behind. */
export function dealCard(doc, { testid, l1, l2 = null, hint = null, side = "right", loud = false, onTap = null, role = "status", label = null }) {
  ensure(doc);
  const el = doc.createElement("div");
  el.className = `den-card${side === "left" ? " left" : ""}${loud ? " loud" : ""}`;
  el.setAttribute("data-testid", testid);
  el.setAttribute("role", role);
  if (label) el.setAttribute("aria-label", label);
  const card = doc.createElement("div"); card.className = "card";
  const stripes = doc.createElement("div"); stripes.className = "stripes"; stripes.setAttribute("aria-hidden", "true"); stripes.innerHTML = "<i></i><i></i><i></i><i></i>";
  const a = doc.createElement("span"); a.className = "l1"; a.textContent = l1;
  card.append(stripes, a);
  if (l2) { const b = doc.createElement("span"); b.className = "l2"; b.textContent = l2; card.append(b); }
  if (hint) { const s = doc.createElement("small"); s.textContent = hint; card.append(s); }
  el.append(card);
  doc.body.appendChild(el);

  // Moved by a drag (from where it sits now, pinned by left/top); a press
  // that hardly moves is a tap.
  let drag = null, moved = false;
  const stop = (e) => e.stopPropagation();
  el.addEventListener("pointerdown", (e) => {
    stop(e);
    if (e.button != null && e.button > 0) return;
    const r = el.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    stop(e);
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; el.classList.add("dragging"); }
    const w = el.offsetWidth, hgt = el.offsetHeight, vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    // (Kept on screen: at least a third of it.)
    const left = Math.min(vw - w / 3, Math.max(-w * 2 / 3, drag.left + dx));
    const top = Math.min(vh - hgt / 3, Math.max(0, drag.top + dy));
    el.style.right = "auto"; el.style.left = `${left}px`; el.style.top = `${top}px`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    stop(e);
    drag = null;
    el.classList.remove("dragging");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  ["mousedown", "touchstart", "wheel", "contextmenu"].forEach((t) => el.addEventListener(t, stop));
  el.addEventListener("click", (e) => {
    stop(e);
    if (moved) { moved = false; return; }
    if (onTap) onTap(e);
  });

  let gone = false;
  return {
    el,
    remove(fadeMs = 600) {
      if (gone) return;
      gone = true;
      el.classList.add("off");
      setTimeout(() => el.remove(), fadeMs);
    },
  };
}
