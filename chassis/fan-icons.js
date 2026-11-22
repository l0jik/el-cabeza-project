/* The fan menu's icons (chassis/menu-fan.js), each an SVG's inside on a
   24-unit square, drawn with currentColor: kept here, apart from the
   menu (which loads when it's first opened), so the first game's
   pictures (chassis/TourPictures.jsx) draw the same ones the menu shows. */
export const FAN_ICON = {
  play: '<path d="M8 5.2v13.6L18.6 12z" fill="currentColor" stroke="none"/>',
  first: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none"/>',
  human: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-4.1 3.8-6.3 7.2-6.3s6.3 2.2 7.2 6.3"/>',
  computer: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.8"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  online: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5M12 3.5C9.4 5.9 8.2 8.8 8.2 12s1.2 6.1 3.8 8.5"/>',
  check: '<path d="M12 3.5l7 2.6v5.2c0 4.3-3 7.6-7 9.2-4-1.6-7-4.9-7-9.2V6.1z"/><path d="M12 8.2v4.4M12 15.6v.1"/>',
  start: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M4 12h16M12 4v16"/>',
  half: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M4 12h16"/><path d="M5 13h14v6H5z" fill="currentColor" stroke="none" opacity=".35"/>',
  pieces: '<path d="M12 3.2l7.6 4.3v9L12 20.8l-7.6-4.3v-9z"/><path d="M4.4 7.5L12 11.8l7.6-4.3M12 11.8v9"/>',
  cart: '<path d="M2.8 4.5h2.4l2.2 10.3h10.1l2-7.4H6.3"/><circle cx="9.2" cy="18.6" r="1.4"/><circle cx="16.4" cy="18.6" r="1.4"/>',
  nova: '<path d="M12 3.8l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6l5.6-.6z"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  language: '<path d="M4 5h16v10H9.5L5 19v-4H4z"/><path d="M9.6 12.6L12 6.8l2.4 5.8M10.4 10.8h3.2"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4.2h4.2"/><path d="M10.6 9.3v5.4l4.2-2.7z" fill="currentColor" stroke="none"/>',
  saves: '<path d="M5 4h11.5L19 6.5V20H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  points: '<circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="2"/>',
  guide: '<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M12 10.6v5M12 7.7v.1"/>',
  whynot: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7M12 17.1v.1"/>',
  bar: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 15h17"/>',
  view: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  focus: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>',
  endturn: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  undo: '<path d="M9 6L4.5 10.5 9 15"/><path d="M5 10.5h9a5 5 0 0 1 0 10h-2"/>',
  endgame: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  leave: '<path d="M13 4.5H6.5v15H13"/><path d="M10.5 12h9.5M16.5 8.5 20 12l-3.5 3.5"/>',
  movelog: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none"/>',
  plainrules: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M20 4.5v4.2h-4.2"/>',
  spark: '<path d="M12 3.5v4.5M12 16v4.5M3.5 12H8M16 12h4.5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
  surface: '<path d="M3.5 9.5L12 5l8.5 4.5L12 14z"/><path d="M3.5 9.5v4.2L12 18.2l8.5-4.5V9.5"/><path d="M7.8 7.2l8.4 4.6M16.2 7.2l-8.4 4.6"/>',
  // (Calm Rings: More, a row's way on, a choice's list open or shut, a
  // switch between two, the card's close.)
  more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  swap: '<path d="M7 7.5h11M15 4.5l3 3-3 3M17 16.5H6M9 13.5l-3 3 3 3"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};
