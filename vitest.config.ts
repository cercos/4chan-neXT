import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

// Vite normalizes ids to forward slashes, even on Windows.
const posix = (p: string) => p.split(sep).join('/');
const root = dirname(fileURLToPath(import.meta.url));
const srcDir = posix(root) + '/src/';

// Read rather than import: an import would be typed by the app's ambient
// `*/package.json` declaration (which models the build-time rewrite to `meta`).
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  meta: Record<string, unknown>,
};

// Serves the non-JS imports that the rollup build inlines (see tools/rollup.js):
// .html/.css become template-literal strings with <%= meta.x %> substitution
// (mirroring tools/rollup-plugin-inline-file.js), binary assets become base64
// strings (mirroring tools/rollup-plugin-base64.js), and package.json becomes
// its trimmed `meta` object. Only imports coming from src/ are intercepted.
// resolveId returns a \0-prefixed id with a neutral .inline suffix: the \0 tells
// other plugins to leave it alone, and the suffix keeps vite's css/json pipelines
// (which match on the id's extension) from claiming the module.
const INLINE_EXTS = /\.(html|css|png|gif|wav|woff2?)$/;
const SUFFIX = '.inline';

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

function inlineAssets(): Plugin {
  return {
    name: 'inline-assets',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('\0') || !importer || !posix(importer).startsWith(srcDir)) return;
      if (INLINE_EXTS.test(source) || source.endsWith('package.json')) {
        return '\0' + resolve(dirname(importer), source) + SUFFIX;
      }
    },
    async load(id) {
      if (!id.startsWith('\0') || !id.endsWith(SUFFIX)) return;
      const file = id.slice(1, -SUFFIX.length);
      if (file.endsWith('package.json')) {
        const meta: Record<string, unknown> = { ...packageJson.meta };
        for (const key of ['includes_only', 'matches_only', 'matches', 'matches_extra', 'exclude_matches', 'grants']) {
          delete meta[key];
        }
        return `export default ${JSON.stringify(meta)};`;
      }
      if (/\.(html|css)$/.test(file)) {
        let text = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
        // Same whitespace collapse the build applies to inlined HTML. The build
        // also minifies inlined CSS; tests don't assert on CSS text, so raw CSS
        // is kept here.
        if (file.endsWith('.html')) text = text.replace(/\n */g, ' ');
        text = escape(text.trim()).replace(/<%= meta\.(\w+) %>/g,
          (_, key: string) => escape(String(packageJson.meta[key])));
        return `export default \`${text}\`;`;
      }
      const buf = await readFile(file);
      return `export default '${buf.toString('base64')}';`;
    },
  };
}

export default defineConfig({
  plugins: [inlineAssets()],
  resolve: {
    // Mirrors the @fa/@fas aliases in tools/rollup.js and tsconfig.json paths.
    alias: [
      { find: /^@fa\/(.*)$/, replacement: resolve(root, 'node_modules/@fortawesome/free-regular-svg-icons/$1.js') },
      { find: /^@fas\/(.*)$/, replacement: resolve(root, 'node_modules/@fortawesome/free-solid-svg-icons/$1.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
