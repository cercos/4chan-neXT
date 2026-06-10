// One-off bundle size analysis: same plugin chain as tools/rollup.js (unminified
// userscript), but prints per-module rendered sizes instead of writing a build.
import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import setupFileInliner from './rollup-plugin-inline-file.js';
import faFix from './rollup-plugin-fa.js';
import { dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import importBase64 from './rollup-plugin-base64.js';
import fixTsOutputFormat from './fix-ts-output-format.js';
import cleanup from 'rollup-plugin-cleanup';
import alias from '@rollup/plugin-alias';
import removeDecaffeinateComments from './rollup-plugin-remove-decaffeinate-comments.js';
import removeTestCode from './rollup-plugin-remove-test-code.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'));
const inlineFile = setupFileInliner(packageJson);

const bundle = await rollup({
  input: resolve(root, 'src/main/Main.ts'),
  plugins: [
    removeTestCode({
      include: [
        "**/src/main/Main.ts",
        "**/src/classes/Post.ts",
        "**/src/Linkification/Linkify.ts",
      ],
      sourceMap: false,
    }),
    removeDecaffeinateComments({ include: ["**/*.js", "**/*.ts", "**/*.tsx"] }),
    typescript({ compilerOptions: { outDir: resolve(root, 'testbuilds') } }),
    alias({
      entries: [
        { find: /^@fa\/(.*)$/, replacement: resolve(root, 'node_modules/@fortawesome/free-regular-svg-icons/$1.js') },
        { find: /^@fas\/(.*)$/, replacement: resolve(root, 'node_modules/@fortawesome/free-solid-svg-icons/$1.js') },
      ]
    }),
    fixTsOutputFormat({ include: ["**/*.ts", "**/*.tsx"] }),
    inlineFile({ include: ["**/*.html"], transformer: html => html }),
    inlineFile({ include: ["**/*.css"], transformer: css => css }),
    importBase64({ include: ["**/*.png", "**/*.gif", "**/*.wav", "**/*.woff", "**/*.woff2"] }),
    inlineFile({
      include: "**/package.json",
      wrap: false,
      transformer(input) {
        const meta = JSON.parse(input).meta;
        meta.includes_only = undefined;
        meta.matches_only = undefined;
        meta.matches = undefined;
        meta.matches_extra = undefined;
        meta.exclude_matches = undefined;
        meta.grants = undefined;
        return `export default ${JSON.stringify(meta, undefined, 1)};`;
      }
    }),
    inlineFile({
      include: "**/*.json",
      exclude: "**/package.json",
      wrap: false,
      transformer: input => `export default ${input};`
    }),
    faFix,
    cleanup({
      extensions: ['js', 'ts', 'tsx', 'json', 'html', 'css'],
      comments: 'all',
      lineEndings: 'unix',
      maxEmptyLines: 1,
      sourcemap: false,
    }),
  ],
});

const { output } = await bundle.generate({
  format: 'iife',
  generatedCode: { constBindings: false },
});

const chunk = output[0];
const rows = Object.entries(chunk.modules)
  .map(([id, m]) => [relative(root, id), m.renderedLength])
  .sort((a, b) => b[1] - a[1]);

const total = rows.reduce((s, r) => s + r[1], 0);
console.log(`total rendered: ${total} bytes across ${rows.length} modules\n`);
for (const [id, len] of rows.slice(0, 60)) {
  console.log(String(len).padStart(8), id);
}

// Aggregate by top-level directory
const byDir = {};
for (const [id, len] of rows) {
  const key = id.startsWith('src/') ? id.split('/').slice(0, 2).join('/') :
    id.startsWith('node_modules/') ? id.split('/').slice(0, 2).join('/') : id;
  byDir[key] = (byDir[key] ?? 0) + len;
}
console.log('\n--- by directory ---');
for (const [k, v] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
  console.log(String(v).padStart(8), k);
}
