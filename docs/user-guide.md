# 4chan-neXT User Guide

This guide covers the fork-specific features and the settings that most often affect daily use. It is written for users migrating from 4chan X / 4chan XT or enabling StyleChan alongside 4chan-neXT.

## Getting Started

4chan-neXT uses its own userscript namespace, so it can be installed next to older 4chan X forks. To migrate settings, export settings from the old script, install 4chan-neXT, then import them into 4chan-neXT.

After installing, start with the sections that match what you use most: Thread Watcher, Your Posts And Quotes, Highlight Colors, and Styling And Themes. Those sections include the dependency settings that are easy to miss.

If you use StyleChan, read Styling And Themes before tuning colors. 4chan-neXT detects StyleChan and lets StyleChan own page theme rules while still keeping 4chan-neXT feature styling available.

## Fork Additions At A Glance

A settings-level comparison against 4chan XT shows these main 4chan-neXT additions:

- **Quick Reply and posting:** `QR Drafts` restore with attachment persistence, native board-index form hiding, upload progress, dump-list file-first removal, image auto-processing, board-aware video audio stripping, stacked TCaptcha answer editing, autofill-resistant QR identity fields, auto-closing board tags, and post-styled comment preview modes.
- **Thread Watcher and monitoring:** Quick Reply docking, attach location controls, manual max size controls, OP thumbnails, hover thumbnail previews, mark-all-read and per-thread mark-read icons, detailed thread stats, and replies-to-you watcher link state.
- **Styling and themes:** built-in themes, SFW/NSFW styling variants, StyleChan section ownership, home-page StyleChan mirroring, highlight color controls, text color modes, edge/background modes, edge and border styles, catalog own/watched highlights, saved palettes, and local styling docs.
- **Scrollbar markers:** own-post, quotes-you, ghost-post, and unread-line markers with per-marker colors, opacity, match-highlight controls, plus beside-scrollbar and IDE-style over-scrollbar layouts.
- **Filters:** responsive Simple Filters, auto-save, color swatches plus custom CSS classes, combined preview, hidden-thread grouping, showing hidden threads with unread replies to you, `highlight:` class lists, and catalog `tile` highlight glow.
- **Gallery and media:** grid gallery thumbnails, configurable columns and thumbnail dock position, ZIP-based download-all-media support, persistent download dialog behavior, thumbnail replacement controls, and metadata visibility controls.
- **Linkification and UI:** YouTube -> yewtu.be rewriting, X/Twitter -> xcancel rewriting, visible or tooltip setting descriptions, vertical or horizontal Settings navigation, `Highlight neXT` settings comparison markers, CSS Custom Highlight API search highlighting, relative post dates, and relative-date title mode.

## Settings Window

The Settings window opens to General by default and keeps section descriptions visible unless you switch them back to tooltips.

Important settings:

- Settings -> Interface -> `Settings Descriptions as Tooltips`: switches setting descriptions from inline text to browser tooltips.
- Settings -> Interface -> `Navigation menu`: chooses `Vertical` sidebar navigation or `Horizontal` titlebar navigation.
- Settings footer -> `Highlight neXT`: highlights settings that 4chan-neXT added or changed compared to upstream 4chan X. Added settings are marked green; changed defaults are marked amber.

The horizontal navigation layout puts the search box and section links in the titlebar. It is useful on wide windows, but the vertical layout remains the default.

Settings search paints matched text with the browser CSS Custom Highlight API when available. This avoids injecting temporary `<mark>` elements into settings rows; older browsers fall back to the legacy `<mark>` highlight.

## Thread Watcher

The Thread Watcher bookmarks threads and can track unread replies, quotes of you, page number, dead threads, and thumbnails.

Open it from the header eye icon. Each watched thread has a remove button and a thread link. Depending on options, rows can also show page number, unread count, OP thumbnail, and per-thread mark-read controls.

Important settings:

