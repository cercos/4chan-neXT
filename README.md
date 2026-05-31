# 4chan-neXT

4chan-neXT is an actively maintained userscript fork of 4chan X for anonymous imageboards.
It continues the 4chan XT codebase with ongoing fixes and updates.

## Migration from 4chan X

4chan-neXT uses a different user script namespace than 4chan X.
To migrate your settings, export them from 4chan X and then import them in 4chan-neXT.

## Latest Release

- `1.0.3` (2026-05-31):
  - Fixed QR dump list.
  - Fixed QR action button behavior.
  - Fixed Tegaki buttons.

<details>
<summary>Original README</summary>

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

</details>
