# Styling hooks (highlights & themes)

A reference for restyling neXT's post highlights from **custom CSS**, a
**userstyle** (Stylus/Stylish), or **Stylechan**, without touching the source.

There are two kinds of hook:

- **Classes** - *where* a highlight is. You write the selector
  (`.quotesYou`, `.filter-highlight`, …).
- **CSS variables** (`--xt-*`) - *what color/size* it is. Override the variable
  and every selector that uses it updates at once. This is the easy path.

> **Easiest possible override:** set a variable on `:root`. You almost never
> need to write a full selector.
>
> ```css
> :root { --xt-highlight-you: #b58900; }   /* recolor "(You)" highlights */
> ```
>
> If the same variable was set by the Styling page, including via
> `Use theme defaults`, use `!important`:
>
> ```css
> :root { --xt-highlight-you: #b58900 !important; }
> ```

All highlight colors in neXT are already variable-driven, so a single line is
usually enough. The full selectors below are only needed if you want to change
something other than color (layout, borders, etc.).

---

## 1. Root state classes (added to `<html>`)

These are toggled by neXT settings; you can also force them in a userstyle to
unlock behavior. They gate the rules below.

| Class | Meaning |
|---|---|
| `highlight-you` | "(You)" / quotes-you highlighting is on |
| `highlight-own` | Your-own-post highlighting is on |
| `highlight-ghost` | Archived/ghost-post highlighting is on |
| `xt-custom-text-colors` | Enables per-highlight **text/link/quote** recoloring |
| `xt-set-you-highlight` / `xt-set-own-highlight` / `xt-set-ghost-highlight` | Forces the highlight color with `!important` (beats stubborn site themes) |
| `xt-edge-you` / `xt-edge-own` / `xt-edge-ghost` | Edge mode (**the default**) - draws the left border, **no** background fill. Present unless the row's *Highlight background* toggle is on; edge and fill are mutually exclusive (the edge is only drawn while this class is present, so a lowered-opacity fill never bleeds the edge through) |
| `xt-highlight-catalog-own` / `xt-highlight-catalog-watched` | Catalog-tile highlighting for own/watched threads |
| `xt-catalog-edge-own` / `xt-catalog-edge-watched` | Catalog edge mode (**the default**) - border, no fill. Present unless the tile's *Highlight background* toggle is on |
| `xt-catalog-own-text-colors` / `xt-catalog-watched-text-colors` | Catalog per-highlight text recoloring |
| `highlight-next-settings` | Settings window has the `Highlight neXT` comparison overlay enabled |

---

## 2. Post highlight classes (added to a post)

| Class | Applied when | Color variable |
|---|---|---|
| `quotesYou` | Post quotes one of your posts | `--xt-highlight-you` |
| `yourPost` | Post is yours | `--xt-highlight-own` |
| `from-archive` | Post was restored from an archive (ghost) | `--xt-highlight-ghost` |
| `filter-highlight` | Matched a `highlight` filter with no custom name | `--xt-filter-highlight` |
| `filter-glow-tile` | Filter used the `;tile` keyword (catalog glow round whole tile) | `--xt-highlight-shadow` |
| *your filter name* | Matched a `highlight:NAME` filter - adds class `NAME` | *(you define `.NAME`)* |
| `highlight` | A post ID you clicked to highlight (ID highlighter) | *(style `.highlight` yourself)* |
| `qphl` | Quote-preview / scroll-marker flash on the target post | `--xt-qphl` |

> **Named filter highlights are pure class hooks.** A filter rule
> `highlight:mod` just adds the class `mod` to the post - neXT applies **no**
> color of its own. You style it entirely yourself:
> ```css
> .mod.opContainer, .mod > .reply { box-shadow: inset 5px 0 gold; }
> ```

---

## 3. Quick Reply preview hooks

The Quick Reply comment preview is styled as a real post. The same preview post
shell is used when the preview is docked inline in the thread or displayed as a
floating post near QR.

