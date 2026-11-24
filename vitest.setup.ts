// Runs before any src module is imported by a test.
//
// src/platform/helpers.ts decides `platform` at module scope by probing
// window.GM_xmlhttpRequest, and src/platform/$.ts runs platform-specific code
// at module scope. Stub the userscript globals so imports take the userscript
// path; the crx path would dereference a `chrome` API that doesn't exist here.
(globalThis as Record<string, unknown>).GM_xmlhttpRequest = function () {};
// $.ts reads the bare identifier `GM` (optional-chained, but it must at least
// resolve). Defining the property with an undefined value is enough.
(globalThis as Record<string, unknown>).GM = undefined;
(globalThis as Record<string, unknown>).GM_info = { version: '5.0' };

// jsdom's Blob lacks the arrayBuffer() instance method real browsers have.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// src/main/Main.ts calls $.ready(() => Main.init()) at module scope, and
// $.ready fires immediately unless document.readyState is 'loading'. Pin it
// there so importing app modules never boots the whole script inside a test.
Object.defineProperty(document, 'readyState', {
  value: 'loading',
  configurable: true,
});
