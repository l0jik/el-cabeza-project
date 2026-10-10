/* Shadows drawn only when something that casts them has changed.

   three.js draws every shadow map again on every frame by default: each
   caster drawn a second time, into the key light's map, sixty times a
   second, while nothing moves (user: "go ahead", after the efficiency
   review found every world doing it). The chassis turns that off
   (renderer.shadowMap.autoUpdate) and asks this, each frame, once the
   frame's matrices are worked out, whether to draw them: yes when a
   shadow-casting light or caster has moved, turned, come, gone or
   changed (its geometry's or its material's version, its instances),
   the same objects the shadow pass itself would draw (visible, casting:
   meshes, lines and points). A turn of the board under a light fixed in
   the world moves every caster, so the shadows follow a turn frame by
   frame as before; standing still, they're drawn once. What's skipped
   would have been the same picture. A caster with a depth material of
   its own, a skinned or morphing one, is drawn every frame (it can
   change without any of that moving), and once a second they're drawn
   anyway, a backstop for a change this can't see. */
export function createShadowWatch() {
  let cur = new Float64Array(4096), prev = new Float64Array(4096);
  let n = 0, prevN = -1, diff = false, always = false, lastDraw = -Infinity;
  // Each value is written and, while nothing has differed yet, checked
  // against the same place at the last drawing.
  function put(v) {
    if (n === cur.length) { const grown = new Float64Array(cur.length * 2); grown.set(cur); cur = grown; }
    if (!diff && (n >= prevN || prev[n] !== v)) diff = true;
    cur[n++] = v;
  }
  function putMatrix(m) { const e = m.elements; for (let i = 0; i < 16; i++) put(e[i]); }
  function putMaterial(m) { put(m.id); put(m.version); put(m.visible ? 1 : 0); }
  function visit(o) {
    if (o.visible === false) return;
    if (o.castShadow) {
      if (o.isLight) {
        const s = o.shadow;
        if (s) {
          put(o.id);
          putMatrix(o.matrixWorld);
          if (o.target) putMatrix(o.target.matrixWorld);
          put(s.mapSize.x); put(s.mapSize.y); put(s.map ? s.map.texture.id : -1);
          putMatrix(s.camera.projectionMatrix);
          if (o.isSpotLight) { put(o.angle); put(o.distance); } else if (o.isPointLight) put(o.distance);
        }
      } else if (o.isMesh || o.isLine || o.isPoints) {
        put(o.id);
        putMatrix(o.matrixWorld);
        put(o.layers.mask);
        const g = o.geometry;
        put(g.id);
        const pos = g.attributes.position;
        put(pos ? pos.version : -1);
        put(g.index ? g.index.version : -1);
        put(g.drawRange.start); put(g.drawRange.count);
        const m = o.material;
        if (Array.isArray(m)) for (let i = 0; i < m.length; i++) putMaterial(m[i]);
        else if (m) putMaterial(m);
        if (o.isInstancedMesh) { put(o.count); put(o.instanceMatrix.version); }
        if (o.isSkinnedMesh || o.morphTargetInfluences || o.customDepthMaterial || o.customDistanceMaterial) always = true;
      }
    }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) visit(ch[i]);
  }
  // True when the shadows should be drawn this frame (the matrices must
  // be this frame's: scene.updateMatrixWorld() first).
  return function shadowsChanged(scene, now) {
    n = 0; diff = false; always = false;
    visit(scene);
    if (n !== prevN) diff = true;
    if (!diff && !always && now - lastDraw < 1000) return false;
    const t = prev; prev = cur; cur = t;
    prevN = n;
    lastDraw = now;
    return true;
  };
}
