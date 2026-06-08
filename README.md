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

`1.1.0` (2026-06-08)

- Completed the TypeScript migration using decaffeinate, custom codemods, `@rollup/plugin-typescript`, and custom Rollup transformers.
- Added back legacy 4chan XT settings.
- Fixed Shift+Space triggering captcha.
- Post on captcha completion now works with new captcha.
- Added the ability to edit captcha answers in stacked captcha.
- Changed settings descriptions to always show, with a toggle for tooltip descriptions.
- Tweaked the Styling settings page layout.
- Fixed Quick Reply comment preview quote text coloring.
- Fixed Quick Reply comment preview links, cross-board quote links, programmatic quote insertion refreshes, and `[math]` / `[eqn]` preview rendering.
- Added `Remember QR State`, a per-board Quick Reply draft system that restores all queued posts and attachments after refreshes, closes, and crashes.
- Added an option to hide the native board-index post form by default; the existing Original Form toggle can still show it.
- Fixed the `/pol/` Quick Reply flag selector to use the existing board flag CSS instead of duplicating sprite offsets.
- Added a Settings Window navigation layout option for switching between the vertical sidebar and horizontal titlebar navigation.
- Added local styling hooks, styling guide, and user guide documentation, with README and Settings links.
- Made the colored left edge the default highlight style; the per-row "Edge only" / "Border only" checkboxes are now a single "Highlight background" opt-in.
- Turning on "Highlight background" now hides the edge, so lowering opacity no longer shows the edge bleeding through the fill.
- Simple Filters now highlight with a color swatch and/or a custom CSS class instead of a plain class text field; the `highlight:` filter option now accepts a comma-separated list of classes.
- Set a minimum size on the Settings window so the Simple Filters table no longer breaks when the window is shrunk.
- Shortened the Quick Reply titlebar label to "QR" and tightened titlebar icon spacing.


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
- **Quick Reply and posting:** per-board `Remember QR State` draft restore with attachment persistence, native board-index form hiding, upload progress, thumbnail remove-file-first behavior, image auto-processing, audio stripping for boards that disallow audio, stacked TCaptcha editing, and comment preview with a titlebar toggle.
- **Thread Watcher and monitoring:** Quick Reply docking, attach location controls, manual max size controls, OP thumbnails, hover thumbnail previews, mark-all-read and per-thread mark-read icons, detailed thread stats, and replies-to-you state support for watcher links.
- **Styling and themes:** built-in site themes, SFW/NSFW styling variants, StyleChan section handoff, home-page StyleChan mirroring, theme-aware highlight colors, text color modes, edge/background highlight modes, edge and border styles, catalog own/watched highlights, saved palettes, and a local styling guide.
- **Scrollbar markers:** own-post, quotes-you, ghost-post, and unread-line markers with per-marker colors, opacity, match-highlight controls, plus beside-scrollbar and IDE-style over-scrollbar layouts.
- **Filters:** responsive Simple Filters, auto-save, color swatches plus custom CSS classes, combined Simple/Advanced preview, hidden-thread grouping, showing hidden threads with unread replies to you, `highlight:` class lists, and catalog `tile` highlight glow.
- **Gallery and media:** grid gallery thumbnails, configurable gallery columns and thumbnail dock position, ZIP-based download-all-media support, persistent download dialog behavior, thumbnail replacement controls, and metadata visibility controls.
- **Linkification:** YouTube -> yewtu.be and X/Twitter -> xcancel link rewriting.
- **Settings and UI:** faster Settings loading, visible or tooltip descriptions, vertical or horizontal Settings navigation, search-friendly layout, relative post dates, relative-date title mode, and local user/styling docs.

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
