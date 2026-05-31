#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const versionPath = resolve(rootDir, 'version.json');
const requestedVersion = process.argv[2]?.trim();

if (requestedVersion) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(requestedVersion)) {
    console.error(`Invalid version format: ${requestedVersion}`);
    process.exit(1);
  }

  const versionInfo = JSON.parse(await readFile(versionPath, 'utf8'));
  if (versionInfo.version !== requestedVersion) {
    versionInfo.version = requestedVersion;
    await writeFile(versionPath, `${JSON.stringify(versionInfo, null, 2)}\n`);
    console.log(`Bumped version.json to ${requestedVersion}`);
  } else {
    console.log(`version.json already at ${requestedVersion}`);
  }
}

for (const script of ['build:userscript:min', 'build:userscript', 'build:crxp']) {
  const run = spawnSync('npm', ['run', script], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}
