#!/usr/bin/env node
'use strict';

// Generates src/config/nextSettingsDiff.json: the set of settings that neXT
// ADDED or CHANGED relative to 4chan-XT, the fork neXT was renamed from.
// Powers the "Highlight neXT settings" toggle in the Settings dialog.
//
//   added   = setting key present in neXT but not in 4chan-XT
//   changed = key present in both, but neXT ships a different DEFAULT value
//
// Baseline lineage: ccd0/4chan-X -> TuxedoTako/4chan-xt ("XT") -> 4chan-neXT.
// "XT" is the PRIOR NAME OF THIS FORK, not ccd0's 4chan-X — so the baseline is
// the XT tip, NOT upstream 4chan-X. The committed snapshot tools/baseline/
// xt-Config.js is Config.js at commit ee5a63846 ("The end", 2025-12-23) — the
// last commit before neXT work began (identical to the XT 2.24.1 release tag).
// Regenerate the snapshot with: git show ee5a63846:src/config/Config.js > tools/baseline/xt-Config.js
//
// "changed" is deliberately limited to default-value differences (a crisp,
// low-false-positive signal that neXT altered a setting's behavior). Pure
// description rewordings are not flagged. Both sides are normalized so that
// keys differing only by the app name (e.g. "Use <name> Catalog") line up.
//
// Run: node tools/gen-next-settings-diff.js   (or: npm run gen:next-diff)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEXT_CONFIG = path.join(ROOT, 'src/config/Config.ts');
const XT_CONFIG = path.join(ROOT, 'tools/baseline/xt-Config.js');
const OUT = path.join(ROOT, 'src/config/nextSettingsDiff.json');

const NEXT_NAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).meta.name; // "4chan-neXT"
const NAME_TOKEN = '￿'; // placeholder both app names collapse to

// Matches a setting row opener in either source dialect:
//   'Plain Key': [            (coffee + ts)
//   "Plain Key": [
//   [`Use ${meta.name} Catalog`]: [   (ts computed key)
// Matches any indented setting entry: a quoted/computed key plus the start of
// its value. Group 5 is the value, used to classify the entry shape:
//   'Key': [            -> multi-line array (default on the next line)
//   'Key': [false, '…'] -> single-line array
//   'Key': 'vertical'   -> scalar (select/number/boolean)
//   'Key': {            -> object/section (skipped; its keys match on their own lines)
const ENTRY = /^(\s+)(?:\[`([^`]+)`\]|'([^']+)'|"([^"]+)"):\s*(.+?)\s*$/;

// Replace the app-name template token (ts `${meta.name}` / coffee `<%= meta.name %>`)
// with the shared placeholder so name-only differences don't read as changes.
function normalizeName(str) {
  return str
    .replace(/\$\{\s*meta\.name\s*\}/g, NAME_TOKEN)
    .replace(/<%=\s*meta\.name\s*%>/g, NAME_TOKEN);
}

// Resolve the template token to neXT's actual name (matches runtime data-name).
function resolveName(str) {
  return str.replace(/\$\{\s*meta\.name\s*\}/g, NEXT_NAME);
}

// A scalar default we can compare with confidence. Multiline / object / array
// defaults parse as null and are excluded from "changed" detection.
function parseScalarDefault(line) {
  const t = line.trim().replace(/,\s*$/, '');
  if (t === 'true') return { kind: 'bool', value: true };
  if (t === 'false') return { kind: 'bool', value: false };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: 'num', value: t };
  const m = t.match(/^(['"`])([\s\S]*)\1$/);
  if (m) return { kind: 'str', value: normalizeName(m[2]) };
  return null; // object/array/multiline/expression — not comparable
}

