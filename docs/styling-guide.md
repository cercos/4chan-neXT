# 4chan-neXT Styling Guide

This guide covers Custom CSS, userstyles, and theme-aware highlight overrides
for 4chan-neXT. It is written for users who want small CSS tweaks without
editing the source.

For the complete selector and variable reference, see
[styling-hooks.md](./styling-hooks.md).

## Where Custom CSS Runs

Custom CSS is configured in Settings -> Styling -> Custom CSS.

When enabled, it loads after 4chan-neXT's built-in CSS. That means it can
override neXT feature styling, but the safest changes are still scoped and
variable-based.

The Custom CSS editor is more than a plain textarea:

- Syntax themes are available from the editor toolbar (`System`, `Light`,
  `Dark`, and `Solarized`).
- `Expand editor` increases the editor height for larger userstyles.
- `{`, `(`, `[`, `"`, and `'` auto-close; typing the closer again skips over
  the existing character.
- Selecting text and typing an opening pair wraps the selection.
- Backspace inside an empty pair removes both halves.
- `Tab` indents with two spaces; `Shift+Tab` dedents. Multi-line selections are
  indented or dedented line-by-line.
- Enter preserves indentation, and `{|}` expands into a brace block.
- `Ctrl+/` comments and uncomments the selection; multi-line selections are
  wrapped in a single block comment, and comments nested inside it survive the
  round-trip.
- Class-name autocomplete suggests classes that exist on the page as you type,
  with a toolbar toggle to turn it off.
- Each line containing a color (hex, `rgb`/`rgba`, `hsl`/`hsla`) shows a
  clickable swatch in the left gutter; clicking it opens the native color picker
  and writes the result back in the line's original format, preserving any alpha.
- `Detach` pops the whole Custom CSS section into a floating, draggable,
  resizable window for editing with more room.
- The editor flashes a `Saved` confirmation when it autosaves, and `Ctrl+S`
  forces an immediate save.

Custom CSS is the user escape hatch, but CSS cascade rules still apply:

- A normal `:root { --xt-name: value; }` override beats built-in theme defaults.
- Styling-page color pickers write some `--xt-*` variables as inline root styles.
- `Use theme defaults` also writes Own/Quotes You back to the inline theme
  border highlight value, so those highlights follow the active theme.
- Use `!important` when your Custom CSS should beat a Styling-page color picker,
  StyleChan, or another stronger userstyle rule.

Use Custom CSS for:

- Small layout fixes.
- Theme-specific color tweaks.
- Highlight, watcher, marker, or catalog styling.
- Compatibility fixes when StyleChan or another userstyle wins the cascade.

Prefer CSS variables when neXT exposes one. Use full selectors only when you
need to change layout, spacing, borders, or a state that has no variable.

## Theme Classes

The active built-in theme is exposed as a class on `:root`.

Common theme classes:

| Class | Theme |
|---|---|
| `:root.yotsuba` | Yotsuba |
| `:root.yotsuba-b` | Yotsuba B |
| `:root.tomorrow` | Tomorrow |
| `:root.spooky` | Spooky |
| `:root.photon` | Photon |
| `:root.futaba` | Futaba |
| `:root.burichan` | Burichan |

Use those classes when a tweak should apply only to one theme:

```css
:root.tomorrow {
  --xt-highlight-you: rgba(145, 182, 214, .9);
}
```

## Highlight Variables

The Styling page uses CSS variables internally. Setting a variable is usually
cleaner than writing a full post selector.

Useful highlight variables:

| Variable | Controls |
|---|---|
| `--xt-border-highlight` | Theme default highlight color |
| `--xt-highlight-you` | Posts quoting you |
| `--xt-highlight-own` | Your own posts |
| `--xt-highlight-ghost` | Restored or archived ghost posts |
| `--xt-highlight-edge-width` | Default thread highlight edge width |
| `--xt-edge-width-you` | Quotes-you edge width |
| `--xt-edge-width-own` | Own-post edge width |
| `--xt-edge-width-ghost` | Ghost-post edge width |
| `--xt-filter-highlight` | Filter highlight edge |
| `--xt-qphl` | Quote-preview or jump highlight |

`--xt-highlight-you` and `--xt-highlight-own` fall back to
`--xt-border-highlight`, so changing the master variable keeps the vanilla
theme relationship:

```css
:root {
  --xt-border-highlight: rgba(221, 0, 0, .8);
}
```

To change only quotes-you highlights:

```css
:root {
  --xt-highlight-you: #b58900;
}
```

If the Quotes you color was changed in the Styling UI, or restored with
`Use theme defaults`, force the Custom CSS value with `!important`:

```css
:root {
  --xt-highlight-you: #000000 !important;
}
```

To make the classic left edge thicker:

```css
:root {
  --xt-highlight-edge-width: 5px;
}
```

## Catalog Highlights

Catalog highlight variables mirror the thread highlight variables.