- Settings -> Monitoring -> `Thread Watcher`: enables the feature.
- Settings -> Monitoring -> `Fixed Thread Watcher`: makes the watcher scroll with the page.
- Settings -> Monitoring -> `Persistent Thread Watcher`: shows the watcher on page load.
- Settings -> Threads & Posts -> Monitoring -> `Attachment Controls`: shows the Thread Watcher titlebar attach button and Attach Location menu for Quick Reply.
- Thread Watcher titlebar -> attach button: docks or undocks the watcher to Quick Reply.
- Thread Watcher menu -> `Auto Update Thread Watcher`: periodically checks watched threads.
- Thread Watcher menu -> `Auto Watch`: automatically watches threads you create.
- Thread Watcher menu -> `Auto Watch Reply`: automatically watches threads you reply to.
- Thread Watcher menu -> `Auto Prune`: removes dead threads automatically.
- Thread Watcher menu -> `Display` -> `Show Page`: shows the current page number.
- Thread Watcher menu -> `Display` -> `Show Unread Count`: shows unread counts and enables unread/quote state classes.
- Thread Watcher menu -> `Display` -> `Show Mark All Read Icon`: shows the header mark-read button.
- Thread Watcher menu -> `Display` -> `Show Mark Thread Read Icons`: shows mark-read icons per watched thread.
- Thread Watcher menu -> thumbnail controls: show OP thumbnails and hover previews.

### Red Links For Replies To You

A watched thread turns red when 4chan-neXT sees a new unread post that quotes one of your remembered posts. This depends on multiple features working together.

Required settings:

- Settings -> Monitoring -> `Remember Last Read Post`
- Thread Watcher menu -> `Display` -> `Show Unread Count`
- Settings -> Quote Links -> `Remember Your Posts`

Useful related settings:

- Settings -> Quote Links -> `Mark Quotes of You`: adds `(You)` to quote links pointing to your posts.
- Thread Watcher menu -> `Require OP Quote Link`: when enabled, OP replies only count as replies to you if the new post includes an actual quote link to the OP.

If the watcher shows unread counts but links do not turn red, StyleChan or Custom CSS may be overriding the link color. Use this Custom CSS override if needed:

```css
.replies-quoting-you > a,
#watcher-link.replies-quoting-you {
  color: #f00 !important;
}
```

For a theme-variable override:

```css
:root {
  --xt-watcher-quoting-you: #f00;
}
```

## Your Posts And Quotes

4chan-neXT tracks your posts through the `yourPosts` data store. Features that depend on knowing which posts are yours require `Remember Your Posts`.

Important settings:

- Settings -> Quote Links -> `Remember Your Posts`: remembers your posting history.
- Settings -> Quote Links -> `Mark Quotes of You`: adds `(You)` to quote links pointing to your posts.
- Settings -> Quote Links -> `Highlight Posts Quoting You`: highlights posts that quote your posts.
- Settings -> Quote Links -> `Highlight Own Posts`: highlights posts you made.
- Settings -> Quote Links -> `Highlight Ghost Posts`: highlights deleted posts restored from an archive.

The old 4chan X style of a left-edge highlight is now the **default**, controlled through Highlight Colors. You get it automatically:

- Settings -> Styling -> `Highlight Colors`
- Enable `Thread highlights`.
- Enable `Quotes you`.
- Adjust `Edge width` if needed.

The colored left edge shows by default. Tick `Highlight background` only if you'd rather fill the whole post instead of just the edge. The two modes are mutually exclusive, so turning the background fill on removes the edge. The same pattern works for `Your post` and `Ghost post` highlights.

## Highlight Colors

The Styling tab centralizes visual highlight behavior. Instead of hardcoding the old highlight colors, 4chan-neXT lets you choose per-theme colors, opacity, text colors, and edge/background modes.

Thread highlight controls:

- `Thread highlights`: master toggle for thread post highlights.
- `Edge width`: width of the colored left edge.
- `Your post`: controls posts you made.
- `Quotes you`: controls posts quoting you.
- `Ghost post`: controls deleted/restored posts.
- Color picker: the highlight color (used for both the edge and the fill).
- Hex field: direct `#rrggbb` entry next to editable color pickers.
- `Text colors`: Defaults / Auto / Manual readable text colors.
- `Highlight background`: fills the whole post background instead of the edge. Off by default - the colored left edge (the classic XT look) shows instead. Edge and fill are mutually exclusive.
- `Edge style`: CSS border style for the colored left edge.
- Opacity slider: controls highlight strength.
- `Scrollbar marker`: enables the matching scrollbar marker from the same row.
- `Match highlight color`: makes the row's scrollbar marker follow the row highlight color.

Catalog highlight controls:

- `Catalog highlights`: master toggle for catalog highlights. It is off by default.
- `Border width`: width of the colored catalog border.
- `Your post`: highlights catalog tiles containing your posts.
- `Watched thread`: highlights catalog tiles for watched threads.
- `Text colors`: Defaults / Auto / Manual readable text colors.
- `Highlight background`: fills the whole catalog tile instead of the border. Off by default - a colored border shows instead.
- `Border style`: CSS border style for the colored catalog border.
- Opacity slider: controls highlight strength.

