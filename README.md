# 4chan-neXT

4chan-neXT is an actively maintained userscript fork of 4chan X for anonymous imageboards.
It continues the 4chan XT codebase with ongoing fixes and updates.

## Latest Release

- `1.0.1` (2026-05-30): Fix captcha submission flow when the UI reports "Verification not required."

## Install

- Releases: https://github.com/TuxedoTako/4chan-xt/releases
- Greasy Fork: https://greasyfork.org/scripts/489508-4chan-xt

Use a userscript manager such as Violentmonkey or Tampermonkey.

## Build

```bash
npm install
npm run build
```

Useful build flags:

- `-min`: minified output.
- `-platform=userscript` or `-platform=crx`: build only one target.
- `-no-format`: skip output formatting steps.
- `-test`: include tests in build.
- `npm run build:crxp`: build and pack CRX using a key from `../4chan-xt.keys/*.pem` (override with `CRX_KEY_FILE`).

## Reporting Issues

- Issues: https://github.com/TuxedoTako/4chan-xt/issues?q=is%3Aopen+sort%3Aupdated-desc
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

## Documentation

- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Upstream FAQ: https://github.com/ccd0/4chan-x/wiki/Frequently-Asked-Questions
- This fork FAQ: https://github.com/TuxedoTako/4chan-xt/wiki/Frequently-Asked-Questions
