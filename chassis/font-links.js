/* The game's web fonts. On the website they come from Google Fonts; in the
   Android app (user: "I want the APK to be able to run the game completely
   with everything without having access to the internet.") from the app's
   own copy of the very same files, fonts/ beside its pages: what Google
   sends for each of the pages' requests, kept in assets/fonts/app/
   (tools/app_fonts.mjs) and put in the app by tools/app_www.mjs.

   The links written into the pages and the scripts as they stand are
   turned to the app's copy when its files are made (tools/app_www.mjs);
   fontsHref() is for the ones made as the game goes (the corner menu's
   looks, the Lab's directions). */
import { IN_APP } from "./in-app.js";

export const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?";

// The app's copy of one request's stylesheet is named for the whole of it
// (FNV-1a): "family=Cinzel:wght@500;700&display=swap" -> fonts/q-<8 hex>.css.
export function fontKey(query) {
  let h = 0x811c9dc5;
  for (let i = 0; i < query.length; i++) { h ^= query.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
// (The request stays on it, after a "?" the app's server passes over, so
// a check for a family's link, link[href*="family=Caprasimo"], still finds it.)
export const appFontsHref = (query) => `fonts/q-${fontKey(query)}.css?${query}`;

// The stylesheet for Google Fonts' families ("family=Cinzel:wght@500;700&
// family=Jost"), swapped in as they come: Google's, or in the app its copy.
export function fontsHref(families) {
  const query = `${families}&display=swap`;
  return IN_APP ? appFontsHref(query) : GOOGLE_FONTS_CSS + query;
}
