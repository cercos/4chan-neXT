import { d } from '../globals/globals';

/*
 * Paints search-term matches using the CSS Custom Highlight API
 * (https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API).
 *
 * Unlike wrapping matches in <mark>, this never mutates the DOM: it builds Range
 * objects over the existing text nodes and registers them under a named
 * highlight, painted by a matching `::highlight(name)` rule in the stylesheet.
 * Post/setting structure, event handlers and other plugins are left untouched,
 * which avoids the layout hacks and text save/restore that <mark> injection
 * needed. The named highlights are global, so each caller owns one name.
 */

// The realm whose highlight registry actually paints the page. We must use the
// document's own window: a userscript may run in a sandboxed scope whose `CSS`
// registry is a different object than the one styling the page, and bare globals
// like `Highlight` don't reliably resolve through that sandbox's scope chain
// anyway. Reaching them through `d.defaultView` (mirroring the `self.crypto ||
// window.crypto` / `unsafeWindow` pattern used elsewhere) fixes both.
function view(): (Window & typeof globalThis) | null {
  return (d.defaultView as any) || (typeof self !== 'undefined' ? self : null);
}

// Feature-detect the API on that realm. Firefox only shipped it unprefixed
// fairly recently, so callers fall back (or simply skip highlighting) when false.
function isSupported() {
  const w: any = view();
  return !!(w && w.CSS && w.CSS.highlights && w.Highlight);
}

// Two text nodes are bridgeable iff they share a parent and only `<wbr>`
// elements lie between them — i.e. they're one visual run split only by 4chan's
// cosmetic word-break hints. This deliberately refuses to bridge across any
// other element boundary, so a match can never span unrelated nodes/posts.
function wbrBridged(a: Text, b: Text): boolean {
  if (a.parentNode !== b.parentNode) return false;
  for (let s = a.nextSibling; s && s !== b; s = s.nextSibling) {
    if (s.nodeType !== Node.ELEMENT_NODE || (s as Element).tagName !== 'WBR') return false;
  }
  return true;
}

// Map an offset within a run's combined text back to the (node, offset) pair it
// falls in. `<=` end-inclusive so an offset at a node boundary resolves to the
// end of the earlier node (a valid, equivalent Range position).
function locateInRun(map: { node: Text; start: number; len: number }[], pos: number): { node: Text; offset: number } {
  for (const e of map) {
    if (pos <= e.start + e.len) return { node: e.node, offset: pos - e.start };
  }
  const last = map[map.length - 1];
  return { node: last.node, offset: last.len };
}

// Collect every match of `rx` across a run of one or more text nodes, pushing a
// Range per match (which may span nodes when the run was stitched across `<wbr>`).
function collectRunMatches(run: Text[], rx: RegExp, ranges: Range[]): void {
  rx.lastIndex = 0;
  if (run.length === 1) {
    const node = run[0];
    const text = node.nodeValue || '';
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      // Defensive: a zero-width match would loop forever and paint nothing.
      if (!m[0]) { rx.lastIndex++; continue; }
      const range = d.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      ranges.push(range);
    }
    return;
  }
  let combined = '';
  const map: { node: Text; start: number; len: number }[] = [];
  for (const node of run) {
    const len = (node.nodeValue || '').length;
    map.push({ node, start: combined.length, len });
    combined += node.nodeValue || '';
  }
  let m: RegExpExecArray | null;
  while ((m = rx.exec(combined))) {
    if (!m[0]) { rx.lastIndex++; continue; }
    const s = locateInRun(map, m.index);
    const e = locateInRun(map, m.index + m[0].length);
    const range = d.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    ranges.push(range);
  }
}

// Declared with `var` (not `const`) and exported under the same name importers
// bind to: Settings.tsx sits in deep circular-dependency chains, and Rollup
// gives `const` bindings temporal-dead-zone treatment across cycles that left
// the cyclic importer's reference unrewritten — a runtime `ReferenceError`. The
// `var`-singleton shape (matching Time/Favicon/etc.) links cleanly.
// eslint-disable-next-line no-var
var SearchHighlight = {
  get supported() {
    return isSupported();
  },

  escape(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  // Build a Range over every match of `rx` (which MUST carry the global flag, or
  // exec would loop forever) within the text nodes under `root`. Pure: it reads
  // the DOM and returns ranges without touching the highlight registry, so
  // callers can gather ranges across many roots/fields and register them at once.
  //
  // Consecutive text nodes separated only by `<wbr>` are stitched into one run
  // and matched together, so a term can span the break. 4chan injects `<wbr>`
  // (word-break hints) into long URLs/words, splitting e.g. `…4chan-<wbr>xt` into
  // separate text nodes; without stitching, a search for `4chan-xt` would match
  // nothing even though the text reads as one word on screen. The resulting Range
  // legitimately spans two text nodes (setStart in one, setEnd in the next).
  rangesFor(root: Node, rx: RegExp): Range[] {
    const ranges: Range[] = [];
    if (!root) return ranges;
    const walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) texts.push(node as Text);
    }
    for (let i = 0; i < texts.length;) {
      // Greedily extend a run while the next text node is the same parent's and
      // only `<wbr>` elements sit between them (a zero-width, purely cosmetic
      // break). Anything else ends the run, so matches never bridge unrelated
      // elements/posts.
      const run = [texts[i]];
      while (i + 1 < texts.length && wbrBridged(texts[i], texts[i + 1])) {
        run.push(texts[++i]);
      }
      i++;
      collectRunMatches(run, rx, ranges);
    }
    return ranges;
  },

  // Register `ranges` under `name`, replacing whatever was there; an empty list
  // clears it. Returns false when the API is unavailable.
  setRanges(name: string, ranges: Range[]) {
    const w: any = view();
    if (!w || !w.CSS || !w.CSS.highlights || !w.Highlight) return false;
    if (ranges && ranges.length) {
      w.CSS.highlights.set(name, new w.Highlight(...ranges));
    } else {
      w.CSS.highlights.delete(name);
    }
    return true;
  },

  // Register, under `name`, a highlight covering every case-insensitive
  // occurrence of any term within the text nodes under `roots` (one element or a
  // list). Whatever was previously registered under `name` is replaced; an empty
  // query — or no matches — clears it. Returns false when the API is unavailable.
  apply(name: string, roots: Node | Node[], terms: string[]) {
    const w: any = view();
    if (!w || !w.CSS || !w.CSS.highlights || !w.Highlight) return false;
    const list = Array.isArray(roots) ? roots : [roots];
    if (!terms.length || !list.length) {
      w.CSS.highlights.delete(name);
      return true;
    }

    const rx = RegExp(terms.map(SearchHighlight.escape).join('|'), 'gi');
    const ranges: Range[] = [];
    for (const root of list) {
      ranges.push(...SearchHighlight.rangesFor(root, rx));
    }
    return SearchHighlight.setRanges(name, ranges);
  },

  clear(name: string) {
    const w: any = view();
    if (w && w.CSS && w.CSS.highlights) w.CSS.highlights.delete(name);
  },
};

// Exported both ways: Index imports the default, while Settings.tsx — buried in
// deep circular-dependency chains — must use the *named* import. Rollup links a
// named import as a live binding to this exported variable, whereas the default
// import into the cyclic module left a dangling, unrewritten reference (runtime
// `ReferenceError: SearchHighlight is not defined`).
export { SearchHighlight };
export default SearchHighlight;
