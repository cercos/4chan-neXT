// this file is needed in the build script, keep it .js

import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function generateMetadata(packageJson, fileName, metaFileName) {
  const meta = packageJson.meta;

  const versionFile = await readFile(resolve(__dirname, '../../version.json'));
  const version = JSON.parse(versionFile.toString());

  const icon = await readFile(resolve(__dirname, './icon48.png'));

  const archives = JSON.parse(await readFile(resolve(__dirname, '../Archive/archives.json'), { encoding: 'utf-8' }));

  let output = `// ==UserScript==
// @name         ${meta.name}
// @version      ${version.version}
// @minGMVer     ${meta.min.greasemonkey}
// @minFFVer     ${meta.min.firefox}
// @namespace    ${packageJson.name}
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

  // @updateURL    ${meta.downloads}/latest/download/${metaFileName}
  output += `
// @run-at       document-start
// @updateURL    none
// @downloadURL  ${meta.downloads}/latest/download/${fileName}
// @icon         data:image/png;base64,${icon.toString('base64')}
// @license      MIT
// ==/UserScript==
`;

  return output;
}
