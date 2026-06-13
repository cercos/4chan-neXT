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

`1.1.4` (2026-06-12)

- Added a keybind for the hide modifier, so the default Shift+click to hide can be reassigned to whatever modifier(s) you want.
- Added an "Undo last hide/filter" keybind (default Ctrl+Z) to undo recent thread hides and MD5 filters.
- Added Ctrl+/ to comment and uncomment the selection in the Custom CSS editor; multi-line selections are wrapped in a single comment, and comments nested inside it survive the round-trip.
- Added live class-name autocomplete in the Custom CSS editor, suggesting classes that exist on the page, with a toggle to turn it off.
- Added clickable color swatches in the Custom CSS editor's left gutter for each line with a color (hex, rgb/rgba, hsl/hsla); clicking one opens the native color picker and writes the result back in the line's original format, preserving any alpha.
- Added a "Detach" button to the Custom CSS editor that pops the whole section out into a floating, draggable, resizable window so you can edit with more room.
- Custom CSS now flashes a "Saved" confirmation when it autosaves, and Ctrl+S in the editor forces a save.
- The scrollbar now follows the active theme.
- Updated the script-manager icons.
- Fixed Quick Reply autofill (again): with "Allow Browser Autofill" on, the Name/Options/Subject fields use their original field names so browsers and password managers actually recognize them; with it off, the fields no longer lock up while typing. The toggle now also applies to an open Quick Reply immediately.


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
- Native board-index form hiding
- Upload progress and dump-list file-first removal
- Image auto-processing and audio stripping for boards that disallow audio
- Stacked TCaptcha editing
- Autofill-resistant Name/Options/Subject fields, with an opt-in browser autofill setting
- Auto-close Tags
- Post-style comment preview with docked, QR-attached, and floating modes

### Thread Watcher and monitoring
- Quick Reply docking and attach-location controls
- QR/window resize handling and remembered floating QR reopen behavior
- Manual max-size controls
- OP thumbnails and hover thumbnail previews
- Mark-all-read and per-thread mark-read icons
- Detailed thread stats
- Replies-to-you state support for watcher links

### Styling and themes
- Built-in site themes with SFW/NSFW styling variants
- StyleChan section handoff and home-page StyleChan mirroring
- Theme-aware highlight colors and text color modes
- Edge/background highlight modes, plus edge and border styles
- Catalog own/watched highlights and saved palettes
- Custom CSS editor pairing/indent helpers
- A local styling guide

### Scrollbar markers
- Own-post, quotes-you, ghost-post, and unread-line markers
- Per-marker colors, opacity, and match-highlight controls
- Beside-scrollbar and IDE-style over-scrollbar layouts

### Filters
- Responsive Simple Filters with auto-save
- Color swatches plus custom CSS classes
- Combined Simple/Advanced preview
- Index/catalog search over preview replies with an `op:` prefix
- Hidden-thread grouping, and showing hidden threads with unread replies to you
- `highlight:` class lists and catalog `tile` highlight glow

### Gallery and media
- Grid gallery thumbnails with configurable columns and thumbnail dock position
- ZIP-based download-all-media support
- Persistent download dialog behavior
- Thumbnail replacement and metadata visibility controls

### Linkification
- YouTube -> yewtu.be link rewriting
- X/Twitter -> xcancel link rewriting

### Settings and UI
- Faster Settings loading
- Visible or tooltip descriptions
- Highlight neXT markers for fork-specific settings
- Vertical or horizontal Settings navigation
- CSS Custom Highlight API search highlighting and a search-friendly layout
- Relative post dates and relative-date title mode
- Settings overlay stacking fixes
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
