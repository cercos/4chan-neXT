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

`1.1.1` (2026-06-09)

- Added a "Highlight neXT" settings toggle that marks settings added or changed compared to upstream 4chan-X.
- Hardened Quick Reply Name, Options, and Subject fields against browser autofill/autocomplete and stopped restoring saved values into those fields.
- Removed the Quick Reply media metadata stripping settings.
- Changed the Quick Reply comment preview visual style to match an actual thread post, with docked, QR-attached, and floating view modes.
- Added Quick Reply comment preview settings for default mode, attach location, inline behavior, remembering floating position, and showing the QR titlebar toggle.
- Added Quick Reply docking alignment, QR/window resize handling, Settings overlay stacking, and QR reopen behavior for remembered floating positions.
- Moved the Quick Reply saved-draft trash button next to the close button when the thread selector is hidden.
- Fixed console spam from JSON.parse on non-2xx CrossOrigin responses.
- Added CSS Custom Highlight API search highlighting for thread index and settings search.
- Added IDE-style editing to the Custom CSS editor: auto-closing brackets/quotes, skip-over and empty-pair deletion, selection wrapping, Tab/Shift+Tab indent and dedent, and brace-aware auto-indent on Enter.
- Added an "Auto-close Tags" option that closes supported board tags (`[code]`, `[spoiler]`, `[math]`/`[eqn]`, `[sjis]`, etc.) in the Quick Reply comment box.


## Migration from 4chan X / 4chan XT

4chan-neXT uses its own userscript namespace.

To migrate settings:
1. Export settings from your current script.
2. Install 4chan-neXT.
3. Import your settings into 4chan-neXT.

## Compatible Styling Scripts

- StyleChan: https://github.com/3nly/StyleChan
- Styling guide (Custom CSS, userstyles, and theme-aware highlight overrides): [docs/styling-guide.md](./docs/styling-guide.md)
- Styling hooks (highlight classes and `--xt-*` CSS variables for custom CSS / userstyles): [docs/styling-hooks.md](./docs/styling-hooks.md)

## Fork Additions

Recent fork additions include:
- **Quick Reply and posting:** per-board `Remember QR State` draft restore with attachment persistence, native board-index form hiding, upload progress, thumbnail remove-file-first behavior, image auto-processing, audio stripping for boards that disallow audio, stacked TCaptcha editing, autofill-resistant Name/Options/Subject fields, Auto-close Tags, and post-style comment preview with docked, QR-attached, and floating modes.
- **Thread Watcher and monitoring:** Quick Reply docking, attach location controls, QR/window resize handling, remembered floating QR reopen behavior, manual max size controls, OP thumbnails, hover thumbnail previews, mark-all-read and per-thread mark-read icons, detailed thread stats, and replies-to-you state support for watcher links.
- **Styling and themes:** built-in site themes, SFW/NSFW styling variants, StyleChan section handoff, home-page StyleChan mirroring, theme-aware highlight colors, text color modes, edge/background highlight modes, edge and border styles, catalog own/watched highlights, saved palettes, Custom CSS editor pairing/indent helpers, and a local styling guide.
- **Scrollbar markers:** own-post, quotes-you, ghost-post, and unread-line markers with per-marker colors, opacity, match-highlight controls, plus beside-scrollbar and IDE-style over-scrollbar layouts.
- **Filters:** responsive Simple Filters, auto-save, color swatches plus custom CSS classes, combined Simple/Advanced preview, hidden-thread grouping, showing hidden threads with unread replies to you, `highlight:` class lists, and catalog `tile` highlight glow.
- **Gallery and media:** grid gallery thumbnails, configurable gallery columns and thumbnail dock position, ZIP-based download-all-media support, persistent download dialog behavior, thumbnail replacement controls, and metadata visibility controls.
- **Linkification:** YouTube -> yewtu.be and X/Twitter -> xcancel link rewriting.
- **Settings and UI:** faster Settings loading, visible or tooltip descriptions, Highlight neXT markers for fork-specific settings, vertical or horizontal Settings navigation, CSS Custom Highlight API search highlighting, search-friendly layout, relative post dates, relative-date title mode, Settings overlay stacking fixes, and local user/styling docs.

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

- User Guide: [docs/user-guide.md](./docs/user-guide.md)
- Styling Guide: [docs/styling-guide.md](./docs/styling-guide.md)
- Styling Hooks: [docs/styling-hooks.md](./docs/styling-hooks.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Issues: https://github.com/cercos/4chan-next/issues
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Upstream FAQ: https://github.com/ccd0/4chan-x/wiki/Frequently-Asked-Questions
- This fork FAQ: https://github.com/cercos/4chan-next/wiki/Frequently-Asked-Questions
