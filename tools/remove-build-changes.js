#!/usr/bin/env node
import { spawnSync } from 'child_process';

const args = new Set(process.argv.slice(2));
const removeAll = args.has('--all');

const defaultTargets = ['builds/4chan-neXT.user.js'];
const allTargets = [
  'builds/4chan-neXT.user.js',
  'builds/4chan-neXT.meta.js',
  'builds/4chan-neXT.min.user.js',
  'builds/4chan-neXT.min.meta.js',
  'builds/crx/script.js',
];
const targets = removeAll ? allTargets : defaultTargets;

const run = spawnSync(
  'git',
  ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...targets],
  { stdio: 'inherit' },
);

if (run.status !== 0) {
  process.exit(run.status ?? 1);
}

console.log(
  `Restored build output from HEAD: ${targets.join(', ')}${removeAll ? '' : ' (use --all for all build artifacts)'}`,
);