If catalog text becomes hard to read, set `Text colors` to `Auto` first. Manual text/link/quote/dead-link colors are intended for users who want exact control.

Other highlight tools:

- `Use theme defaults`: resets highlight colors and modes to the active theme defaults.
- `Suggest palettes`: shows suggested highlight palettes for the current theme.
- `Randomize`: generates contrast-tested highlight colors.
- `Preview states`: opens a live preview panel for post and catalog highlight states.

## Scrollbar Markers

Scrollbar markers show tracked locations along the right edge of the page. They are useful in long threads.

Important settings:

- Settings -> Monitoring -> `Scrollbar Markers`: enables the feature.
- Settings -> Monitoring -> `Scrollbar Mark Own Posts`: marks your posts.
- Settings -> Monitoring -> `Scrollbar Mark Quotes You`: marks posts quoting you.
- Settings -> Monitoring -> `Scrollbar Mark Ghost Posts`: marks restored deleted posts.
- Settings -> Monitoring -> `Scrollbar Mark Unread Line`: marks the unread line.
- Settings -> Monitoring -> `Scrollbar Marker Position`: chooses beside-scrollbar or over-scrollbar layout.

Marker colors are configured in Settings -> Styling -> `Scrollbar Markers`. The `Match` controls make markers follow the matching highlight color.

## Styling And Themes

4chan-neXT supports built-in theme classes and StyleChan compatibility. The Styling tab has a `Site Style` section with SFW/NSFW variants and a theme selector. Highlight, marker, text-color, and Custom CSS settings can also keep separate SFW and NSFW variants.

Key concepts:

- Built-in themes include styles such as Yotsuba, Yotsuba B, Tomorrow, Photon, Spooky, Futaba, and Burichan.
- StyleChan can provide the active page theme while 4chan-neXT still provides feature CSS for watcher icons, highlights, markers, Quick Reply, and dialogs.
- Disabled Styling sections no longer lose their saved values. Turning a section back on restores its previous controls.
- When StyleChan is detected, each Styling section gets its own enable checkbox so you can decide whether 4chan-neXT or StyleChan owns that section.
- `Apply recommended settings` turns off the sections StyleChan usually owns: Site Style, Text Colors, and Custom CSS.
- `Apply StyleChan's theme on home page` mirrors StyleChan's current theme and Custom CSS onto the 4chan home page, where StyleChan does not run.
- `Apply on home page` applies the selected site style on the 4chan home page.
- Custom CSS loads after 4chan-neXT CSS and can override feature styles.
- The Custom CSS editor has syntax highlighting, theme selection, an expand/collapse control, a Detach button that pops it into a floating window, auto-closing brackets and quotes, skip-over for existing closers, empty-pair deletion, selection wrapping, Tab/Shift+Tab indent and dedent, brace-aware Enter indentation, Ctrl+/ comment toggling, class-name autocomplete, clickable gutter color swatches, and a Saved confirmation with Ctrl+S to force a save.
- The Custom CSS help link points to the local [Styling Guide](./styling-guide.md).

If something looks wrong with StyleChan enabled, check whether the same issue happens with StyleChan disabled. If disabling StyleChan fixes it, the issue is likely CSS order or a stronger selector from the StyleChan theme.

Useful Custom CSS snippets:

```css
/* Force replies-to-you watcher links to red. */
.replies-quoting-you > a,
#watcher-link.replies-quoting-you {
  color: #f00 !important;
}
```

```css
/* Classic left-edge quote highlight color. */
:root {
  --xt-highlight-you: rgba(221, 0, 0, 0.8);
}
```

## Filters

The Filters section now has separate `Simple` and `Advanced` tabs. Simple Filters are a responsive editor for common rules; Advanced Filters expose the raw 4chan X filter syntax plus a live match preview.

Simple Filters:

- `Auto`, `Grid`, and `List` choose the Simple Filters layout. `Auto` switches based on the Settings window width.
- Simple Filter edits auto-save shortly after you stop typing. The old separate Save button is no longer required.
- Each rule has `On`, pattern, boards, type, highlight color, optional CSS class, auto-top, hide, override, and remove controls.
- The color checkbox controls whether the color swatch is applied. If it is off, highlight rules use the theme default color.
- The CSS class field is applied alongside the color, not instead of it.
- `H` hides matching posts or threads. When `H` is off, the rule highlights instead.
- `A` moves highlighted OPs to the top.
- `O` makes a matching highlight override later hide rules.

Advanced Filters:

