/* The JSX runtime the pages are built with (build/build.js: jsxImportSource
   "ec-i18n", which is this folder): React's own, each of the browser's own
   elements given its words in the player's language (chassis/i18n.js tr):
   its text, and its title, aria-label, placeholder and alt. A component's
   props are left as they are (it may compare them, or key on them); they
   are looked up where it shows them, in an element of its own. Never a
   <style> or a <script>. In English, nothing's touched. */
import React from "react";
import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from "react/jsx-runtime";
import { tr, translating } from "../i18n.js";

const SAID = ["title", "aria-label", "placeholder", "alt"];

function said(type, props) {
  if (typeof type !== "string" || type === "style" || type === "script" || !props || !translating()) return props;
  let out = props;
  const c = props.children;
  if (typeof c === "string") {
    const v = tr(c);
    if (v !== c) out = { ...props, children: v };
  } else if (Array.isArray(c)) {
    let copy = null;
    for (let i = 0; i < c.length; i++) {
      if (typeof c[i] !== "string") continue;
      const v = tr(c[i]);
      if (v !== c[i]) (copy ||= c.slice())[i] = v;
    }
    if (copy) out = { ...props, children: copy };
  }
  for (const k of SAID) {
    const v = props[k];
    if (typeof v !== "string" || !v) continue;
    const w = tr(v);
    if (w !== v) { if (out === props) out = { ...props }; out[k] = w; }
  }
  return out;
}

export const jsx = (type, props, key) => reactJsx(type, said(type, props), key);
export const jsxs = (type, props, key) => reactJsxs(type, said(type, props), key);
export { Fragment };

/* The same for the files that build their elements with createElement
   rather than JSX (the themes' menus, themes/*.js): React's, each of the
   browser's own elements given its words. */
const sayKid = (k) => (typeof k === "string" ? tr(k) : Array.isArray(k) ? k.map((x) => (typeof x === "string" ? tr(x) : x)) : k);
export function createElement(type, props, ...kids) {
  if (typeof type !== "string" || type === "style" || type === "script" || !translating()) return React.createElement(type, props, ...kids);
  return React.createElement(type, props ? said(type, props) : props, ...kids.map(sayKid));
}
