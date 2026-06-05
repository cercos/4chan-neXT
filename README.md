# 4chan-neXT

4chan-neXT is an actively maintained 4chan X fork with compatibility fixes, UI improvements, and fork-specific features.

## Install

- **Stable userscript (recommended):**
  - https://github.com/cercos/4chan-next/releases/latest/download/4chan-neXT.user.js
- **Minified userscript:**
  - https://github.com/cercos/4chan-next/releases/latest/download/4chan-neXT.min.user.js
- **Releases page:**
  - https://github.com/cercos/4chan-next/releases

You will need a userscript manager:
- Firefox: [Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) or [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- Chrome/Edge: [Violentmonkey](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) or [Tampermonkey](https://tampermonkey.net/)

## Latest Version

`1.0.7` (2026-06-05)

- Added Thread Watcher attach/detach support for docking it to the Quick Reply.
- Added a Quick Reply header preview toggle icon.
- Grouped and cleaned up Thread Watcher settings in the settings dropdown.
- Fixed updatge button in script managers by adding userscript download/update metadata.
- Fixed QR captcha wait messages with sign-in links and long text wrapping.
- Fixed a LibreWolf/Violentmonkey sync error when storage change events provide empty board data, which could also disrupt settings updates such as Custom CSS.
- Small Quick Reply, Thread Watcher, and settings fixes.

## Migration from 4chan X / 4chan XT

4chan-neXT uses its own userscript namespace.

To migrate settings:
1. Export settings from your current script.
2. Install 4chan-neXT.
3. Import your settings into 4chan-neXT.

## Compatible Styling Scripts

- StyleChan: https://github.com/3nly/StyleChan

## Fork Additions

Recent fork additions include:
- Built-in site theme styles and StyleChan compatibility.
- IDE-style "over scrollbar" marker mode (single or 3 columns), plus per-subject highlight colors for catalog Own / Watched threads.
- Quick Reply docking controls for the Thread Watcher and a compact preview toggle.
- Configurable thread updater sounds with per-board overrides, cross-tab single-beep, and a volume slider.
- YouTube → yewtu.be and X → xcancel link rewriting.
- Scrollbar hover thumbnail preview and Thread Watcher thumbnails.
- Comment previewing in replies.
- Download-all media support.
- Reorganized Settings dialog: faster initial load, hover-tooltip descriptions, search-friendly layout.

## Build from Source

```bash
npm install
npm run build
```

Useful build flags:
- `-min`: minified output.
- `-platform=userscript` or `-platform=crx`: build only one target.
- `-no-format`: skip output formatting steps.
- `-test`: include tests in build.
- `npm run build:crxp`: build and pack CRX using a key from `../4chan-next.keys/*.pem` (override with `CRX_KEY_FILE`).

## Links

- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Issues: https://github.com/cercos/4chan-next/issues
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Upstream FAQ: https://github.com/ccd0/4chan-x/wiki/Frequently-Asked-Questions
- This fork FAQ: https://github.com/cercos/4chan-next/wiki/Frequently-Asked-Questions
