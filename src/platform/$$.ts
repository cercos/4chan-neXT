import { d } from "../globals/globals";

// Return type is pinned to `any[]` (not `Element[]`): callers across the codebase
// treat `$$` results as HTMLElement/HTMLAnchorElement (reading .dataset/.href/.src),
// matching the historically-loose contract. Tightening the element type here would
// ripple casts into ~15 caller files. // loose:
const $$ = (selector: string, root: ParentNode = d.body): any[] => Array.from(root.querySelectorAll(selector));
export default $$;
