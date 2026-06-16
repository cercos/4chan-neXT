#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
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

function runNpm(script) {
  const run = spawnSync('npm', ['run', script], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}

// On Windows a bare `bash` resolves to the WSL launcher (C:\Windows\System32\bash.exe),
// which fails when no distro is installed. Locate Git Bash explicitly instead.
function findGitBash() {
  const candidates = [
    process.env.ProgramFiles && resolve(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env['ProgramFiles(x86)'] && resolve(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files (x86)/Git/bin/bash.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Fall back to deriving the Git root from `git --exec-path`.
  const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
  if (execPath.status === 0 && execPath.stdout) {
    const out = execPath.stdout.trim().replace(/\\/g, '/');
    const marker = out.search(/\/(?:mingw64|mingw32|usr)\//);
    if (marker !== -1) {
      const bash = resolve(out.slice(0, marker), 'bin', 'bash.exe');
      if (existsSync(bash)) return bash;
    }
  }
  return null;
}

function packCrx() {
  if (process.platform !== 'win32') {
    // On Linux/macOS the system `bash` is the real shell; the npm script handles it.
    runNpm('build:crxp');
    return;
  }

  runNpm('build:crx');
  const bash = findGitBash();
  if (!bash) {
    console.error('Could not locate Git Bash to run tools/pack-crx.sh.');
    console.error('Install Git for Windows, or pack manually from a Git Bash shell:');
    console.error('  bash ./tools/pack-crx.sh');
    process.exit(1);
  }
  const run = spawnSync(bash, ['./tools/pack-crx.sh'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}

runNpm('build:userscript:min');
runNpm('build:userscript');
packCrx();
