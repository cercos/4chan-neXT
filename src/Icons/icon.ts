import { E } from '../globals/globals';
import { isEscaped, type EscapedHtml } from '../globals/jsx';
import { iconSetData, type IconSetName } from './icon-data.generated';

export const ICON_SETS: { id: IconSetName, name: string }[] = [
  { id: 'fontAwesome', name: 'Font Awesome' },
  { id: 'lucide',      name: 'Lucide' },
  { id: 'material',    name: 'Material Icons' },
  { id: 'phosphor',    name: 'Phosphor' },
  { id: 'tabler',      name: 'Tabler' },
  { id: 'bootstrap',   name: 'Bootstrap Icons' },
  { id: 'heroicons',   name: 'Heroicons' },
  { id: 'ionicons',    name: 'Ionicons' },
];

export const DEFAULT_ICON_SET: IconSetName = 'fontAwesome';

const isIconSet = (value: unknown): value is IconSetName =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(iconSetData, value);

let currentSet: IconSetName = DEFAULT_ICON_SET;

// Names are identical across sets (the generator guarantees full coverage), so the
// FontAwesome set is the source of truth for the valid icon-name type.
type IconName = keyof typeof iconSetData['fontAwesome'];

const lookup = (name: IconName): string => {
  const html = iconSetData[currentSet][name] ?? iconSetData[DEFAULT_ICON_SET][name];
  if (!html) throw new Error(`Icon "${name}" not found.`);
  return html;
};

var Icon = {
  /** Switch the active icon set. Already-rendered icons keep their old set until
   * re-rendered, so callers should reload the page after changing this. */
  setIconSet(set: unknown) {
    currentSet = isIconSet(set) ? set : DEFAULT_ICON_SET;
  },

  /** Sets an icon in an HTML element */
  set (node: HTMLElement, name: IconName, altText?: string) {
    const html = lookup(name);
    if (altText) {
      node.innerHTML = `<span class="icon--alt-text">${E(altText)}</span>${html}`;
    } else {
      node.innerHTML = html;
    }
  },

  /** Get the raw SVG string for an icon. */
  get(name: IconName): string {
    return lookup(name);
  },

  /** Get the raw SVG string for an icon wrapped for use in JSX. */
  raw(name: IconName): EscapedHtml {
    return { innerHTML: lookup(name), [isEscaped]: true };
  },
};

export default Icon;