| Hook | Applied to | Notes |
|---|---|---|
| `.postContainer.qr-preview-post` | Inline thread preview post container | Inserted into the thread when the preview is docked inline |
| `.qr-preview-float` | Floating preview root | Fixed-position draggable wrapper |
| `.qr-preview-float .qr-preview-post` | Post shell inside the floating preview | Uses the same post styling as inline preview |
| `.qr-preview-post > .reply` | Preview reply body | Carries the dashed preview border and accent edge |
| `.qr-preview-file-note` | File note inside the preview | Used for attachment preview metadata |
| `.qr-preview-inline-toggle` | Header `preview` text | Toggles docked inline/floating state when dockable |
| `.qr-preview-inline-toggle.is-dockable` | Header `preview` text in a thread | Shows the dock/undock affordance |

| Variable | Controls | Fallback |
|---|---|---|
| `--xt-qr-preview-accent` | Preview accent edge and inner glow | `#ff8c00` |

Example:

```css
:root {
  --xt-qr-preview-accent: #2aa198;
}

.qr-preview-float {
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, .24));
}
```

---

## 4. Settings and search hooks

`Highlight neXT` marks settings that 4chan-neXT added or whose defaults differ
from upstream 4chan X.

| Hook | Meaning |
|---|---|
| `#fourchanx-settings.highlight-next-settings` | Settings dialog with the overlay enabled |
| `[data-next-status="added"]` | Setting added by 4chan-neXT |
| `[data-next-status="changed"]` | Setting whose default differs from upstream |

Settings search and index/catalog search use the CSS Custom Highlight API where
available. These are pseudo-elements, not real DOM classes:

| Pseudo-element | Used by |
|---|---|
| `::highlight(fourchanx-settings-search)` | Settings search |
| `::highlight(fourchanx-index-search)` | Thread index/catalog search |

Legacy Settings search fallback:

| Hook | Meaning |
|---|---|
| `.section-container mark` | Browser fallback when CSS Custom Highlight API is unavailable |

Example:

```css
::highlight(fourchanx-settings-search),
::highlight(fourchanx-index-search) {
  background: rgba(255, 180, 0, .35);
  color: inherit;
}

#fourchanx-settings.highlight-next-settings [data-next-status="added"] {
  box-shadow: inset 4px 0 0 #2aa198;
}
```

---

## 5. Highlight color variables

