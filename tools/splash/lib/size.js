// The splash's frame: a phone held upright, or (splash.html?land) a wide
// screen, 16:9 (user: "the splash screen for the game, when opened on large
// screens still uses the mobile splash screen"): the board and the emblem on
// the left, the name on the right, the title screen's menu under it.
export const LAND = typeof location !== "undefined" && new URLSearchParams(location.search).has("land");
export const W = LAND ? 1920 : 1080, H = LAND ? 1080 : 1920;
