import { d } from "../globals/globals";

const $$ = (selector, root = d.body) => Array.from(root.querySelectorAll(selector));
export default $$;
