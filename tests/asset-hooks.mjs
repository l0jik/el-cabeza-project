/* Node tests: image and sound imports (bundled as data URLs by esbuild,
   build/build.js) load as a plain string, so a theme module that imports
   one can still be loaded in Node. Use: node --import ./tests/asset-hooks.mjs */
import { register } from "node:module";
import { isMainThread } from "node:worker_threads";

if (isMainThread) register(import.meta.url);

export async function load(url, context, nextLoad) {
  if (/\.(jpe?g|png|webp|mp3)$/i.test(url)) {
    return { format: "module", source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
