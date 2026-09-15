import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync } from "fs";

const targets = [
  { name: "standard", entry: "apps/standard.jsx", title: "El Cabeza" },
  { name: "neon", entry: "apps/neon.jsx", title: "Neon Cabeza" },
  { name: "unified", entry: "apps/unified.jsx", title: "El Cabeza Nova" },
];

mkdirSync("dist", { recursive: true });

/* Bundled once, shared by all three targets (identical AI code
   regardless of theme) — see engine/ai-worker.js's own header comment
   for why this is embedded as inert script text rather than shipped as
   a second file: the whole point of this build is one self-contained
   HTML page per theme. Plain JS, no JSX loader needed. */
const workerResult = await esbuild.build({
  entryPoints: ["engine/ai-worker.js"],
  bundle: true,
  write: false,
  format: "iife",
  logLevel: "warning",
});
const workerJs = workerResult.outputFiles[0].text;
// </script sequences inside the bundled worker text would otherwise
// prematurely close this holder tag when the browser parses the HTML.
const workerJsEscaped = workerJs.replace(/<\/script/gi, "<\\/script");

for (const t of targets) {
  const result = await esbuild.build({
    entryPoints: [t.entry],
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".js": "jsx" },
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "warning",
    // Without this, react/react-dom's own package.json branches on
    // process.env.NODE_ENV to pick cjs/react.development.js — esbuild
    // leaves that check untouched with no define, so it evaluates to
    // undefined at runtime and always takes the DEVELOPMENT branch.
    // That build does real per-render work a shipped build shouldn't
    // pay for: Object.freeze() on every element and props object,
    // prop-type/key/ref validation, and the warning-formatting
    // machinery behind every dev-only console.error/warn call — on
    // every re-render, for the app's whole lifetime, not just at
    // startup. `define` here makes esbuild dead-code-eliminate that
    // branch entirely, so only the production build gets bundled.
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const js = result.outputFiles[0].text;
  // type="application/x-ai-worker" (not a JS mimetype) keeps the browser
  // from ever trying to execute this inline — chassis/ElCabeza3D.jsx
  // reads its textContent and turns it into a real Worker via a Blob URL.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title></head><body style="margin:0"><div id="root"></div><script type="application/x-ai-worker" id="ai-worker-src">${workerJsEscaped}</script><script>${js}</script></body></html>`;
  writeFileSync(`dist/el-cabeza-${t.name}.html`, html);
  console.log(`built dist/el-cabeza-${t.name}.html (${(js.length / 1024).toFixed(0)}kb JS, ${(workerJs.length / 1024).toFixed(0)}kb worker)`);
}
