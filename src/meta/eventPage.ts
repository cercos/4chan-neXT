import PageContextFunctions from "../PageContext/pageContext";

// This requestId workaround isn't needed in manifest V3, since returning true in the event listener works.
// But we keep it for manifest V2.
let requestID = 0;
chrome.runtime.onMessage.addListener(function(request: any, sender: chrome.runtime.MessageSender, sendResponse) {
  const id = requestID;
  requestID++;
  handlers[request.type as keyof typeof handlers](request, sender).then((data: any) => {
    const tabId = sender.tab?.id;
    if (tabId != null) chrome.tabs.sendMessage(tabId, { id, data });
  });
  sendResponse(id);
});

var handlers = {
  permission(request: any) {
    return new Promise(resolve => {
      const origins = request.origins || ['*://*/'];
      chrome.permissions.contains({origins}, function(result) {
        if (result) {
          resolve(result);
        } else {
          chrome.permissions.request({origins}, function(result) {
            resolve(chrome.runtime.lastError ? false : result);
          });
        }
      });
    })
  },

  async ajax(request: any) {
    try {
      const res = await fetch(request.url, { headers: request.headers || {} });
      if (!res.ok) {
        return { error: true };
      }
      let response;
      if (request.responseType === 'arraybuffer') {
        response = await res.arrayBuffer();
      } else if (request.responseType === 'json') {
        response = await res.json();
      } else {
        response = await res.text();
      }
      const responseHeaderString = Array.from(res.headers, h => `${h[0]}: ${h[1]}\r\n`).join('');
      return { status: res.status, statusText: res.statusText, response, responseHeaderString };
    } catch (e) {
      return { error: true };
    }
  },

  async runInPageContext(request: any, sender: chrome.runtime.MessageSender) {
    const tabId = sender.tab?.id;
    if (tabId == null) return undefined;
    const results = await chrome.scripting.executeScript({
      func: (PageContextFunctions as any)[request.fn], // loose: dynamic fn lookup, result must stay any to match args typing
      args: request.data ? [request.data] : [],
      target: { tabId },
      world: 'MAIN',
    });
    return results[0].result
  }
};
