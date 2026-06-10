/**
 * Output plugin that converts leading-space indentation (2 spaces per level) to tabs
 * in the final unminified bundle. Rendering is identical in any editor, but each
 * indent level costs 1 byte instead of 2 (~8% smaller bundle).
 *
 * Lines that start inside template literals are left untouched, so inlined CSS/HTML
 * strings and user-visible multiline text defaults keep their exact content.
 */
export default function tabIndent() {
  return {
    name: 'tab-indent',
    renderChunk(code) {
      // Collect [start, end] ranges of template literals via the AST, so we know
      // which lines begin inside string content rather than code.
      const templateRanges = [];
      const collect = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'TemplateLiteral') {
          templateRanges.push([node.start, node.end]);
          // No need to recurse: nested templates inside expressions are covered
          // only if outside this range, but a nested template is always inside it.
          return;
        }
        for (const key of Object.keys(node)) {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const child of value) collect(child);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };
      collect(this.parse(code, { allowReturnOutsideFunction: true }));
      templateRanges.sort((a, b) => a[0] - b[0]);

      const lines = code.split('\n');
      let offset = 0;
      let rangeIdx = 0;
      const out = new Array(lines.length);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineStart = offset;
        offset += line.length + 1;

        // Advance past ranges that end before this line.
        while (rangeIdx < templateRanges.length && templateRanges[rangeIdx][1] <= lineStart) {
          rangeIdx++;
        }
        const inTemplate = rangeIdx < templateRanges.length
          && templateRanges[rangeIdx][0] < lineStart
          && lineStart < templateRanges[rangeIdx][1];

        if (inTemplate) {
          out[i] = line;
          continue;
        }
        const match = /^ {2,}/.exec(line);
        if (!match) {
          out[i] = line;
          continue;
        }
        const len = match[0].length;
        out[i] = '\t'.repeat(len >> 1) + (len % 2 ? ' ' : '') + line.slice(len);
      }
      return { code: out.join('\n'), map: null };
    },
  };
}
