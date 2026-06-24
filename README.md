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

`1.2.1` (2026-06-23)

- Added a "Video Duration Badge" setting (off by default) that shows a video length badge on webm/mp4 thumbnails. It reads each video's length from its metadata lazily, only as thumbnails scroll into view, so it uses a little extra bandwidth.
- Expanded the Custom CSS editor:
  - Added a line-number gutter.
  - Added a formatting options popover (the gear) to choose the indent (2 spaces, 4 spaces, or tab), a blank line between rules, and one selector per line.
  - Added a collapsible keyboard-shortcuts guide (Ctrl+/ comment, Ctrl+S save, Shift+Alt+F format, Tab/Shift+Tab indent, Enter auto-indent).
- Reorganized the Styling settings into clearer subsections, and added number inputs (with px units) beside the sliders for the catalog highlight border widths.
- Added number inputs beside the Thread Watcher dropdown's thumbnail size and hover-preview scale sliders, so you can type an exact value instead of only dragging.
- Various appearance and styling refinements across the settings pages and UI.


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

### Quick Reply and posting
- Per-thread `QR Drafts` restore with attachment persistence and a recoverable discard bin
- Upload progress and dump-list file-first removal
- Image auto-processing and audio stripping for boards that disallow audio
- Stacked TCaptcha editing
- Auto-close Tags
- Post-style comment preview with docked, QR-attached, and floating modes

### Thread Watcher and monitoring
- Quick Reply docking and attach-location controls
- QR/window resize handling and remembered floating QR reopen behavior
- OP thumbnails and hover thumbnail previews
- Mark-all-read and per-thread mark-read icons

### Styling and themes
- Built-in site themes with SFW/NSFW styling variants
- Styling-script section handoff and home-page mirroring (currently StyleChan)
- Theme-aware highlight colors and text color modes
- Custom CSS editor pairing/indent helpers
- A local styling guide

### Scrollbar markers
- Own-post, quotes-you, ghost-post, and unread-line markers
- Per-marker colors, opacity, and match-highlight controls
- Beside-scrollbar and IDE-style over-scrollbar layouts

### Filters
- Responsive Simple Filters with auto-save
- Color swatches plus custom CSS classes
- Index/catalog search over preview replies with an `op:` prefix and per-field regex (`comment:/cat|dog/i`) that highlights matches in the results
- Hidden-thread grouping, and showing hidden threads with unread replies to you
- `highlight:` class lists and catalog `tile` highlight glow

### Gallery and media
- Grid gallery thumbnails with configurable columns and thumbnail dock position
- ZIP-based download-all-media support
- Thumbnail replacement and metadata visibility controls

### Linkification
- YouTube -> yewtu.be link rewriting
- X/Twitter -> xcancel link rewriting

### Settings and UI
- Highlight neXT markers for fork-specific settings
- Vertical or horizontal Settings navigation
- CSS Custom Highlight API search highlighting and a search-friendly layout
- Local user/styling docs

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
