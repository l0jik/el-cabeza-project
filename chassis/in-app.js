/* The game as an app on a phone (user: "create the app version to have on
   this phone."): the Android app (android/, MainActivity.java) shows the
   game's own pages in Android's WebView, which tells them so in its user
   agent ("ElCabezaApp": capacitor.config.json appendUserAgent).

   There the app is full screen from its first frame, so a page doesn't ask
   for full screen at a tap, nor show its full-screen button; and the screen
   is kept on by the app (window.ElCabezaApp.keepScreenOn), where a page in
   a browser asks for a Screen Wake Lock, which the WebView doesn't offer. */

export const IN_APP = typeof navigator !== "undefined" && /\bElCabezaApp\b/.test(navigator.userAgent || "");

/* A Screen Wake Lock kept by the app, in navigator.wakeLock's shape as far
   as the game uses it (request("screen"), a sentinel's release() and its
   "release" event), or null outside the app. The screen's kept on while
   any of them is held. */
export function appWakeLock() {
  const app = typeof window !== "undefined" ? window.ElCabezaApp : null;
  if (!IN_APP || !app || typeof app.keepScreenOn !== "function") return null;
  let held = 0;
  const keep = (on) => { try { app.keepScreenOn(on); } catch (e) { /* the app's gone */ } };
  return {
    request() {
      held++;
      keep(true);
      const onRelease = [];
      let released = false;
      return Promise.resolve({
        type: "screen",
        get released() { return released; },
        release() {
          if (!released) {
            released = true;
            held = Math.max(0, held - 1);
            if (!held) keep(false);
            onRelease.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* its own */ } });
          }
          return Promise.resolve();
        },
        addEventListener(type, fn) { if (type === "release" && typeof fn === "function") onRelease.push(fn); },
        removeEventListener(type, fn) { const i = onRelease.indexOf(fn); if (i >= 0) onRelease.splice(i, 1); },
      });
    },
  };
}