- `highlight:` accepts a comma-separated class list, for example `highlight:xt-hl-ff0000,my-class`.
- `tile` makes catalog highlight filters glow the whole catalog tile instead of only the thumbnail. Example: `/4chan X/i;highlight;tile`.
- The filter preview combines Simple Filters and the selected Advanced filter type so you can see expected matches before closing Settings.

Hiding threads:

- Shift+click the hide button to hide a thread (the default). The modifier is configurable through a keybind, so you can reassign it to whatever modifier(s) you prefer.
- The `Undo last hide/filter` keybind (default `Ctrl+Z`) undoes recent thread hides and MD5 filters.

## Quick Reply And Posting

Quick Reply is the all-in-one posting form. It includes posting, file handling, captcha behavior, comment preview, and QR layout behavior.

Important settings:

- Settings -> Posting and Captchas -> `Quick Reply`: enables QR.
- `Persistent QR`: keeps QR open after posting.
- `Auto Hide QR`: hides QR after posting.
- `Open Post in New Tab`: opens new threads and cross-thread replies in a new tab.
- `Remember QR Size`: saves QR dimensions.
- `QR Drafts`: auto-saves your Quick Reply per thread, including attachments up to ~100 MB. Dead-thread drafts auto-clear from the discard bin after a day.
- `Dump List Remove File First`: dump-list Remove clears the file before removing the queued post.
- `Show New Thread Option in Threads`: allows starting another thread from a thread page.
- `Hide Original Post Form`: hides the native board-index post form by default. Use `Original Form` or `Start a Thread` to show it.
- `Show Upload Progress`: shows upload progress in the submit button.
- `Auto-load captcha`: loads captcha before the post is ready.
- `Post on Captcha Completion`: submits immediately after captcha completion.
- `Stacked TCaptcha`: changes 4chan's TCaptcha into a stacked grid UI and lets you edit selected answers before submitting. Keyboard controls work whenever focus is on the QR window but outside its text fields (click the QR or a captcha tile first): arrow keys move the tile highlight, Enter picks the highlighted tile, `1`-`9` pick a tile directly, and Backspace steps back into the previous answer. On the review screen, Left/Right move between your answers and Enter opens one for editing; Escape cancels an edit without changing it.
- `Stacked TCaptcha Style`: how the stacked captcha shows your progress and the review screen. "Classic row" is the original layout with large chips on their own row and status text. "Inline chips" (default) docks compact chips next to the Get Captcha button with no status text. "Stepper dots" shrinks progress to small dots beside the counter; hover a filled dot to peek at that step, click it to edit. Keyboard controls are identical in every style. Error messages (Failed, Expired, "Verification not required") always show regardless of style.
- `Auto-process Images`: converts/resizes unsupported or oversized images.
- `Strip Video Audio`: removes audio when the board does not allow audio.
- `Comment Preview`: adds a preview mode for the QR comment box.
- `Comment Preview Default Mode`: starts the preview attached to QR, docked inline in the thread, or in the last mode you used.
- `Comment Preview Attach Location`: chooses where an attached floating preview docks to QR (`Auto`, bottom, top, right, or left). Auto prefers the bottom but avoids the Thread Watcher when it is already attached there.
- `Comment Preview Inline Behavior`: controls the inline dock action. It can scroll to the thread end or insert near the current viewport and follow your scroll.
- `Comment Preview Remember Float Position`: remembers a manually dragged floating preview position across QR closes and reopens.
- `Show Comment Preview Header Icon`: adds the preview toggle to the QR titlebar.
- `Auto-close Tags`: automatically inserts matching closing tags for supported board tags in the QR comment box.

Thread Watcher can be attached to Quick Reply from its titlebar attach button. When attached, dragging either title bar moves both dialogs. Disable `Attachment Controls` if you do not want the attach button or Attach Location menu.

Comment Preview renders quote links, cross-board quote links, programmatic quote insertion refreshes, and `[math]` / `[eqn]` blocks in the preview pane. The preview is styled as an actual post, with a dashed preview border and accent edge so it is visually distinct from real posts.

Preview modes:

- **Attached to QR:** a floating post preview docks to the selected side of the QR and follows QR/window resizing.
- **Docked inline:** the preview is inserted into the thread as a literal preview post. The preview header link toggles it back out.
- **Floating:** dragging the preview detaches it from QR. If float-position remembering is enabled, QR reopens it at that dragged position.
- **Remember last mode:** QR starts the preview in the last attached/inline/floating mode you used.

The Name, Options, and Subject fields deliberately disable browser autofill/autocomplete and are no longer restored from saved values. This avoids stale browser profile data or old QR field values being silently reused.

