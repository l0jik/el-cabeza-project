/* A small orthographic 3D for the canvas: a camera turned (phi, about the
   vertical) and tipped (eps, 90 degrees = straight down), boxes and prisms
   drawn back to front, pictures laid on flat faces. World units are the
   frame's pixels at rest; x right, y down the board, z up. */
const D2R = Math.PI / 180;
export const ISO_EPS = Math.asin(Math.tan(30 * D2R)) / D2R; // 35.264: true isometric

export function makeCam({ phi = 0, eps = 90, sigma = 1, pivot = [0, 0, 0], screen = [540, 960], yScale = 1 }) {
  const p = phi * D2R, e = eps * D2R;
  const cp = Math.cos(p), sp = Math.sin(p), ce = Math.cos(e), se = Math.sin(e);
  const V = [sp * ce, cp * ce, se]; // towards the viewer
  return {
    V,
    proj(x, y, z = 0) {
      const dx = x - pivot[0], dy = y - pivot[1], dz = z - pivot[2];
      const xr = dx * cp - dy * sp, yr = dx * sp + dy * cp;
      return [screen[0] + sigma * xr, screen[1] + sigma * yScale * (yr * se - dz * ce)];
    },
    depth: (x, y, z = 0) => x * V[0] + y * V[1] + z * V[2],
    faces: (nx, ny, nz = 0) => nx * V[0] + ny * V[1] + nz * V[2] > 1e-6,
  };
}

// A footprint: a superellipse, p = 2 a circle (ellipse), large p a square (rectangle).
export function superellipse(cx, cy, a, b, p, n = 64, rot = 0) {
  const out = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / p), y = b * Math.sign(s) * Math.abs(s) ** (2 / p);
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

export function pathPts(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/* A prism: footprint (world x, y) from z0 up to z1.
   style: side(nx, ny) -> colour, top -> colour, topImage(ctx) (drawn clipped to
   the top, with the camera's transform for the top's plane set by the caller
   through topXform(cam, z1)), stroke, lineWidth, strokeSides (0..1). */
export function drawPrism(ctx, cam, foot, z0, z1, style) {
  const n = foot.length;
  let cx = 0, cy = 0;
  for (const [x, y] of foot) { cx += x; cy += y; }
  cx /= n; cy /= n;
  const sides = [];
  if (z1 - z0 > 0.01) {
    for (let i = 0; i < n; i++) {
      const [ax, ay] = foot[i], [bx, by] = foot[(i + 1) % n];
      let nx = by - ay, ny = -(bx - ax);
      const mx = (ax + bx) / 2 - cx, my = (ay + by) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      if (!cam.faces(nx, ny, 0)) continue;
      sides.push({ pts: [cam.proj(ax, ay, z0), cam.proj(bx, by, z0), cam.proj(bx, by, z1), cam.proj(ax, ay, z1)], nx, ny });
    }
  }
  ctx.lineJoin = "round";
  for (const s of sides) {
    pathPts(ctx, s.pts);
    ctx.fillStyle = style.side(s.nx, s.ny);
    ctx.fill();
    // a hairline of the same colour closes the seams between facets
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const top = foot.map(([x, y]) => cam.proj(x, y, z1));
  pathPts(ctx, top);
  ctx.fillStyle = style.top;
  ctx.fill();
  if (style.topImage) {
    ctx.save();
    pathPts(ctx, top);
    ctx.clip();
    style.topImage(ctx);
    ctx.restore();
  }
  if (style.stroke && style.lineWidth > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.lineWidth;
    if (style.strokeSides > 0) {
      ctx.save();
      ctx.globalAlpha *= style.strokeSides;
      for (const s of sides) { pathPts(ctx, s.pts); ctx.stroke(); }
      ctx.restore();
    } else if (sides.length) {
      // the outline only: the top's edge and the bottom's front edge
      const bot = foot.map(([x, y]) => cam.proj(x, y, z0));
      ctx.save();
      ctx.beginPath();
      for (const s of sides) { ctx.moveTo(...s.pts[0]); ctx.lineTo(...s.pts[1]); }
      ctx.stroke();
      ctx.restore();
      void bot;
    }
    pathPts(ctx, top);
    ctx.stroke();
  }
}

/* Set ctx's transform so a picture's pixels (u, v) land on the world plane z
   at x = x0 + u * kx, y = y0 + v * ky. */
export function planeXform(ctx, cam, x0, y0, z, kx, ky) {
  const o = cam.proj(x0, y0, z), a = cam.proj(x0 + kx, y0, z), b = cam.proj(x0, y0 + ky, z);
  ctx.setTransform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]);
}

// The same for a wall standing up: pixels (u, v) at origin + u*ex + v*ey (world vectors).
export function wallXform(ctx, cam, o3, ex, ey) {
  const o = cam.proj(...o3);
  const a = cam.proj(o3[0] + ex[0], o3[1] + ex[1], o3[2] + ex[2]);
  const b = cam.proj(o3[0] + ey[0], o3[1] + ey[1], o3[2] + ey[2]);
  ctx.setTransform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]);
}
