/* The game's English, line by line, as the language tables need it
   (chassis/i18n.js): every string in the code that reads as words a player
   sees, each file compiled first (esbuild) so JSX text comes as the page
   will have it, its strings pulled out (js-tokens) and the ones that read
   as English kept (not CSS, keys, selectors, shader code, comparisons or
   developer messages). Approximate by design: a few that no player sees
   get in, and a table having them costs nothing.

   Says how many there are, which ones each table (i18n/es.js, i18n/vi.js)
   lacks, and the ones made of parts (a template with ${...} in it) that
   want writing whole with their holes named, t("{n} left", { n }).
     node tools/i18n_strings.mjs            (the counts, and what's missing)
     node tools/i18n_strings.mjs --list     (every line, by file)
     node tools/i18n_strings.mjs --json f   (every line and where, as JSON) */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { sentencesOf } from "../chassis/i18n.js";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const require = createRequire(path.join(ROOT, "package.json"));
const esbuild = require("esbuild");
const jsTokens = require("js-tokens");
const TOKENS = jsTokens.default, toToken = jsTokens.matchToToken;

const DIRS = ["chassis", "apps", "themes", "themes/lab", "engine"];
// (The AI's worker and the tools' own code say nothing to a player; the
// tables themselves are the answer, not the question.)
const SKIP = new Set(["engine/ai-worker.js", "chassis/i18n.js", "chassis/LanguageBadge.jsx"]);

const unescape = (s) => s
  .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\[ntr]/g, " ")
  .replace(/\\(.)/g, "$1");

const CODEY = new RegExp([
  "[{}<>\\\\]", "=>", "\\b\\d+(\\.\\d+)?(px|em|rem|vh|vw|vmin|vmax|ms|deg|fr)\\b", "rgba?\\(", "hsla?\\(", "#[0-9a-fA-F]{3,8}\\b",
  "var\\(--", "calc\\(", "translate[XYZ3d]*\\(", "scale[XYZ3d]*\\(", "rotate[XYZ3d]*\\(", "cubic-bezier", "gradient\\(", "url\\(",
  "data-testid", "el-cabeza", "\\.(js|mjs|jsx|mp3|opus|ogg|m4a|wav|png|jpe?g|webp|webm|mp4|woff2?|html|json|svg)\\b",
  "\\bvec[234]\\b", "\\bgl_", "\\buniform\\b", "\\bvarying\\b", "void main", "sans-serif", "\\bserif\\b", "monospace", "system-ui",
  // (Seconds, "0.5s", but not a decade, "the 1960s"; a selector, ".tab" or
  // "#id", but not a line that starts with "...".)
  ";\\s*$", "\\b(?!1\\d\\d0s\\b)\\d+(\\.\\d+)?s\\b", "\\bease(-in|-out|-in-out)?\\b", "\\binfinite\\b", "^mk ", "^[a-z-]+\\s*:\\s*\\S", "\\b(px|rem)\\b", "^\\s*[#\\[]", "^\\s*\\.(?![.\\s])",
].join("|"));

export function isProse(t) {
  t = t.trim();
  if (t.length < 2) return false;
  if ((t.match(/[A-Za-zÀ-ÿ]/g) || []).length < 2) return false;
  // (A line's named holes, t("{n} left", ...), aren't code.)
  if (CODEY.test(t.replace(/\$\{x\}/g, "").replace(/\{\w+\}/g, "x"))) return false;
  const words = t.split(/\s+/).filter((w) => w !== "${x}");
  if (!words.length) return false;
  if (words.length === 1) {
    const w = words[0];
    if (/^[A-Z][a-z]+[A-Z]/.test(w)) return false; // camelCase / PascalCase names
    return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ’']+(-[A-Za-záéíóúñ’']+)*[.!?…:]*$/.test(w) || /^[A-ZÁÉÍÓÚÑ]{2,}[.!?…:]*$/.test(w);
  }
  const wordy = words.filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w)).length;
  if (wordy / words.length < 0.5) return false;
  // (Class lists, "tab on", "sheet-row lit": a mark inside a word, not a
  // sentence's full stop.)
  if (words.every((w) => /^[a-z0-9_.:-]+$/.test(w)) && words.some((w) => /[-_.:][a-z0-9]/.test(w))) return false;
  return true;
}

