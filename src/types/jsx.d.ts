import { EscapedHtml } from "../globals/jsx";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Record<string, unknown> { }
    interface Element extends EscapedHtml { }
  }
}
