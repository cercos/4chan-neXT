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

`1.2.0` (2026-06-21)

- Added an "Icon style" setting (Settings > Icons) to pick the icon set used across the script's buttons and UI, with eight sets to choose from: Font Awesome (default), Lucide, Material Icons, Phosphor, Tabler, Bootstrap Icons, Heroicons, and Ionicons. Reload the page to apply the change everywhere.
- Added an Undo button for Mark All Read in the Thread Watcher, enabled via the "Show Undo Button" setting (Display menu, off by default).
- Added a "Then by" secondary sort to the Thread Watcher Sort menu.
- Added a bouncing down-arrow hint at the bottom of the Thread Watcher when the list has entries scrolled out of view.
- Fixed an expanded image not contracting on click when the Quick Reply comment preview was beside it in inline preview mode.
- Fixed thumbnail and hover preview toggle not toggling in thread watcher dropdown menu.
- Made the Quick Reply comment preview cheaper to update, so typing stays smooth with a big thread open.
- Improved load performance on large threads: theme color and styling work that previously ran many times during load is now cached and batched, and the scrollbar markers no longer rebuild on every post as the thread loads.
- Scrollbar markers now ride the native scrollbar instead of a custom JavaScript one, so scrolling stays smooth on long threads. Pick a mode from the Scroll markers header menu: "Beside scrollbar" (Single or Columns) sits the markers next to the native bar with its thumb tinted to the theme, and "Over scrollbar" (Single or Columns) floats them over the bar's lane, fading the native thumb on hover so the markers underneath stay visible. Over modes need overlay (floating) scrollbars and are greyed out otherwise; in Chromium enable the `#overlay-scrollbars` flag (`chrome://flags/#overlay-scrollbars`, also `brave://`, `edge://`, etc.). On Firefox and some browsers the native scrollbar is drawn over the markers, so hovering to preview in the Over modes can be unreliable; use a Beside mode if hovering is essential to you.
- Added a "Show preview" checkbox to the Scroll markers header menu (on by default) to turn off the post preview shown when hovering a scrollbar marker.
- Stopped the index unread line from bordering threads in the catalog; it now only applies to the index, as it did in XT.
- Improved page load on large threads by removing a layout reflow from the scrollbar check.


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
