## Open reminders (from the user), and how they ended

- **Open since 2026-10-16: revisit a Trusted Web Activity** (user:
  "Remind me to revisit this later: Trusted Web Activity", after the
  Android sizes: "What about an app on the Android Play Store?"). What
  was said: a TWA is the website itself opened full-screen in Chrome
  from a Play Store app, about 1 MB to download, the game fetched from
  the site as it's played (and kept in the browser's cache), so it needs
  a connection, at least the first time; against that, the bundled app
  (a WebView wrapper such as Capacitor) is about 46-48 MB and works
  offline (`npm run size -- --android`: 42.9 MB of game files, zipped,
  the den spot as VP9 only). What a TWA would need when it's taken up:
  - the site to prove it's the app's: a Digital Asset Links file at the
    domain's root, /.well-known/assetlinks.json. l0jik.github.io serves
    its root from the user's own l0jik.github.io repository, not this
    project's, so either that repository or a custom domain for the site
    (GitHub Pages takes one; the file then goes in this repo's dist);
  - a web app manifest (name, icons, start URL: Nova's page) and, for
    offline play, a service worker;
  - the Android project made by Bubblewrap or PWABuilder, a Play
    developer account, signing, a store listing;
  - a word on the online relay (RELAY_URL) and the saves server, which
    work the same either way.

- **Done 2026-10-14** (at the foot of ABOUT, every world: chassis/ElCabeza3D.jsx
  info-disclaimer; the user: "put the disclaimer at the bottom of the About
  tab. Use your best judgment"). The reminder and the talk about rights,
  as they stood:
  **A disclaimer on the site** (user, 2026-10-08: "we need to have some
  sort of disclaimer on the site or something like this: 'This is an
  unofficial, non-commercial implementation and is not affiliated with
  or endorsed by them.'"). Still to settle with the user: who "them" is
  named as, and where it shows (every page, e.g. a small line at the
  foot, an about panel, the first screen). 2026-10-11 the user asked for
  ideas: options given in chat (a one-line footer, an About paragraph, a
  full Notices section, in-world variants; placement; the "Orinoco Flow"
  clips flagged). Waiting on the user's pick. Then the user asked how
  rights work given how far the game's been augmented ("essentially
  created a new game"). Answered as general information, not legal
  advice:
  - Game mechanics, names and titles aren't copyrightable (USCO FL-108;
    Argentina draws the same idea/expression line). The original's rules
    are free to implement; the 1987 article's text and art are not free
    to copy.
  - The user owns their own expression, but not the new mechanics
    (patents only; US 1-year grace after their own disclosure).
  - AI-generated parts may not be protected: human authorship is
    required (Thaler v. Perlmutter, D.C. Cir. 2025; cert denied 2
    March 2026).
  - Suggested its own name (e.g. Cabeza Nova), "based on El Cabeza by
    Poniachik and Lindenbaum", a © line, and a licence choice for the
    repo.
  - Still needing permission: the "Orinoco Flow" clips, and the people
    in their videos (for commercial use).
