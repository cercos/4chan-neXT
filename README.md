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

`1.1.2` (2026-06-11)

- Index/catalog search now also matches the preview replies shown under each thread, not just the OP, so a thread no longer vanishes when your term appears only in a reply.
- Added an `op:` search prefix that restricts index/catalog search to OP text only (e.g. `op:catfish`); works glued or spaced, and `op:op:` searches OP text for the literal `op:`.
- Fixed index/catalog search misreading a pasted URL like `https://...` as a regex query, which matched every thread while highlighting nothing; `field:/regex/` queries are now only recognized for real filter fields.
- Fixed expanding a thread in the index not highlighting search matches in the newly loaded replies.
- Stopped the index search field from saving every keystroke to the browser's autocomplete history.
- Fixed inlined quotes (clicking a quote link) rendering under the post's floated image instead of beside it; the inline box now establishes a block formatting context (`display: flow-root`).
- Fixed Quick Reply personas not applying; `always` persona defaults (name/options/subject) again pre-fill the Quick Reply fields while the browser-autofill hardening stays in place.
- Improved Quick Reply comment preview performance (notably on Firefox): removed a duplicate per-keystroke render path and stopped the expensive width measurement from running on every mouse move while dragging the QR or the floating preview, so typing and toggling the preview are no longer laggy.
- Added an "Allow Browser Autofill" Quick Reply setting (off by default) that lets the browser and password managers autofill/suggest the Name, Options, and Subject fields for users who prefer it.
- Reworked QR Drafts to save drafts per-thread instead of per-board, so reopening a thread restores that thread's own draft; the setting was renamed from "Remember QR State" to "QR Drafts" (existing value carried over) and the ~100 MB attachment cap is now per-thread.
- Added a drafts discard bin: when a thread 404s/archives, or you discard manually, the unsent draft is moved to a recoverable bin instead of being lost, with a toast offering a one-click "Keep it" to pin it past the 24-hour auto-purge.
- Renamed the QR "remove file first" option to "Dump List Remove File First" (value migrated from the old setting keys).
- Added per-context "Comment Preview Thread Behavior" and "Comment Preview Catalog/Index Behavior" settings.
- Added a "Toggle comment preview" keybind (default Alt+V).
- Added a "Highlight brackets" toggle (off by default) to the Custom CSS editor that highlights the matching bracket.
- Shortened and clarified the wording of various settings descriptions.


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
- **Quick Reply and posting:** per-thread `QR Drafts` restore with attachment persistence and a recoverable discard bin, native board-index form hiding, upload progress, dump-list file-first removal, image auto-processing, audio stripping for boards that disallow audio, stacked TCaptcha editing, autofill-resistant Name/Options/Subject fields with an opt-in browser autofill setting, Auto-close Tags, and post-style comment preview with docked, QR-attached, and floating modes.
- **Thread Watcher and monitoring:** Quick Reply docking, attach location controls, QR/window resize handling, remembered floating QR reopen behavior, manual max size controls, OP thumbnails, hover thumbnail previews, mark-all-read and per-thread mark-read icons, detailed thread stats, and replies-to-you state support for watcher links.
- **Styling and themes:** built-in site themes, SFW/NSFW styling variants, StyleChan section handoff, home-page StyleChan mirroring, theme-aware highlight colors, text color modes, edge/background highlight modes, edge and border styles, catalog own/watched highlights, saved palettes, Custom CSS editor pairing/indent helpers, and a local styling guide.
- **Scrollbar markers:** own-post, quotes-you, ghost-post, and unread-line markers with per-marker colors, opacity, match-highlight controls, plus beside-scrollbar and IDE-style over-scrollbar layouts.
- **Filters:** responsive Simple Filters, auto-save, color swatches plus custom CSS classes, combined Simple/Advanced preview, index/catalog search over preview replies with an `op:` prefix, hidden-thread grouping, showing hidden threads with unread replies to you, `highlight:` class lists, and catalog `tile` highlight glow.
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