| Variable | Controls |
|---|---|
| `--xt-catalog-own-highlight` | Catalog tiles containing your posts |
| `--xt-catalog-watched-highlight` | Watched catalog threads |
| `--xt-catalog-border-width` | Default catalog border width |
| `--xt-catalog-border-width-own` | Own-post catalog border width |
| `--xt-catalog-border-width-watched` | Watched catalog border width |

Example:

```css
:root {
  --xt-catalog-watched-highlight: rgba(64, 192, 255, .75);
  --xt-catalog-border-width-watched: 4px;
}
```

## Post State Classes

Use these classes when you need selector-level control.

| Class | Meaning |
|---|---|
| `.quotesYou` | Post quotes one of your posts |
| `.yourPost` | Post is yours |
| `.from-archive` | Post was restored from an archive |
| `.filter-highlight` | Post matched a highlight filter |
| `.highlight` | Post ID highlighter state |
| `.qphl` | Quote-preview or scroll flash state |

Example selector override:

```css
.quotesYou.reply {
  outline: 1px solid var(--xt-highlight-you, var(--xt-border-highlight));
}
```

Named filter highlights work like 4chan X: a filter such as
`highlight:important` adds the class `important`, and you style that class
yourself.

```css
.important.opContainer,
.important > .reply {
  box-shadow: inset 5px 0 gold;
}
```

## Quick Reply Comment Preview

The Quick Reply comment preview uses real post-like markup in both inline and
floating modes. It is intentionally distinct from real posts by default, using a
dashed border and an accent edge.

Useful preview hooks:

| Hook | Meaning |
|---|---|
| `.postContainer.qr-preview-post` | Inline thread preview post container |
| `.qr-preview-float` | Floating preview root |
| `.qr-preview-post > .reply` | Preview reply body |
| `.qr-preview-inline-toggle` | The `preview` header control that docks or undocks the preview |
| `--xt-qr-preview-accent` | Preview accent edge and inner glow color |

Example:

```css
:root {
  --xt-qr-preview-accent: #2aa198;
}
```

```css
.qr-preview-float {
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, .24));
}
```

## Search Highlights

Settings search and thread-index/catalog search use the CSS Custom Highlight
API when the browser supports it. These highlights do not insert DOM nodes; they
paint text ranges through named `::highlight()` pseudo-elements.

Available names:

| Pseudo-element | Used by |
|---|---|
| `::highlight(fourchanx-settings-search)` | Settings search |
| `::highlight(fourchanx-index-search)` | Thread index/catalog search |

Example:

```css
::highlight(fourchanx-settings-search),
::highlight(fourchanx-index-search) {
  background: rgba(255, 180, 0, .35);
  color: inherit;
}
```

Browsers without the API fall back to `<mark>` in Settings, so keep any
legacy fallback styling scoped:

```css
.section-container mark {
  background: rgba(255, 180, 0, .35);
}
```

## Text Color Overrides

For normal theme-level text colors, use the Styling page first.

If you need CSS-level control, these variables are available:

| Variable | Controls |
|---|---|
| `--xt-text-color` | Body text |
| `--xt-link-text-color` | Links |
| `--xt-quote-text-color` | Greentext and quote text |
| `--xt-dead-link-text-color` | Dead quote links |

Per-highlight text variables require the matching text-color mode/root class
to be active from the Styling settings.

Examples:

```css
:root.xt-custom-text-colors {
  --xt-highlight-you-text: #553;
  --xt-highlight-you-link: #06c;
  --xt-highlight-you-quote: #789922;
}
```

```css
:root.xt-catalog-own-text-colors {
  --xt-catalog-own-subject: #b58900;
}
```

## Practical Snippets

Force replies-to-you Thread Watcher links to red:

```css
.replies-quoting-you > a,
#watcher-link.replies-quoting-you {
  color: #f00 !important;
}
```

Use a softer Tomorrow highlight without changing light themes:

```css
:root.tomorrow {
  --xt-highlight-you: rgba(145, 182, 214, .85);
  --xt-highlight-own: rgba(145, 182, 214, .65);
}
```

Restore the classic red left-edge feel everywhere:

```css
:root {
  --xt-border-highlight: rgba(221, 0, 0, .8);
  --xt-highlight-edge-width: 3px;
}
```

## Compatibility Notes

StyleChan and external userstyles may load after neXT or use stronger
selectors. If a Custom CSS rule does not apply:

- Prefer overriding a `--xt-*` variable on `:root`.
- Scope theme-specific changes with `:root.tomorrow`, `:root.yotsuba`, etc.
- Add `!important` to a variable override when the same variable is set by the
  Styling UI, including `Use theme defaults`, because those values are written
  as inline root styles.
- Add a more specific selector before using `!important`.
- Use `!important` only when another stylesheet already forces the same
  property.

When adding new neXT styling hooks in source, prefer a `--xt-*` variable with a
theme-aware fallback instead of hardcoded colors.
