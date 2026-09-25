/* How much the device can take.

   Tienda draws a whole store around the board, so it sizes its work to
   the device instead of assuming a desktop GPU. One tier is picked once,
   from what the browser reports (a coarse pointer, the core count, the
   memory, the screen, the GPU's name and texture limit), and every part
   of the theme reads it:

     low   older or budget phones and tablets: pixel ratio up to 1.25,
           1024 shadows and textures, plain (no clearcoat) lacquer, a
           smaller store with fewer goods on the shelves.
     mid   current phones and tablets: pixel ratio up to 1.75, 2048
           shadows, clearcoat lacquer, the full store.
     high  laptops and desktops: pixel ratio up to 2, 4096 shadows, the
           full store with the television wall running.

   While playing, tienda-fx.js also watches the frame rate and lowers the
   pixel ratio if the device can't keep up (and raises it again, within
   the tier's cap, when it can).

   ?quality=low|mid|high in the address forces a tier (for testing). */

let TIER = null;

function gpuInfo() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return { name: "", maxTex: 4096 };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : "";
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return { name, maxTex };
  } catch (e) {
    return { name: "", maxTex: 4096 };
  }
}

function detect() {
  if (typeof window === "undefined") return "high";
  try {
    const forced = new URLSearchParams(window.location.search).get("quality");
    if (forced === "low" || forced === "mid" || forced === "high") return forced;
  } catch (e) { /* no URL */ }
  const nav = window.navigator || {};
  const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || (coarse ? 4 : 8);
  const shortSide = Math.min(window.screen ? window.screen.width : 800, window.screen ? window.screen.height : 800);
  const { name, maxTex } = gpuInfo();
  const weakGpu = /Mali-(4|T[0-9]|G3[0-9]|G5[0-9])|Adreno \(TM\) ?([2-5][0-9]{2}|60[0-9]|61[0-9])|PowerVR|SGX|Intel\(R\) HD Graphics ([2-5][0-9]{2,3})|GMA/i.test(name);
  if (maxTex < 4096 || mem <= 2 || weakGpu || (coarse && (cores <= 4 || mem <= 3))) return "low";
  if (coarse || shortSide < 700) return "mid";
  return "high";
}

const SETTINGS = {
  low: { tier: "low", dprCap: 1.25, dprFloor: 0.85, shadowMap: 1024, boardTexture: 1024, texScale: 0.5, physical: false, detail: 0, tvWall: false },
  mid: { tier: "mid", dprCap: 1.75, dprFloor: 1, shadowMap: 2048, boardTexture: 2048, texScale: 0.75, physical: true, detail: 1, tvWall: true },
  high: { tier: "high", dprCap: 2, dprFloor: 1, shadowMap: 4096, boardTexture: 2048, texScale: 1, physical: true, detail: 2, tvWall: true },
};

export function quality() {
  if (!TIER) TIER = detect();
  return SETTINGS[TIER];
}
