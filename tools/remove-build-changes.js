#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const args = new Set(process.argv.slice(2));
const removeAll = args.has('--all');

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
const buildBaseName = packageJson.meta.path;

const defaultRestoreTargets = [
  `builds/${buildBaseName}.user.js`,
  `builds/${buildBaseName}.meta.js`,
  `builds/${buildBaseName}.min.user.js`,
  `builds/${buildBaseName}.min.meta.js`,
  `builds/${buildBaseName}.crx`,
  'builds/crx/eventPage.js',
  'builds/crx/icon128.png',
  'builds/crx/icon16.png',
  'builds/crx/icon48.png',
  'builds/crx/manifest.json',
  'builds/crx/manifestV2.json',
  'builds/crx/script.js',
];
const allRestoreTargets = [...defaultRestoreTargets, 'version.json'];
const deleteTargets = [`builds/${buildBaseName}.min.user.js.map`];

const lsTree = spawnSync(
  'git',
  ['ls-tree', '-r', 'HEAD', '--name-only', '--', 'builds', 'version.json'],
  { cwd: rootDir, encoding: 'utf8' },
);
if (lsTree.status !== 0) {
  process.stderr.write(lsTree.stderr ?? '');
  process.exit(lsTree.status ?? 1);
}
const trackedInHead = new Set(lsTree.stdout.split('\n').filter(Boolean));

const restoreTargets = (removeAll ? allRestoreTargets : defaultRestoreTargets)
  .filter(target => trackedInHead.has(target));

const restore = spawnSync(
  'git',
  ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...restoreTargets],
  { cwd: rootDir, stdio: 'inherit' },
);

if (restore.status !== 0) {
  process.exit(restore.status ?? 1);
}

const remove = spawnSync(
  'rm',
  ['-f', '--', ...deleteTargets],
  { cwd: rootDir, stdio: 'inherit' },
);

if (remove.status !== 0) {
  process.exit(remove.status ?? 1);
}

console.log(`Restored build output from HEAD: ${restoreTargets.join(', ')}`);
console.log(`Removed generated files: ${deleteTargets.join(', ')}`);
