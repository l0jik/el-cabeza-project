/* The stage: fonts and the board photo loaded, then window.SPLASH.frame(version,
   poster, t) draws one frame of a video at t seconds. */
import { W, H, posterCanvas } from "./lib/posters.js";
import { BOARD, loadBoard, drawStart, drawPiece } from "./lib/board.js";
import { build } from "./lib/v-build.js";
import { tiles } from "./lib/v-tiles.js";
import { sand } from "./lib/v-sand.js";
import { liquid } from "./lib/v-liquid.js";
import { sweep } from "./lib/v-sweep.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const VERSIONS = {
  build,
  tiles,
  sand,
  liquid,
  sweep,
  // (a look at the pieces lifted off the board, for checking the cut-outs)
  debug: {
    duration: 3,
    frame(ctx, id, t) {
      if (t < 1) return drawStart(ctx, 0);
      ctx.drawImage(BOARD.startClean, 0, 0);
      if (t >= 2) for (const p of BOARD.pieces) drawPiece(ctx, p, 0.6);
    },
  },
};

window.SPLASH = {
  ready: (async () => {
    await Promise.all([
      document.fonts.load("700 100px Cinzel"),
      document.fonts.load("300 50px 'Josefin Sans'"),
      document.fonts.load("600 50px 'Barlow Condensed'"),
      loadBoard("./board-photo.jpg"),
    ]);
  })(),
  versions: VERSIONS,
  poster(id) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(posterCanvas(id), 0, 0);
  },
  frame(version, id, t) {
    ctx.save();
    VERSIONS[version].frame(ctx, id, t);
    ctx.restore();
  },
  duration(version) {
    return VERSIONS[version].duration;
  },
};
