## Nova naming
The Unified build (`apps/unified.jsx`) is published as **El Cabeza Nova**
at `dist/el-cabeza-nova.html` (the landing-page button reads "Nova"). The
old `el-cabeza-unified.html` had already been shared, so `build/build.js`
still writes that file, now as a tiny redirect to Nova that keeps any
`?query`/`#hash`. Don't remove the redirect.

