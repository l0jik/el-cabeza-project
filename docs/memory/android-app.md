## The Android app (built 2026-11-19)

User: "create the app version to have on this phone." Earlier the same
user had found Chrome's Install app for the site (the web manifest, Nova's
page) and asked how it could be "an actual app"; the bundled app was
recommended (docs/memory/00-open-reminders.md, the Trusted Web Activity
reminder). This is that app: the game's own pages inside the app,
playable with no connection, full screen, for installing straight onto a
phone (an APK); the same project is the way to Google Play later.

- **What it is.** Capacitor 8.6.2 (@capacitor/core, cli, android; exact
  versions in package.json). capacitor.config.json: appId
  io.github.l0jik.elcabeza (the reverse of the site's own domain, fixed
  for good once on Play), name El Cabeza, webDir app-www, the title
  screen's dark (#120C08) behind everything, the WebView's user agent
  ending "ElCabezaApp", Capacitor's SystemBars hidden, its console in
  logcat (Capacitor/Console) even in a release build. android/ is
  Capacitor's project (compileSdk/targetSdk 36, minSdk 24, AGP 8.13,
  Gradle 8.14.3, Java 21), committed but for what `npx cap sync android`
  writes into it (the web files, android/app/src/main/assets/public, and
  its copied config: android/.gitignore).
- **Its files** (tools/app_www.mjs, into app-www/, gitignored): dist/'s
  files as the app ships them, about 55 MB. Left out: what only the
  website needs (the front pages, the old addresses, the site's index and
  robots.txt, the APK), each recording's MP3 (its Opus twin plays in the
  WebView; chassis/sound-files.js asks for it), the den spot's H.264 copy
  (its <source> list falls through to the VP9). Kept, unlike
  tools/app_size.mjs's --android count: the title screen's MP4s, which it
  picks wherever H.264 plays, as it does in the WebView (13.6 MB of them
  are the sharp ones). Its own index.html goes straight on to Nova.
- **The app itself** (android/app/src/main/java/.../MainActivity.java):
  the status and navigation bars hidden (a swipe from an edge shows them a
  moment), drawn round a notch; the back gesture to the WebView's history
  first (a game under way keeps a step there, so Back asks before leaving
  it, as in a browser), else the usual Back (the app to the background);
  window.ElCabezaApp.keepScreenOn(on) for the game. Its icon: the Horizon
  logo (assets/app/icon-*.png), the maskable one at 83% of an adaptive
  icon's foreground over #3F2D1E (the brown at its edge), so a launcher's
  mask doesn't cut the pieces off; the opening screen the title's dark
  with the icon (Android 12 on) instead of Capacitor's logo.
- **In the pages** (chassis/in-app.js IN_APP, from the user agent): no
  asking for full screen at a tap (the title screen's, the chassis's, the
  store's box, the den's previews, the Futuris summons: gl-watch.js
  autoFullscreenOk() says no in the app), no full-screen buttons (the
  corner's, the Lab's); the Screen Wake Lock, which the WebView hasn't
  got, kept by the app instead (appWakeLock(), navigator.wakeLock's shape:
  held while the game's touched, let go after ten idle minutes, the same
  as in a browser). apps/title-screen.js is a plain script in the page, so
  it has its own copy of the check.
- **Signed** with a key of its own, android/app/el-cabeza-sideload.jks
  (alias el-cabeza, password elcabeza-sideload, in android/app/build.gradle):
  the same every build, so a newer APK installs over the old and keeps its
  saved games. It's in the repository, so it proves nothing about who
  built an APK; for Play, a private upload key kept out of the repository
  (Play App Signing), as a GitHub secret.
- **Built by CI** (.github/workflows/deploy-pages.yml): this machine has
  Java 21 and Gradle but no Android SDK (dl.google.com is shut to it), so
  GitHub's machines build it. build (the site) -> android (npm ci, the
  site's files, app_www, `npx cap sync android`, `./gradlew
  assembleRelease -PappVersionName=<APP_VERSION> -PappVersionCode=<run
  number>`, then aapt2's badging and apksigner's check in the log) ->
  pages (the site, and el-cabeza.apk beside it if it was built: a failed
  app build never stops the site) -> deploy. android-check: the APK on an
  emulator (API 34), opened, half a minute, then what the pages said
  (logcat), what's on its screen (uiautomator) and whether it's running;
  it reports, it holds nothing up. The site's landing page links it.
- **Installing it**: on the phone, open
  https://l0jik.github.io/el-cabeza-project/el-cabeza.apk, let Chrome
  install unknown apps when Android asks, install. A newer one installs
  over it the same way. Its saved games and story are its own (the app's
  storage, not Chrome's): the browser's don't carry over. It plays with
  no connection; the web fonts and the online relay need one (offline the
  text falls back to the phone's own fonts).
- **Test**: tests/e2e-app.mjs (in run-e2e): app-www's contents (everything
  named there, Opus only, the title's MP4s, nothing web-only, the index to
  Nova), Capacitor's config, the activity; its pages served as the app
  serves them with its user agent: Nova's title screen up, no full screen
  asked at a tap, no full-screen button, the screen kept on and let go
  when idle and kept on again at a touch, every world opening with nothing
  missing and no errors; the same page in a phone's browser still with
  its button.
