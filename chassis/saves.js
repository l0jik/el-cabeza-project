/* Saves that outlive the browser (user: "saves that survive clearing the
   browser or carry to another device"; chose a cloud code on the game's
   own server plus a file that needs no server). A save is everything this
   browser keeps for the game: every localStorage key of the game's (the
   story's progress, the settings, the sound levels, the last world, the
   City's hour...), as one JSON record.

   - A file: downloadSave() hands the browser a .json; readSaveFile()
     reads one back; applySave() puts its keys in place (the page then
     reloads, since much of the game reads its keys as it starts).
   - The cloud: cloudSave() posts the record to the server (server/relay.js
     /saves) and gets an eight-letter code, kept here with its token so
     the next save updates the same code; cloudFetch(code) gets one back;
     a link with ?restore=CODE restores it on any page (takeRestoreParam
     reads the word off the address, once). */
import { savesBaseUrl, relayReady } from "./online-config.js";
import { t } from "./i18n.js";

export const SAVE_PREFIXES = ["el-cabeza:", "elcabeza.", "ec:"];
// (not carried: the relay's address override, this browser's own)
const NOT_CARRIED = new Set(["el-cabeza:relay"]);
export const CLOUD_KEY = "el-cabeza:cloud-save";
export const FORMAT = 1;

const ours = (k) => SAVE_PREFIXES.some((p) => k.startsWith(p)) && !NOT_CARRIED.has(k);

export function collectSave({ version = "" } = {}) {
  const keys = {};
  try {
    const st = window.localStorage;
    for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && ours(k)) keys[k] = st.getItem(k); }
  } catch (e) { /* storage blocked: an empty save */ }
  let page = "";
  try { page = window.location.pathname.split("/").pop() || ""; } catch (e) { /* none */ }
  return { app: "el-cabeza", format: FORMAT, version, savedAt: new Date().toISOString(), page, keys };
}

// Is this a save of ours? (A plain check before anything's overwritten.)
export function isSave(s) {
  return !!(s && typeof s === "object" && s.app === "el-cabeza" && s.keys && typeof s.keys === "object" && !Array.isArray(s.keys));
}

/* Puts a save's keys in place of this browser's: the game's own keys go
   first, so nothing of a different record lingers. Returns how many were
   written. */
export function applySave(save) {
  if (!isSave(save)) throw new Error("That isn't an El Cabeza save.");
  const st = window.localStorage;
  const gone = [];
  for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && ours(k)) gone.push(k); }
  gone.forEach((k) => st.removeItem(k));
  let n = 0;
  Object.entries(save.keys).forEach(([k, v]) => { if (ours(k) && typeof v === "string") { st.setItem(k, v); n++; } });
  return n;
}

export function saveFileName(save) {
  const d = (save && save.savedAt ? new Date(save.savedAt) : new Date());
  const p = (x) => String(x).padStart(2, "0");
  return `el-cabeza-save-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

// The save as a file the browser offers to keep.
export function downloadSave(save) {
  const text = JSON.stringify(save, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = saveFileName(save); a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  return a.download;
}

export function readSaveFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error("No file picked.")); return; }
    if (file.size > 2 * 1024 * 1024) { reject(new Error("That file is too big to be a save.")); return; }
    const r = new FileReader();
    r.onerror = () => reject(new Error("The file couldn't be read."));
    r.onload = () => {
      try {
        const s = JSON.parse(String(r.result));
        if (!isSave(s)) { reject(new Error("That isn't an El Cabeza save.")); return; }
        resolve(s);
      } catch (e) { reject(new Error("That isn't an El Cabeza save.")); }
    };
    r.readAsText(file);
  });
}

/* ---- the cloud */

export function cloudRecord() {
  try { const r = JSON.parse(window.localStorage.getItem(CLOUD_KEY) || "null"); return r && r.code ? r : null; } catch (e) { return null; }
}
function keepCloudRecord(rec) {
  try { window.localStorage.setItem(CLOUD_KEY, JSON.stringify(rec)); } catch (e) { /* this visit only */ }
}
export const normalizeCode = (c) => {
  const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : "";
};

async function request(method, url, body, headers = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, mode: "cors", cache: "no-store" });
  } catch (e) { throw new Error("The server can't be reached."); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || t("The server said {status}.", { status: res.status }));
  return data;
}

/* Saves to the cloud: updates this browser's code if it has one (and the
   server still has it), else makes a new one. Resolves { code, savedAt,
   updated }. */
export async function cloudSave(save) {
  if (!relayReady()) throw new Error("The server isn't set up yet.");
  const base = savesBaseUrl();
  const mine = cloudRecord();
  if (mine && mine.token) {
    try {
      const r = await request("PUT", `${base}/saves/${mine.code}`, save, { "X-Save-Token": mine.token });
      keepCloudRecord({ ...mine, savedAt: r.savedAt });
      return { code: mine.code, savedAt: r.savedAt, updated: true };
    } catch (e) {
      if (!/no save|not your save/.test(e.message)) throw e;
      // (gone from the server, or someone else's now: a new code)
    }
  }
  const r = await request("POST", `${base}/saves`, save);
  keepCloudRecord({ code: r.code, token: r.token, savedAt: r.savedAt });
  return { code: r.code, savedAt: r.savedAt, updated: false };
}

export async function cloudFetch(code) {
  if (!relayReady()) throw new Error("The server isn't set up yet.");
  const c = normalizeCode(code);
  if (!c) throw new Error("A code is eight letters, like ABCD-EFGH.");
  const r = await request("GET", `${savesBaseUrl()}/saves/${c}`);
  if (!isSave(r.save)) throw new Error("That code holds nothing of the game's.");
  return { code: r.code, savedAt: r.savedAt, save: r.save };
}

// A link that restores a code on this page.
export function restoreLink(code) {
  try {
    const url = new URL(window.location.href);
    ["restore", "fresh", "switcher", "restart", "join", "relay"].forEach((k) => url.searchParams.delete(k));
    url.searchParams.set("restore", code);
    return url.toString();
  } catch (e) { return ""; }
}

/* ?restore=CODE on any page: the code, taken off the address (so the
   reload after restoring it starts clean), or null. */
export function takeRestoreParam() {
  try {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("restore");
    if (!c) return null;
    url.searchParams.delete("restore");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return normalizeCode(c) || null;
  } catch (e) { return null; }
}

/* The restore a link asked for, played out: fetched, put in place, and
   the page reloaded on it. A failure is noted for the Save & carry sheet
   to show (sessionStorage, once). */
export const RESTORE_NOTE_KEY = "el-cabeza:restore-note";
export function restoreFromLink() {
  const code = takeRestoreParam();
  if (!code) return false;
  cloudFetch(code).then(({ save }) => {
    const n = applySave(save);
    try { window.sessionStorage.setItem(RESTORE_NOTE_KEY, t(n === 1 ? "Restored {n} thing from {code}." : "Restored {n} things from {code}.", { n, code })); } catch (e) { /* none */ }
    window.location.reload();
  }).catch((e) => {
    try { window.sessionStorage.setItem(RESTORE_NOTE_KEY, t("Couldn't restore {code}: {why}", { code, why: e.message })); } catch (err) { /* none */ }
  });
  return true;
}
export function takeRestoreNote() {
  try { const n = window.sessionStorage.getItem(RESTORE_NOTE_KEY); if (n) window.sessionStorage.removeItem(RESTORE_NOTE_KEY); return n || ""; } catch (e) { return ""; }
}
