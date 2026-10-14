# The game's server: online play and cloud saves

One small server does two things:

- **Online play.** A relay between two browsers: the host gets a game code,
  the other player joins with it (or with the link that carries it), and
  from then on every finished turn goes through here to the other side.
  The server stores the turns of a game while it's on, so a player whose
  connection drops comes back to where the game is. It never judges a
  move: both browsers run the same rules.
- **Cloud saves.** Everything a browser keeps for the game, saved under an
  eight-letter code; the same code restores it anywhere.

It exists twice, with the same messages and the same addresses:

- `cloudflare/worker.js`, for **Cloudflare Workers** (free plan: nothing
  sleeps, the storage lasts, no card). This is the one to deploy.
- `relay.js`, the same thing as a plain Node program (no packages), for a
  machine of your own or any host that runs Node; the tests run it.

## Deploy it on Cloudflare (free)

You need a Cloudflare account (dash.cloudflare.com, sign up with an
email; the free plan asks for no card). Then either way:

**From the dashboard, with nothing to install.** Cloudflare builds the
`server/cloudflare` folder of this repository and deploys it on every
push.

1. In the dashboard: *Workers & Pages* → *Create* → the *Workers* tab →
   *Import a repository* (the first time it asks to connect your GitHub
   account and to allow the Cloudflare app to see this repository).
2. Pick `el-cabeza-project`. Name the Worker **`el-cabeza-relay`** (it
   must match the name in `cloudflare/wrangler.toml`). Branch: the one
   this site deploys from.
3. Build settings: *Root directory* `server/cloudflare`; *Build command*
   empty; *Deploy command* `npx wrangler deploy` (the default).
4. *Save and Deploy*. The first time, it asks you to choose a
   `workers.dev` subdomain (any name; it's part of the address). A minute
   later the Worker is up at
   `https://el-cabeza-relay.<your-subdomain>.workers.dev`.

**Or from a computer with Node:**

    cd server/cloudflare
    npx wrangler login        # opens the browser to allow it
    npx wrangler deploy       # prints the address

Either way, check it: open `https://el-cabeza-relay.<your-subdomain>.workers.dev/health`
in a browser; it answers `{"ok":true,"service":"el-cabeza-relay",...}`.

Its storage (the games on the go, the saves) is a Durable Object the
deploy creates by itself; nothing else to set up.

## Tell the game where it is

`chassis/online-config.js` holds the address:

    export const RELAY_URL = "wss://PLACEHOLDER-el-cabeza-relay.example.com";

Replace the placeholder with the Worker's address, with `wss://` in
front: `wss://el-cabeza-relay.<your-subdomain>.workers.dev`. Rebuild and
push. Until then the game's Online and Save-to-the-cloud screens say the
server isn't set up yet.

To try a server without rebuilding, open any page with
`?relay=wss://el-cabeza-relay.<your-subdomain>.workers.dev` (kept for
that tab), or set `localStorage["el-cabeza:relay"]`.

## The Node server, elsewhere

    node server/relay.js                     # port 8787, saves under ./data
    PORT=8080 DATA_DIR=/srv/cabeza node server/relay.js

`GET /health` answers `{"ok":true,...}`. A page served over `https://`
can only open `wss://`, so it needs an HTTPS front: Caddy
(`reverse_proxy localhost:8787`), or a host that gives one. Render's free
web service runs it from this repository (root directory `server`, start
command `node relay.js`; the `Dockerfile` here works too), but a free
service there sleeps after fifteen idle minutes and keeps no disk, so
saves would need another store: the Cloudflare Worker is the one that
works whole for nothing.

## What it keeps

- Rooms: gone 30 minutes after the last player leaves (and in any case
  after a week).
- Saves: the record under its code, nothing else; at most 512 KB each.
  There's no account, so a code is the only key to a save: anyone with
  it can read it, and only the browser that made it (it holds a token)
  can update it.

## Checking a server

    node tests/relay-protocol.mjs                                    # the Node server, started here
    RELAY=ws://127.0.0.1:8790 node tests/relay-protocol.mjs          # the Worker under `npx wrangler dev --port 8790`
    RELAY=wss://el-cabeza-relay.NAME.workers.dev node tests/relay-protocol.mjs

The same `RELAY=` runs the browser tests (`tests/e2e-online.mjs`,
`tests/e2e-saves.mjs`) against any server.
