declare const cloneInto: Function;
declare const XPCNativeWrapper: any;
declare interface Window {
  /** Only available in the page context, so in a `$.global` */
  TCaptcha: any;
}

// QR monkey-patches uploaded browser File objects with these extra fields.
declare interface File {
  newName?: string;
  source?: any;
}