// Extract a quoted description string from a line, normalized.
function parseDescription(line) {
  const t = line.trim().replace(/,\s*$/, '');
  const m = t.match(/^(['"`])([\s\S]*)\1$/);
  return m ? normalizeName(m[2]) : null;
}

// Split the inside of a single-line array literal into top-level elements,
// respecting quotes (so commas inside strings don't split). Good enough for the
// simple [default, 'description', level] shapes Config uses.
function splitArrayElements(inner) {
  const out = [];
  let buf = '', quote = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      buf += c;
      if (c === quote && inner[i - 1] !== '\\') quote = null;
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c; buf += c;
    } else if (c === ',') {
      out.push(buf.trim()); buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// Parse a Config source file into Map<normKey, { rawKey, def, desc }>. Handles
// multi-line arrays, single-line arrays, and scalar settings; skips object /
// section openers (their inner keys are matched on their own lines).
function parseConfig(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const map = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ENTRY);
    if (!m) continue;
    const rawSrcKey = m[2] || m[3] || m[4];
    const value = m[5];
    if (value.startsWith('{')) continue; // object / section, not a setting

    const rawKey = resolveName(rawSrcKey);
    const normKey = normalizeName(rawSrcKey);
    let def = null, desc = null;

    if (value === '[') {
      // Multi-line array: default on next non-blank line, desc shortly after.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      def = parseScalarDefault(lines[j] || '');
      for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
        desc = parseDescription(lines[k]);
        if (desc !== null) break;
      }
    } else if (value.startsWith('[')) {
      // Single-line array: [default, 'description', level]
      const close = value.lastIndexOf(']');
      const els = splitArrayElements(value.slice(1, close < 0 ? value.length : close));
      def = parseScalarDefault(els[0] || '');
      desc = els[1] != null ? parseDescription(els[1]) : null;
    } else {
      // Scalar setting: the value IS the default (e.g. selects, numbers, bools).
      def = parseScalarDefault(value);
    }

    // First definition wins; keys are unique per file in practice.
    if (!map.has(normKey)) map.set(normKey, { rawKey, def, desc });
  }
  return map;
}

const xt = parseConfig(XT_CONFIG);
const next = parseConfig(NEXT_CONFIG);

// Internal namespaced state keys (e.g. "download-all-picker.position") are never
// user-facing settings. They look like dotted identifiers with NO spaces — so
// only drop dotted keys that contain no whitespace (real settings are phrases,
// and some legitimately contain a dot, e.g. "Convert YouTube to yewtu.be").
const isDialogSetting = (key) => !(key.includes('.') && !/\s/.test(key));

// Manual curation overrides — the maintainer's call beats the heuristic. Keys
// are final (resolved) setting keys, by KEY not dialog label (e.g. the row
// labelled "Title Content" is key "Thread Title"). FORCE_REMOVE un-highlights a
// flagged setting; FORCE_ADD highlights one the diff misses as "added";
// FORCE_CHANGED highlights one as "changed" (and pulls it out of "added") — for
// settings that are a behavioral reworking of XT functionality rather than a new
// key, which the default/description heuristic can't infer on its own.
const FORCE_REMOVE = new Set([
  'Detailed Thread Stats',
  'Relative Post Dates',
  'Relative Date Title',
  'Thread Title',        // labelled "Title Content"
  'Unread Title Count',  // labelled "Unread Count"
  'Auto-process Images',
]);
const FORCE_ADD = new Set([
]);
const FORCE_CHANGED = new Set([
  // neXT-combined toggle for all media types; supersedes XT's per-extension
  // Replace GIF/JPG/PNG/WEBM, so it reads as a change to existing behavior.
  'Replace Thumbnails',
]);

const added = [];
const changed = [];
for (const [normKey, { rawKey, def, desc }] of next) {
  if (!isDialogSetting(rawKey)) continue;
  if (!xt.has(normKey)) { added.push(rawKey); continue; }
  const x = xt.get(normKey);
  // A setting "changed" if neXT ships a different default (behavior) or a
  // different description (a reworked/retuned setting). Both compared only when
  // both sides parsed cleanly, to avoid spurious diffs on multiline values.
  const defChanged = def && x.def && (def.kind !== x.def.kind || String(def.value) !== String(x.def.value));
  const descChanged = desc != null && x.desc != null && desc !== x.desc;
  if (defChanged || descChanged) changed.push(rawKey);
}

// Apply curation overrides. FORCE_CHANGED also pulls the key out of "added" so a
// reworked-behavior setting reads as changed, not new.
let addedFinal = added.filter(k => !FORCE_REMOVE.has(k) && !FORCE_CHANGED.has(k));
let changedFinal = changed.filter(k => !FORCE_REMOVE.has(k));
for (const k of FORCE_ADD) {
  if (!addedFinal.includes(k) && !changedFinal.includes(k)) addedFinal.push(k);
}
for (const k of FORCE_CHANGED) {
  if (!FORCE_REMOVE.has(k) && !changedFinal.includes(k)) changedFinal.push(k);
}
addedFinal.sort();
changedFinal.sort();

const out = {
  _comment: 'GENERATED by tools/gen-next-settings-diff.js — do not edit by hand.',
  _generatedFrom: { next: 'src/config/Config.ts', xt: 'tools/baseline/xt-Config.js (4chan-XT @ ee5a63846)' },
  counts: { xt: xt.size, next: next.size, added: addedFinal.length, changed: changedFinal.length },
  added: addedFinal,
  changed: changedFinal,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`XT keys: ${xt.size}  neXT keys: ${next.size}`);
console.log(`added: ${addedFinal.length}  changed: ${changedFinal.length} (FORCE_REMOVE ${FORCE_REMOVE.size}, FORCE_ADD ${FORCE_ADD.size}, FORCE_CHANGED ${FORCE_CHANGED.size})`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log('\nADDED:\n  ' + addedFinal.join('\n  '));
console.log('\nCHANGED:\n  ' + changedFinal.join('\n  '));