Set any of these on `:root` (or scope to `:root.tomorrow`, etc.) to recolor.
Each falls back to `--xt-border-highlight` (the theme's master highlight color)
when unset, so overriding just `--xt-border-highlight` recolors all three at
once.

Plain variable overrides are enough for built-in stylesheet theme defaults. Add
`!important` when Custom CSS needs to beat a value selected in the Styling UI,
or Own/Quotes You restored by `Use theme defaults`, because those settings are
written as inline variables on `:root`.

| Variable | Controls | Fallback |
|---|---|---|
| `--xt-border-highlight` | Master highlight color (you/own/ghost base) | per theme |
| `--xt-highlight-you` | (You) highlight | `--xt-border-highlight` |
| `--xt-highlight-own` | Own-post highlight | `--xt-border-highlight` |
| `--xt-highlight-ghost` | Ghost/archived highlight | `#888` |
| `--xt-filter-highlight` | Filter highlight edge | `rgba(221,0,0,.5)` |
| `--xt-highlight-shadow` | Catalog filter-glow | `rgba(255,0,0,.5)` |
| `--xt-highlight-side-arrow` | Reply side-arrow tint when highlighted | `rgba(221,0,0,.8)` |
| `--xt-qphl` | Quote-preview / scroll-marker flash outline | `rgba(216,94,49,.8)` |

### Opacity (fill strength over the post background)

| Variable | Default |
|---|---|
| `--xt-highlight-you-opacity` | `1` |
| `--xt-highlight-own-opacity` | `1` |
| `--xt-highlight-ghost-opacity` | `1` |

### Edge width (left border)

| Variable | Default |
|---|---|
| `--xt-highlight-edge-width` | `3px` (applies to all three) |
| `--xt-edge-width-you` / `--xt-edge-width-own` / `--xt-edge-width-ghost` | per-type override |

### Per-highlight text colors (need `:root.xt-custom-text-colors`)

For each of `you` / `own` / `ghost`:

- `--xt-highlight-{you,own,ghost}-text` - body text
- `--xt-highlight-{you,own,ghost}-link` - links
- `--xt-highlight-{you,own,ghost}-quote` - greentext / quotes
- `--xt-highlight-{you,own,ghost}-dead-link` - dead (`>>123 →`) links

---

## 6. Catalog highlight variables

Own-thread (needs `:root.xt-highlight-catalog-own`) and watched-thread
(needs `:root.xt-highlight-catalog-watched`):

| Variable | Controls |
|---|---|
| `--xt-catalog-own-highlight` / `--xt-catalog-watched-highlight` | Tile color (falls back to `--xt-highlight-own` / `--xt-watched-border`) |
| `--xt-catalog-own-highlight-opacity` / `--xt-catalog-watched-highlight-opacity` | Fill strength (watched defaults to `0.2`) |
| `--xt-catalog-border-width` | Edge width for catalog edge-mode |
| `--xt-catalog-border-width-own` / `--xt-catalog-border-width-watched` | Per-type width |
| `--xt-catalog-{own,watched}-text` / `-link` / `-quote` / `-subject` / `-dead-link` | Text recoloring (need the `*-text-colors` root class) |

---

## 7. "Fits the theme as a hint, not a takeover" - the design rule

A highlight should *signal* a post, not repaint it. neXT does this two ways, and
any new highlight color should follow the same pattern:

1. **Derive the color from the theme, don't hardcode it.** Highlights blend
   their color into the post background with `color-mix(... , var(--xt-post-background))`
   and key off `--xt-border-highlight`, which **each theme redefines** to match
   its palette. Dark themes go further - `tomorrow.css` / `spooky.css` retune
   `--xt-filter-highlight`, `--xt-qphl`, `--xt-highlight-shadow`, and
   `--xt-highlight-side-arrow` to blue instead of the light-theme red. That's
   "fits the theme as a hint."

2. **Prefer an edge/tint over a solid fill.** Filter highlights are a thin
   `box-shadow: inset 5px 0` (a left stripe), and you/own/ghost use a
   `border-left` + low-opacity tint - not an opaque background. The post still
   reads as Yotsuba/Tomorrow/etc.

So when you add a new highlight color, define it as a `--xt-*` variable with a
sensible fallback, give each built-in theme a tuned value (red-family for light
themes, blue-family for dark), and apply it as an edge or `color-mix` tint
rather than a flat fill.

---

## 8. Examples

```css
/* Recolor (You) highlights to amber, everywhere */
:root { --xt-highlight-you: #b58900; }

/* Force that color even if Styling has a Quotes you color/default selected */
:root { --xt-highlight-you: #b58900 !important; }

/* Thicker edge, no background fill, for own posts (userstyle) */
:root.xt-edge-own { --xt-edge-width-own: 5px; }

/* Theme-aware: softer blue on Tomorrow only */
:root.tomorrow { --xt-highlight-you: rgba(110, 160, 200, .9); }

/* Style a named filter highlight `highlight:mod` */
.mod.opContainer,
.mod > .reply { box-shadow: inset 5px 0 gold; }

/* Recolor (You) post text too (requires the text-colors setting on) */
:root.xt-custom-text-colors { --xt-highlight-you-text: #553; }
```

---

## 10. Stacked captcha chips

With `Stacked TCaptcha` on, `#qr` carries `fourchanx-captcha-style-<value>` for the
chosen style (`classic`, `inline`, `dots`). The chips container is always
`.fourchanx-captcha-crumbs` and each chip or dot is a `.fourchanx-captcha-crumb`
button, so custom CSS can restyle or re-align them:

```css
/* right-aligned chips (Inline chips style) */
#qr .fourchanx-captcha-crumbs { margin-left: auto; }

/* centered chips (Inline chips style) */
#qr .fourchanx-captcha-crumbs { margin-left: auto; margin-right: auto; }
```
