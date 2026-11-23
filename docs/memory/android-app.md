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
  are the sharp ones). Its own index.html goes straight on to Nova. And
  its fonts, as fonts/ (below).
- **Everything with no connection** (user, the same day: "I want the APK
  to be able to run the game completely with everything without having
  access to the internet."). All the game's own files were in it already;
  what it still asked of the internet was its type: the website takes its
  web fonts from Google Fonts (37 requests: the pages' links, the den's
  and the store's Caprasimo and the like put in by scripts, and the corner
  menu's looks and the Lab's directions asked for as they come). Now the
  app has its own copy of what Google sends a Chrome for each of them,
  assets/fonts/app/ (tools/app_fonts.mjs fetches it, with this machine's
  browser, from the built site's requests: each request's stylesheet as
  q-<key>.css, the same @font-face rules and letter ranges, its fonts
  beside it, 369 WOFF2 files of 40 families, 6.2 MB; LICENSES.txt: each
  family's copyright and licence from its own files, the SIL OFL, and the
  Apache License for Special Elite). tools/app_www.mjs puts the ones the
  app's pages ask for in it as fonts/ (34 requests, 5.9 MB) and turns each
  Google Fonts link in its pages and scripts to its copy,
  fonts/q-<key>.css?<the request> (the app's server passes over the "?",
  and a check for a link, link[href*="family=Caprasimo"], still finds
  it), the pages' preconnects to Google taken out; the links made as the
  game goes come from chassis/font-links.js fontsHref() (Google's on the
  website, the copy in the app; the key is its fontKey, FNV-1a of the
  whole request). The website is as it was: Google Fonts. When a page
  asks for a font the copy hasn't got, app_www.mjs stops and says so (in
  CI the site still goes out, without a new APK): `npm run build && node
  tools/app_fonts.mjs`, then commit assets/fonts/app/. Online play and
  cloud saves need a connection by their nature (and their server isn't
  set up yet: chassis/online-config.js, so the screens say so either way).
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
- **Its update note** (user, asked whether a change needs a new APK
  sideloaded: yes, every push builds one at the same link; then "yes,
  add the update available note"). CI's android job writes
  el-cabeza-app.json beside the APK (versionCode: the run number, as the
  APK's own; versionName, commit, built, size, apk), and the pages job
  publishes both. The app's title screen (apps/title-screen.js, at its
  end), in the app only and with a connection, asks the site for it
  (cache no-store, 8 s at most) and sets it beside the app's own
  (window.ElCabezaApp.versionCode(), MainActivity: the installed
  package's version code); newer, and newer than any let be: a quiet
  line at the foot of the menu, last in, "An update is ready, from Nov
  20." · "Get it · 61 MB" · "Not now" (es/vi words in i18n). Get it:
  ElCabezaApp.openInBrowser(the APK's address) (https only; an
  ACTION_VIEW intent: the phone's browser downloads it, Android installs
  it over this one, the games kept), the line then "Downloading in your
  browser: open it when it's done to install it."; Not now: that
  version kept as let be (localStorage el-cabeza:update-skipped), a
  newer one told again. No connection, the same version, an app from
  before the note (no versionCode to ask): nothing, no request. The game
  never needs the connection; this is the app's one word to the internet.
  e2e-app.mjs (with a stand-in site answer). An APK from before the note
  can't tell: the first one with it is installed by hand.
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
  emulator (API 34) with its network off (wifi, data, airplane mode),
  opened, 45 seconds, then what the pages said (logcat), anything they
  failed to load or were refused (none expected), the fonts they took
  from fonts/, what's on its screen (uiautomator) and whether it's
  running; it reports, it holds nothing up. The site's landing page
  links it.
- **Installing it**: on the phone, open
  https://l0jik.github.io/el-cabeza-project/el-cabeza.apk, let Chrome
  install unknown apps when Android asks, install. A newer one installs
  over it the same way. Its saved games and story are its own (the app's
  storage, not Chrome's): the browser's don't carry over. Everything plays
  with no connection, its type too. Where Android's developer verification
  is in force for sideloaded apps (Brazil, Indonesia, Singapore and
  Thailand from 30 September 2026; everywhere in 2027), an app from an
  unverified developer needs Android's advanced install flow, or adb from
  a computer, or the developer verified (a free account for apps shared
  with a few devices).
- **Test**: tests/e2e-app.mjs (in run-e2e): app-www's contents (everything
  named there, Opus only, the title's MP4s, nothing web-only, the index to
  Nova; its fonts: a copy of every request its pages make, every font
  those name, nothing of Google's left but fontsHref's own, the
  licences), Capacitor's config, the activity; its pages served as the
  app serves them with its user agent and nothing else reachable (every
  request off the device noted and refused): Nova's title screen up, no
  full screen asked at a tap, no full-screen button, the screen kept on
  and let go when idle and kept on again at a touch, a game begun in the
  City with the corner menu's fonts from fonts/, every world and the
  Lab's nine directions opening with nothing missing, no errors, nothing
  asked of the internet and every face they declare loading from the copy;
  the same page in a phone's browser still with its button and Google's
  fonts for the corner menu.

## The phone's size of words (2026-11-23)

The app's WebView takes the phone's own font size (Android's WebView text
zoom follows the system's font scale; the user's phone is set large,
about 1.5x). Every word is half again as big, as in a browser set to
large text; the website in Chrome hadn't been. What reserved a fixed room
for words then ran out of it: the clerk comic's caption over the clipping
and its last panel's two buttons, the receipt's 30 columns on a 300 px
tape, the hall's bubble breaking before its last word, the corner menu's
card. Each is measured and fitted now, whatever the size (user: "This
wasn't like this before").

- How the large font works (Chromium's text autosizer, the same as
  `-webkit-text-size-adjust`): getComputedStyle reports the bigger size,
  and `ch` grows with it, but `em` lengths (a width, a padding) don't:
  they still resolve against the unenlarged size. So a room meant to
  grow with the words is in `ch`, or measured.
- Emulated in a test: a mobile context (isMobile) and
  `html{-webkit-text-size-adjust:150%}`.
- Not done (offered): the app ignoring the phone's font size
  (setTextZoom(100) in MainActivity), which would put everything back as
  on the website at once, but its words smaller than the user's phone
  sets them everywhere.
