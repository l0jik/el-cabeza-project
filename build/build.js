import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync } from "fs";

const targets = [
  { name: "standard", entry: "apps/standard.jsx", title: "El Cabeza" },
  { name: "neon", entry: "apps/neon.jsx", title: "Neon Cabeza" },
];

mkdirSync("dist", { recursive: true });

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
  });
  const js = result.outputFiles[0].text;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title></head><body style="margin:0"><div id="root"></div><script>${js}</script></body></html>`;
  writeFileSync(`dist/el-cabeza-${t.name}.html`, html);
  console.log(`built dist/el-cabeza-${t.name}.html (${(js.length / 1024).toFixed(0)}kb JS)`);
}
