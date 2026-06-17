import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import setupFileInliner from './rollup-plugin-inline-file.js';
import faFix from './rollup-plugin-fa.js';
import { dirname, resolve, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import generateMetadata from '../src/meta/metadata.js';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import importBase64 from './rollup-plugin-base64.js';
import generateManifestJson from '../src/meta/manifestJson.js';
import terser from '@rollup/plugin-terser';
import fixTsOutputFormat from './fix-ts-output-format.js';
import cleanup from 'rollup-plugin-cleanup';
import alias from '@rollup/plugin-alias';
import platformSpecific from './rollup-plugin-platform-specific.js';
import removeDecaffeinateComments from './rollup-plugin-remove-decaffeinate-comments.js';
import removeTestCode from './rollup-plugin-remove-test-code.js';
import tabIndent from './rollup-plugin-tab-indent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const buildDirArg = process.argv.find(arg => arg.startsWith('-build-dir='))?.slice(11);
const buildDir = buildDirArg ? resolve(__dirname, '..', buildDirArg) : resolve(__dirname, '../builds/');

const minify = process.argv.includes('-min');
const noFormat = process.argv.includes('-no-format');
const platform = /** @type {'crx'|'userscript'} */ (process.argv.find(arg => arg.startsWith('-platform='))?.slice(10));
if (platform !== undefined && platform !== 'crx' && platform !== 'userscript') {
  throw new Error('incorrect value for the platform argument');
}
const buildForTest = process.argv.includes('-test');
// -channel=<label> brands the userscript as a separate install (distinct @name +
// @namespace) so it can sit alongside the release build. Its update/download
// URLs point at -channel-base=<url> (default: a local http-server matching the
// build dir, see `npm run serve:8123`) so "Check for updates" reinstalls locally.
const channel = process.argv.find(arg => arg.startsWith('-channel='))?.slice(9);
const buildDirRel = relative(resolve(__dirname, '..'), buildDir).split(sep).join('/');
const channelBaseUrl = process.argv.find(arg => arg.startsWith('-channel-base='))?.slice(14)
  || `http://localhost:8123/${buildDirRel}`;
// Code comments are stripped from the unminified build by default (userscript header +
// license banner are added after this runs, so they're unaffected). Saves ~7%.
// Pass -keep-comments for a fully commented build.
const stripComments = !process.argv.includes('-keep-comments');
const sourcemap = minify;

const onwarn = (warning, warn) => {
  // The legacy feature registry has tolerated singleton cycles; keep testbuild output focused on actionable warnings.
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  warn(warning);
};

// https://github.com/rollup/plugins/discussions/1777
const tsPlugin = typescript({
  compilerOptions: { outDir: buildDir, sourceMap: sourcemap },
});

(async () => {
  const packageJson = JSON.parse(await readFile(resolve(__dirname, '../package.json'), 'utf-8'));

  const fileName = `${packageJson.meta.path}${minify ? '.min' : ''}.user.js`;
  const metaFileName = `${packageJson.meta.path}${minify ? '.min' : ''}.meta.js`;

  const metadata = await generateMetadata(packageJson, fileName, metaFileName, { channel, channelBaseUrl });

  const license = await readFile(resolve(__dirname, '../LICENSE'), 'utf8');

  const version = JSON.parse(await readFile(resolve(__dirname, '../version.json'), 'utf-8'));

  const inlineFile = setupFileInliner(packageJson);

  const cleanupPlugin = noFormat ? undefined : cleanup({
    extensions: minify ? ['html', 'css'] : ['js', 'ts', 'tsx', 'json', 'html', 'css'],
    comments: stripComments ? 'none' : 'all',
    lineEndings: 'unix',
    maxEmptyLines: 1,
    sourcemap,
  });

  const bundle = await rollup({
    input: resolve(__dirname, '../src/main/Main.ts'),
    onwarn,
    plugins: [
      platform ? platformSpecific({
        platform,
        include: [
          // Only files that actually have platform specific code.
          "**/src/main/Main.ts",
          "**/src/platform/$.ts",
          "**/src/platform/CrossOrigin.ts",
        ],
        minify
      }) : undefined,
      buildForTest ? undefined : removeTestCode({
        include: [
          // Only files that actually have test code.
          "**/src/main/Main.ts",
          "**/src/classes/Post.ts",
          "**/src/Linkification/Linkify.ts",
        ],
        sourceMap: sourcemap,
      }),
      noFormat || minify ? undefined : removeDecaffeinateComments({
        include: ["**/*.js", "**/*.ts", "**/*.tsx"],
      }),
      tsPlugin,
      alias({
        entries: [
          {
            find: /^@fa\/(.*)$/,
            replacement: resolve(__dirname, '../node_modules/@fortawesome/free-regular-svg-icons/$1.js')
          },
          {
            find: /^@fas\/(.*)$/,
            replacement: resolve(__dirname, '../node_modules/@fortawesome/free-solid-svg-icons/$1.js')
          },
        ]
      }),
      minify || noFormat ? undefined : fixTsOutputFormat({
        include: ["**/*.ts", "**/*.tsx"],
      }),
      inlineFile({
        include: ["**/*.html"],
        transformer(html) {
          // Collapse indentation/newlines to single spaces. Applied to readable
          // builds too: rendering is identical and inlined HTML isn't hand-edited
          // in the bundle. (Same transform the minified build uses.)
          return html.replace(/\n */g, ' ');
        },
      }),
      inlineFile({
        include: ["**/*.css"],
        transformer(css) {
          // Compress inlined CSS in every build. Output is functionally identical
          // and bundle CSS isn't hand-edited; keeps the readable build smaller
          // while leaving JS untouched. (Same transform the minified build uses.)
          return css
            // Remove comments first, including multi-line comments that contain
            // asterisks.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Collapse whitespace without deleting descendant-selector spaces.
            .replace(/\s+/g, ' ')
            // Remove whitespace around structural punctuation and combinators
            // where spaces are always optional. ':' is deliberately excluded
            // here: a space BEFORE ':' can be a descendant combinator targeting
            // a pseudo-class (e.g. `.win :is(...)`, `.row :hover`), and stripping
            // it fuses the two into a compound selector, silently changing the
            // rule's meaning (this broke the "Highlight neXT" settings badges).
            .replace(/\s*([{};,>+~])\s*/g, '$1')
            // Colon: only strip the space AFTER it (declaration `prop: value` ->
            // `prop:value`). A valid stylesheet never has a meaningful space
            // before ':' to remove, so we leave the leading side untouched.
            .replace(/:\s+/g, ':')
            // Remove the last semicolon before a rule closes.
            .replace(/;\}/g, '}')
            .trim();
        }
      }),
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
        transformer(input) {
          return `export default ${input};`;
        }
      }),
      faFix,
      cleanupPlugin,
    ].filter(Boolean)
  });

  /** @type {import('rollup').OutputOptions} */
  const sharedBundleOpts = {
    format: "iife",
    generatedCode: {
      // needed for possible circular dependencies
      constBindings: false,
    },
    name: "FourchanNeXT",
    sourcemap,
    // Can't be none as long as the root file defined exports
    // exports: 'none',
  };

  // user script
  if (platform !== 'crx') {
    await mkdir(buildDir, { recursive: true });
    await bundle.write({
      ...sharedBundleOpts,
      banner: (metadata + license).replace(/\r\n/g, '\n'),
      // file: '../builds/test/rollupOutput.js',
      file: resolve(buildDir, fileName),
      plugins: minify ? [terser({
        format: {
          max_line_len: 1000,
          comments: /^(?: ==\/?UserScript==| @|!)|license|\bcc\b|copyright/i,
        },
      })] : [tabIndent()],
    });

    await writeFile(resolve(buildDir, metaFileName), metadata);
  }

  // chrome extension
  if (platform !== 'userscript') {
    const crxDir = resolve(buildDir, 'crx');
    await mkdir(crxDir, { recursive: true });
    await bundle.write({
      ...sharedBundleOpts,
      banner: license.replace(/\r\n/g, '\n'),
      file: resolve(crxDir, 'script.js'),
      plugins: minify ? [] : [tabIndent()],
    });

    const eventPage = await rollup({
      input: resolve(__dirname, '../src/meta/eventPage.ts'),
      onwarn,
      plugins: [
        tsPlugin,
        noFormat ? undefined : fixTsOutputFormat({ include: ["**/*.ts", "**/*.tsx"] }),
        cleanupPlugin,
      ].filter(Boolean),
    });

    await eventPage.write({
      format: 'module',
      file: resolve(crxDir, 'eventPage.js'),
      sourcemap,
    });

    await writeFile(
      resolve(crxDir, 'manifest.json'),
      generateManifestJson(packageJson, version, 2),
    );

    await writeFile(
      resolve(crxDir, 'manifestV3.json'),
      generateManifestJson(packageJson, version, 3),
    );

    for (const file of ['icon16.png', 'icon48.png', 'icon128.png']) {
      await copyFile(resolve(__dirname, '../src/meta/', file), resolve(crxDir, file));
    };
  }
})();