Auto-close Tags works only for tags supported by the current board. Examples include `[code]`, `[spoiler]`, `[math]` / `[eqn]`, `[sjis]`, and board-specific tags such as `/mu/` and `/qst/` color tags.

### Quick Reply Draft Restore (QR Drafts)

`QR Drafts` (Settings -> Posting and Captchas -> `QR Drafts`) keeps what you have typed in the Quick Reply so it is not lost to a refresh, an accidental close, or a browser crash. It is **off by default**; turn it on if you want drafts to persist.

How it behaves:

- **Per thread.** Each thread keeps its own draft, so reopening a thread restores that thread's draft instead of whatever you typed elsewhere. **All queued posts in the dump list are saved**, not just the first: subject, comment, spoiler state, flag, and the selected thread.
- **Attachments are saved too.** Each post's attached **image or video** is remembered and re-attached on restore, and its thumbnail is regenerated. Files are stored in your browser's IndexedDB, separate from the text. There is a **~100 MB per-thread cap**: if a draft's attachments total more than that, the largest files are skipped and you get a one-time notice. Their posts still come back, just without the file.
- **Auto-saved.** Text changes are written a moment after you stop typing (debounced); attachments are written when you add or remove them. You do not need to do anything to save.
- **Restores into an empty Quick Reply only.** When you return to the board and open the Quick Reply, the draft repopulates **only if you have not already started typing or attached** something. It will never overwrite work you are in the middle of. (A saved reply draft is restored only if its thread is still alive.)
- **Cleared after you post.** A successful post removes that post's saved draft and its stored attachment automatically, so nothing lingers.
- **Discard manually.** The drafts panel can move the current Quick Reply text into the discard bin and clear the open QR.
- **Turning the setting off clears storage.** Disabling `QR Drafts` removes all saved QR drafts and stored draft attachments across boards.

If drafts still do not return after enabling this, make sure the Quick Reply is empty when you reopen it (existing text or a file blocks the restore).

## Gallery And Media

Gallery settings affect image browsing and thumbnail layout.

Important settings:

- Gallery menu -> `Hide Thumbnails`: hides gallery thumbnails.
- `Fit Width`: scales images to viewport width.
- `Fit Height`: scales images to viewport height.
- `Stretch to Fit`: stretches media to fit the viewport.
- `Scroll to Post`: scrolls the page to the post for the current gallery item.
- `Grid Thumbnails`: lays gallery thumbnails out as a grid.
- `Gallery Columns`: controls grid column count. `0` disables the preview strip and uses fullscreen thumbnails.
- `Gallery Thumbnails Position`: docks thumbnails to top, bottom, left, or right.

Download-all media support bundles downloads as a ZIP archive.

## Link Rewriting

4chan-neXT includes optional link rewriting and embedding behavior from the fork additions.

Common examples:

- YouTube links can be rewritten toward `yewtu.be`.
- X/Twitter links can be rewritten toward `xcancel`.
- Sound posts can load audio from `[sound=]` filenames when enabled.

If a rewritten or embedded link behaves unexpectedly, check the Linkification and Embedding settings first, then check Custom CSS or content blockers.

## Troubleshooting

### Watcher Links Do Not Turn Red

Check the dependency list in Thread Watcher -> Red Links For Replies To You.

If the row has `replies-quoting-you` in the DOM but is not red, use the Custom CSS override from the Thread Watcher section.

### Posts Quoting Me Are Not Highlighted

Check Your Posts And Quotes first, then verify Highlight Colors -> Thread highlight controls.

The classic left-edge look is the default - just enable `Quotes you` (leave `Highlight background` off).

### My Own Posts Are Not Highlighted

Check Your Posts And Quotes first, then verify Highlight Colors -> Thread highlight controls.

Posts made before enabling `Remember Your Posts` may not be known unless imported or manually marked through the post menu.

### Catalog Highlight Text Is Hard To Read

Try this order:

- Set `Text colors` to `Auto` for the catalog highlight.
- Reduce highlight opacity.
- Keep `Highlight background` off (the default) so only a border shows if the filled tile conflicts with the theme.
- Set manual text/link/quote colors only if `Auto` is not enough.

### Styling Theme Overrides A 4chan-neXT Feature

StyleChan themes may load CSS after 4chan-neXT or use stronger selectors. Test with StyleChan disabled. If that fixes it, add a targeted Custom CSS override.

### Unread Counts Are Missing

Check Thread Watcher -> Red Links For Replies To You for read-state dependencies. Also verify Thread Watcher menu -> `Auto Update Thread Watcher` is enabled.

Manual refresh from the Thread Watcher header can also update stale counts.