// Each string in a file's compiled code, but the ones compared, switched
// on, keyed by or said to the console.
function stringsOf(code, loader) {
  const js = esbuild.transformSync(code, { loader, jsx: "transform", jsxFactory: "h", jsxFragment: "F", target: "esnext", legalComments: "none" }).code;
  const out = [];
  const prev = [];
  for (const m of js.matchAll(TOKENS)) {
    const tok = toToken(m);
    if (tok.type === "whitespace" || tok.type === "comment") continue;
    if (tok.type === "string" || tok.type === "template") {
      const p1 = prev[prev.length - 1], p2 = prev[prev.length - 2], p4 = prev[prev.length - 4];
      const skip = ["===", "!==", "==", "!=", "case", "in"].includes(p1) ||
        (p1 === "(" && ["Error", "TypeError", "warn", "log", "error", "info", "debug"].includes(p2)) ||
        (p1 === "(" && p4 === "console") ||
        (p1 === "(" && ["querySelector", "querySelectorAll", "getItem", "setItem", "removeItem", "addEventListener", "removeEventListener", "getAttribute", "setAttribute", "closest", "matches", "postMessage", "use", "includes", "startsWith", "endsWith", "split", "join", "replace", "test", "dispatchEvent", "CustomEvent", "createElement", "getElementById"].includes(p2));
      if (!skip) {
        let v = tok.value;
        const parts = v[0] === "`";
        v = parts ? v.slice(1, -1).replace(/\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\}/g, "${x}") : v.slice(1, -1);
        out.push({ text: unescape(v).replace(/\s+/g, " ").trim(), parts: parts && v.includes("${x}") });
      }
    }
    prev.push(tok.value);
    if (prev.length > 6) prev.shift();
  }
  return out;
}

export function catalog() {
  const lines = new Map(); // text -> { files: Set, parts }
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = `${dir}/${f}`;
      if (!/\.(jsx?|mjs)$/.test(f) || SKIP.has(rel)) continue;
      let strs;
      try { strs = stringsOf(fs.readFileSync(path.join(ROOT, rel), "utf8"), f.endsWith(".jsx") ? "jsx" : "js"); } catch (e) { console.error("skipped", rel, e.message.split("\n")[0]); continue; }
      for (const { text, parts } of strs) {
        if (!isProse(text)) continue;
        const e = lines.get(text) || { files: new Set(), parts };
        e.files.add(rel);
        lines.set(text, e);
      }
    }
  }
  return lines;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = catalog();
  const whole = [...lines].filter(([, e]) => !e.parts), parted = [...lines].filter(([, e]) => e.parts);
  const arg = process.argv[2];
  if (arg === "--json") {
    fs.writeFileSync(process.argv[3], JSON.stringify(Object.fromEntries([...lines].map(([k, e]) => [k, { files: [...e.files], parts: e.parts }])), null, 1));
  } else if (arg === "--list") {
    for (const [k, e] of lines) console.log(`${[...e.files].join(",")}\t${e.parts ? "PARTS\t" : ""}${k}`);
  } else {
    console.log(`${lines.size} lines: ${whole.length} whole, ${parted.length} made of parts`);
    for (const code of ["es", "vi"]) {
      let table = {};
      try { table = (await import(path.join(ROOT, `i18n/${code}.js`))).default; } catch (e) { /* none yet */ }
      const keys = new Set(Object.keys(table).map((k) => k.replace(/\s+/g, " ").trim()));
      // (Had whole, or a sentence at a time, as chassis/i18n.js tr looks.)
      const has = (k) => keys.has(k) || sentencesOf(k).every((p) => !/[A-Za-z]{2}/.test(p) || keys.has(p.replace(/\s+/g, " ").trim()));
      const missing = whole.filter(([k]) => !has(k));
      console.log(`${code}: ${keys.size} lines in the table; ${missing.length} of the whole lines not in it`);
      for (const [k, e] of missing.slice(0, 40)) console.log(`  ${[...e.files][0]}: ${k}`);
      if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);
    }
    console.log(`made of parts (write them whole, holes named): ${parted.length}`);
    for (const [k, e] of parted.slice(0, 40)) console.log(`  ${[...e.files][0]}: ${k}`);
    if (parted.length > 40) console.log(`  ... and ${parted.length - 40} more`);
  }
}
