/**
 * Generates src/Icons/icon-data.generated.ts: the SVG markup for every icon the
 * script uses, across each selectable icon set. Run with `node tools/gen-icons.js`.
 *
 * Each canonical icon name (the names used throughout the app) maps to the
 * equivalent glyph in each set. Output values are full <svg class="icon"> strings
 * using currentColor so existing CSS keeps working. A name that is missing in a
 * set falls back to the Font Awesome glyph and is reported as a warning, so the
 * build never breaks on a bad mapping; the warnings are the punch list to refine.
 *
 * To add a set: install it, add a SETS entry (builder + name map), regenerate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as fas from '@fortawesome/free-solid-svg-icons';
import * as far from '@fortawesome/free-regular-svg-icons';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" class="icon"';

const stripComment = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const innerOf = (svg) => stripComment(svg).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
const attr = (svg, name) => (svg.match(new RegExp(`${name}="([^"]*)"`)) || [, ''])[1];

// Build a per-file builder. `stroke: true` carries stroke presentation attributes
// onto the root (for outline sets like Lucide/Tabler); otherwise it is a fill set.
const fileSet = (dir, { stroke = false, defaultVb = '0 0 24 24' } = {}) => (name) => {
  const src = readFileSync(resolve(root, 'node_modules', dir, `${name}.svg`), 'utf8');
  const vb = attr(src, 'viewBox') || defaultVb;
  const head = stroke
    ? `viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
    : `viewBox="${vb}" fill="currentColor"`;
  return `${SVG_OPEN} ${head}>${innerOf(src)}</svg>`;
};

// Font Awesome reads from the installed package's icon objects ([w,h,,,path]).
const faSet = ([variant, name]) => {
  const def = (variant === 'solid' ? fas : far)[name];
  if (!def) throw new Error(`FA icon missing: ${name}`);
  const [w, h, , , path] = def.icon;
  return `${SVG_OPEN} viewBox="0 0 ${w} ${h}" fill="currentColor"><path d="${path}"/></svg>`;
};

// Canonical icon names. Each set below maps these to its own glyph names.
const CANON = [
  'image', 'eye', 'expand', 'comment', 'circleQuestion', 'refresh', 'wrench', 'bolt',
  'link', 'pencil', 'clipboard', 'clock', 'shuffle', 'undo', 'download', 'bookOpen',
  'shrink', 'heart', 'caretRight', 'caretLeft', 'caretDown', 'scissors', 'xmark', 'check',
  'arrowRightLong', 'plus', 'squarePlus', 'squareMinus', 'play', 'stop', 'arrowUpLong',
  'arrowDownLong', 'bars', 'barsStaggered', 'sliders',
];

const SETS = [
  {
    id: 'fontAwesome', build: faSet, map: {
      image: ['regular', 'faImage'], eye: ['regular', 'faEye'], expand: ['solid', 'faUpRightAndDownLeftFromCenter'],
      comment: ['regular', 'faComment'], circleQuestion: ['regular', 'faCircleQuestion'], refresh: ['solid', 'faRotate'],
      wrench: ['solid', 'faWrench'], bolt: ['solid', 'faBolt'], link: ['solid', 'faLink'], pencil: ['solid', 'faPencil'],
      clipboard: ['solid', 'faClipboard'], clock: ['regular', 'faClock'], shuffle: ['solid', 'faShuffle'],
      undo: ['solid', 'faRotateLeft'], download: ['solid', 'faDownload'], bookOpen: ['solid', 'faBookOpen'],
      shrink: ['solid', 'faDownLeftAndUpRightToCenter'], heart: ['solid', 'faHeart'], caretRight: ['solid', 'faCaretRight'],
      caretLeft: ['solid', 'faCaretLeft'], caretDown: ['solid', 'faCaretDown'], scissors: ['solid', 'faScissors'],
      xmark: ['solid', 'faXmark'], check: ['solid', 'faCheck'], arrowRightLong: ['solid', 'faArrowRightLong'],
      plus: ['solid', 'faPlus'], squarePlus: ['regular', 'faSquarePlus'], squareMinus: ['regular', 'faSquareMinus'],
      play: ['solid', 'faPlay'], stop: ['solid', 'faStop'], arrowUpLong: ['solid', 'faArrowUpLong'],
      arrowDownLong: ['solid', 'faArrowDownLong'], bars: ['solid', 'faBars'], barsStaggered: ['solid', 'faBarsStaggered'],
      sliders: ['solid', 'faSliders'],
    },
  },
  {
    id: 'lucide', build: fileSet('lucide-static/icons', { stroke: true }), map: {
      image: 'image', eye: 'eye', expand: 'maximize-2', comment: 'message-square', circleQuestion: 'circle-help',
      refresh: 'refresh-cw', wrench: 'wrench', bolt: 'zap', link: 'link', pencil: 'pencil', clipboard: 'clipboard',
      clock: 'clock', shuffle: 'shuffle', undo: 'undo-2', download: 'download', bookOpen: 'book-open', shrink: 'minimize-2',
      heart: 'heart', caretRight: 'chevron-right', caretLeft: 'chevron-left', caretDown: 'chevron-down', scissors: 'scissors',
      xmark: 'x', check: 'check', arrowRightLong: 'arrow-right', plus: 'plus', squarePlus: 'square-plus',
      squareMinus: 'square-minus', play: 'play', stop: 'square', arrowUpLong: 'arrow-up', arrowDownLong: 'arrow-down',
      bars: 'menu', barsStaggered: 'align-left', sliders: 'sliders-horizontal',
    },
  },
  {
    id: 'material', build: fileSet('@material-design-icons/svg/filled'), map: {
      image: 'image', eye: 'visibility', expand: 'open_in_full', comment: 'comment', circleQuestion: 'help',
      refresh: 'refresh', wrench: 'build', bolt: 'bolt', link: 'link', pencil: 'edit', clipboard: 'content_paste',
      clock: 'schedule', shuffle: 'shuffle', undo: 'undo', download: 'download', bookOpen: 'menu_book',
      shrink: 'close_fullscreen', heart: 'favorite', caretRight: 'arrow_right', caretLeft: 'arrow_left',
      caretDown: 'arrow_drop_down', scissors: 'content_cut', xmark: 'close', check: 'check', arrowRightLong: 'arrow_forward',
      plus: 'add', squarePlus: 'add_box', squareMinus: 'indeterminate_check_box', play: 'play_arrow', stop: 'stop',
      arrowUpLong: 'arrow_upward', arrowDownLong: 'arrow_downward', bars: 'menu', barsStaggered: 'notes', sliders: 'tune',
    },
  },
  {
    id: 'phosphor', build: fileSet('@phosphor-icons/core/assets/regular', { defaultVb: '0 0 256 256' }), map: {
      image: 'image', eye: 'eye', expand: 'arrows-out', comment: 'chat', circleQuestion: 'question',
      refresh: 'arrows-clockwise', wrench: 'wrench', bolt: 'lightning', link: 'link', pencil: 'pencil', clipboard: 'clipboard',
      clock: 'clock', shuffle: 'shuffle', undo: 'arrow-counter-clockwise', download: 'download-simple', bookOpen: 'book-open',
      shrink: 'arrows-in', heart: 'heart', caretRight: 'caret-right', caretLeft: 'caret-left', caretDown: 'caret-down',
      scissors: 'scissors', xmark: 'x', check: 'check', arrowRightLong: 'arrow-right', plus: 'plus', squarePlus: 'plus-square',
      squareMinus: 'minus-square', play: 'play', stop: 'stop', arrowUpLong: 'arrow-up', arrowDownLong: 'arrow-down',
      bars: 'list', barsStaggered: 'list-dashes', sliders: 'sliders-horizontal',
    },
  },
  {
    id: 'tabler', build: fileSet('@tabler/icons/icons/outline', { stroke: true }), map: {
      image: 'photo', eye: 'eye', expand: 'arrows-maximize', comment: 'message-circle', circleQuestion: 'help-circle',
      refresh: 'refresh', wrench: 'tool', bolt: 'bolt', link: 'link', pencil: 'pencil', clipboard: 'clipboard',
      clock: 'clock', shuffle: 'arrows-shuffle', undo: 'arrow-back-up', download: 'download', bookOpen: 'book',
      shrink: 'arrows-minimize', heart: 'heart', caretRight: 'caret-right', caretLeft: 'caret-left', caretDown: 'caret-down',
      scissors: 'scissors', xmark: 'x', check: 'check', arrowRightLong: 'arrow-right', plus: 'plus', squarePlus: 'square-plus',
      squareMinus: 'square-minus', play: 'player-play', stop: 'player-stop', arrowUpLong: 'arrow-up', arrowDownLong: 'arrow-down',
      bars: 'menu-2', barsStaggered: 'list', sliders: 'adjustments-horizontal',
    },
  },
  {
    id: 'bootstrap', build: fileSet('bootstrap-icons/icons', { defaultVb: '0 0 16 16' }), map: {
      image: 'image-fill', eye: 'eye-fill', expand: 'arrows-fullscreen', comment: 'chat-fill', circleQuestion: 'question-circle-fill',
      refresh: 'arrow-clockwise', wrench: 'wrench', bolt: 'lightning-fill', link: 'link-45deg', pencil: 'pencil-fill',
      clipboard: 'clipboard-fill', clock: 'clock-fill', shuffle: 'shuffle', undo: 'arrow-counterclockwise', download: 'download',
      bookOpen: 'book-fill', shrink: 'fullscreen-exit', heart: 'heart-fill', caretRight: 'caret-right-fill', caretLeft: 'caret-left-fill',
      caretDown: 'caret-down-fill', scissors: 'scissors', xmark: 'x-lg', check: 'check-lg', arrowRightLong: 'arrow-right',
      plus: 'plus-lg', squarePlus: 'plus-square-fill', squareMinus: 'dash-square-fill', play: 'play-fill', stop: 'stop-fill',
      arrowUpLong: 'arrow-up', arrowDownLong: 'arrow-down', bars: 'list', barsStaggered: 'text-left', sliders: 'sliders',
    },
  },
  {
    id: 'heroicons', build: fileSet('heroicons/24/solid'), map: {
      image: 'photo', eye: 'eye', expand: 'arrows-pointing-out', comment: 'chat-bubble-oval-left', circleQuestion: 'question-mark-circle',
      refresh: 'arrow-path', wrench: 'wrench', bolt: 'bolt', link: 'link', pencil: 'pencil', clipboard: 'clipboard',
      clock: 'clock', shuffle: 'arrows-right-left', undo: 'arrow-uturn-left', download: 'arrow-down-tray', bookOpen: 'book-open',
      shrink: 'arrows-pointing-in', heart: 'heart', caretRight: 'chevron-right', caretLeft: 'chevron-left', caretDown: 'chevron-down',
      scissors: 'scissors', xmark: 'x-mark', check: 'check', arrowRightLong: 'arrow-long-right', plus: 'plus',
      squarePlus: 'plus-circle', squareMinus: 'minus-circle', play: 'play', stop: 'stop', arrowUpLong: 'arrow-long-up',
      arrowDownLong: 'arrow-long-down', bars: 'bars-3', barsStaggered: 'bars-3-bottom-left', sliders: 'adjustments-horizontal',
    },
  },
  {
    id: 'ionicons', build: fileSet('ionicons/dist/svg', { defaultVb: '0 0 512 512' }), map: {
      image: 'image', eye: 'eye', expand: 'expand', comment: 'chatbubble', circleQuestion: 'help-circle',
      refresh: 'refresh', wrench: 'build', bolt: 'flash', link: 'link', pencil: 'pencil', clipboard: 'clipboard',
      clock: 'time', shuffle: 'shuffle', undo: 'arrow-undo', download: 'download', bookOpen: 'book', shrink: 'contract',
      heart: 'heart', caretRight: 'caret-forward', caretLeft: 'caret-back', caretDown: 'caret-down', scissors: 'cut',
      xmark: 'close', check: 'checkmark', arrowRightLong: 'arrow-forward', plus: 'add', squarePlus: 'add-circle',
      squareMinus: 'remove-circle', play: 'play', stop: 'stop', arrowUpLong: 'arrow-up', arrowDownLong: 'arrow-down',
      bars: 'menu', barsStaggered: 'list', sliders: 'options',
    },
  },
];

// Base set used to fill any gap so the build never breaks on a bad mapping.
const base = {};
for (const name of CANON) base[name] = SETS[0].build(SETS[0].map[name]);

const data = {};
const warnings = [];
for (const set of SETS) {
  data[set.id] = {};
  for (const name of CANON) {
    try {
      const key = set.map[name];
      if (key == null) throw new Error('no mapping');
      data[set.id][name] = set.build(key);
    } catch (e) {
      warnings.push(`${set.id}/${name} -> Font Awesome fallback (${e.message})`);
      data[set.id][name] = base[name];
    }
  }
}

const body =
  `// AUTO-GENERATED by tools/gen-icons.js. Do not edit by hand; run the script to update.\n\n` +
  `export type IconSetName = ${SETS.map((s) => `'${s.id}'`).join(' | ')};\n\n` +
  `export const iconSetData: Record<IconSetName, Record<string, string>> = ${JSON.stringify(data, null, 2)};\n`;

writeFileSync(resolve(root, 'src/Icons/icon-data.generated.ts'), body);
console.log(`Wrote icon-data.generated.ts (${SETS.length} sets x ${CANON.length} icons).`);
if (warnings.length) {
  console.warn(`\n${warnings.length} fallback(s) — refine these mappings:`);
  for (const w of warnings) console.warn('  ' + w);
}
