/* The stage: fonts and the board photo loaded, then window.SPLASH.frame(version,
   poster, t) draws one frame of a video at t seconds: the version's picture,
   and the title over it (lib/title.js). */
import { W, H, posterCanvas } from "./lib/posters.js";
import { TITLE, SCHEME, drawTitle, setStyle, styleLen, styleSheen, STYLES } from "./lib/lockup.js";
import { BOARD, loadBoard, drawStart, drawPiece } from "./lib/board.js";
import { length, titleState } from "./lib/title.js";
import { build } from "./lib/v-build.js";
import { tiles } from "./lib/v-tiles.js";
import { sand } from "./lib/v-sand.js";
import { liquid } from "./lib/v-liquid.js";
import { sweep } from "./lib/v-sweep.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const VERSIONS = {
  build,
  tiles,
  sand,
  liquid,
  sweep,
  // (a look at the pieces lifted off the board, for checking the cut-outs)
  debug: {
    settle: () => 3,
    frame(ctx, id, t) {
      if (t < 1) return drawStart(ctx, 0);
      ctx.drawImage(BOARD.startClean, 0, 0);
      if (t >= 2) for (const p of BOARD.pieces) drawPiece(ctx, p, 0.6);
    },
  },
};

function picture(version, id, t) {
  ctx.save();
  VERSIONS[version].frame(ctx, id, t);
  ctx.restore();
}

/* When the ground under the name turns light (poster 5: the table to the
   paper), found by stepping through the picture without the title: the last
   moment the name's box is still mostly dark. Null on the dark posters. */
const INK = {};
function inkAt(version, id) {
  if (SCHEME[id].ground === "dark") return null;
  const key = `${version}-${id}`;
  if (key in INK) return INK[key];
  const bx = W / 2 - TITLE.width / 2, by = TITLE.base - 110, bw = TITLE.width, bh = 120;
  const end = VERSIONS[version].settle(id);
  let last = 0;
  for (let t = 0; t <= end + 1e-6; t += 0.05) {
    picture(version, id, t);
    const d = ctx.getImageData(bx, by, bw, bh).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    if (s / n / 255 < 0.5) last = t;
  }
  return (INK[key] = last + 0.025);
}

window.SPLASH = {
  ready: (async () => {
    await Promise.all([
      document.fonts.load("700 100px Cinzel"),
      document.fonts.load("300 50px 'Josefin Sans'"),
      document.fonts.load("italic 500 100px 'Bodoni Moda'"),
      loadBoard("./board-photo.jpg"),
    ]);
  })(),
  versions: VERSIONS,
  poster(id) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(posterCanvas(id), 0, 0);
  },
  frame(version, id, t) {
    const ink = inkAt(version, id);
    picture(version, id, t);
    ctx.save();
    drawTitle(ctx, id, titleState(t, VERSIONS[version].settle(id), ink, styleLen(), styleSheen()));
    ctx.restore();
  },
  duration(version, id) {
    return length(VERSIONS[version].settle(id), styleLen());
  },
  // NOVA's treatment (lockup.js STYLES)
  setStyle,
  styles: Object.keys(STYLES),
  inkAt,
};
