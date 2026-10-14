# The game's server: online play and cloud saves

One small Node program, `relay.js`, no packages. It does two things:

- **Online play.** A relay between two browsers: the host gets a game code,
  the other player joins with it (or with the link that carries it), and
  from then on every finished turn goes through here to the other side.
  The server stores the turns of a game while it's on, so a player whose
  connection drops comes back to where the game is. It never judges a
  move: both browsers run the same rules.
- **Cloud saves.** Everything a browser keeps for the game, saved under an
  eight-letter code; the same code restores it anywhere.

## Run it

    node server/relay.js                     # port 8787, saves under ./data
    PORT=8080 DATA_DIR=/srv/cabeza node server/relay.js

`GET /health` answers `{"ok":true,...}`.

## Deploy it (any of these; a free tier is plenty)

**Fly.io**

    cd server
    fly launch --no-deploy --name el-cabeza-relay      # accepts the Dockerfile here
    fly volumes create cabeza_data --size 1
    # in fly.toml: [mounts] source="cabeza_data" destination="/data"
    #              [env]    DATA_DIR="/data"
    fly deploy

The address is then `wss://el-cabeza-relay.fly.dev`.

**Render / Railway**: a new Web Service from this repo, root directory
`server`, start command `node relay.js`, a persistent disk mounted at
`/data` with `DATA_DIR=/data`. The address is the service's `https://`
host with `wss://` in front.

**Your own machine**: `node relay.js` behind any HTTPS reverse proxy
(Caddy: `reverse_proxy localhost:8787`), because a page served over
`https://` can only open `wss://`.

## Tell the game where it is

`chassis/online-config.js` holds the address:

    export const RELAY_URL = "wss://PLACEHOLDER-el-cabeza-relay.example.com";

Replace the placeholder with your server's `wss://` address, rebuild, and
push. Until then the game's Online and Save-to-the-cloud screens say the
server isn't set up yet.

To try a server without rebuilding, open any page with `?relay=wss://...`
(kept for that tab), or set `localStorage["el-cabeza:relay"]`.

## What it keeps

- Rooms, in memory: gone 30 minutes after the last player leaves.
- Saves, as files in `DATA_DIR/saves`: nothing else. A save is at most
  512 KB. There's no account, so a code is the only key to a save: anyone
  with it can read it, and only the browser that made it (it holds a
  token) can update it.
