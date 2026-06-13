// this file is needed in the build script, keep it .js

import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function generateMetadata(packageJson, fileName, metaFileName, options = {}) {
  const meta = packageJson.meta;
  // A `channel` (e.g. "testing") produces a distinct @name + @namespace so the
  // build installs as a separate script alongside the release, with its own
  // isolated GM storage. Its auto-update URLs point at a local server
  // (channelBaseUrl) rather than the published release, so the manager's "Check
  // for updates" reinstalls the local build — never the release. (The manager
  // only pulls when the served @version is higher, so bump version.json to test
  // the update path.)
  const { channel, channelBaseUrl } = options;
  const name = channel ? `${meta.name} (${channel})` : meta.name;
  const namespace = channel ? `${packageJson.name}-${channel}` : packageJson.name;

  const versionFile = await readFile(resolve(__dirname, '../../version.json'));
  const version = JSON.parse(versionFile.toString());

  // Channel builds append a build timestamp (YYYYMMDDHHMMSS) as a 4th version
  // segment so each rebuild outranks the previous one — the manager's "Check for
  // updates" compares it numerically and reinstalls the freshest local build.
  // The release version is left untouched.
  let versionStr = version.version;
  if (channel) {
    const t = new Date();
    const p = n => String(n).padStart(2, '0');
    const stamp = `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`;
    versionStr = `${version.version}.${stamp}`;
  }

  const icon = await readFile(resolve(__dirname, './icon48.png'));

  const archives = JSON.parse(await readFile(resolve(__dirname, '../Archive/archives.json'), { encoding: 'utf-8' }));

  let output = `// ==UserScript==
// @name         ${name}
// @version      ${versionStr}
// @minGMVer     ${meta.min.greasemonkey}
// @minFFVer     ${meta.min.firefox}
// @namespace    ${namespace}
// @description  ${packageJson.description}
// @license      MIT; ${meta.license}
`;

  output += (function () {
    const allMatches = meta.includes_only.concat(meta.matches_only, meta.matches, meta.matches_extra);
    return [].concat(
      meta.includes_only.concat(meta.matches, meta.matches_extra).map(function (match) {
        return '// @include      ' + match;
      }),
      allMatches.map(function (match) {
        return '// @match        ' + match;
      }),
      meta.exclude_matches.map(function (match) {
        return '// @exclude      ' + match;
      })
    ).join('\n');
  })();

  output += `
// @connect      4chan.org
// @connect      4channel.org
// @connect      4cdn.org
// @connect      4chenz.github.io
`;
  output += archives.map(function (archive) {
    return '// @connect      ' + archive.domain;
  }).join('\n');

  output += `
// @connect      api.clyp.it
// @connect      api.dailymotion.com
// @connect      api.github.com
// @connect      soundcloud.com
// @connect      api.streamable.com
// @connect      vimeo.com
// @connect      www.youtube.com
// @connect      *
`;
  output += meta.grants.map(function (grant) {
    return '// @grant        ' + grant;
  }).join('\n');

  output += `
// @run-at       document-start
`;
  if (channel) {
    const base = (channelBaseUrl || 'http://localhost:8123/testbuilds').replace(/\/+$/, '');
    output += `// @updateURL    ${base}/${metaFileName}
// @downloadURL  ${base}/${fileName}
`;
  } else {
    output += `// @updateURL    ${meta.downloads}/latest/download/${metaFileName}
// @downloadURL  ${meta.downloads}/latest/download/${fileName}
`;
  }
  output += `// @icon         data:image/png;base64,${icon.toString('base64')}
// @license      MIT
// ==/UserScript==
`;

  return output;
}
