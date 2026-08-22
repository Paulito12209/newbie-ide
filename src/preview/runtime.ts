/**
 * Code that runs *inside* the preview iframe.
 *
 * Kept as a string so it can be inlined into the srcdoc document: the iframe is
 * sandboxed without `allow-same-origin`, so it has an opaque origin and cannot
 * load module scripts from this app.
 *
 * It does two jobs:
 *  1. Owns the persistent <style id="user-css"> element that the CSS hot path
 *     writes into.
 *  2. Catches user errors and forwards them to the parent.
 */
export const PREVIEW_RUNTIME = [
  '(function () {',
  '  var host = window.parent;',
  '  function post(msg) { try { host.postMessage(msg, "*"); } catch (e) {} }',
  '  function report(message, line, column) {',
  '    var offset = window.__SL_JS_LINE || 0;',
  '    var n = typeof line === "number" ? line - offset : null;',
  '    post({',
  '      source: "slashlearn-preview",',
  '      type: "error",',
  '      message: String(message || "Error"),',
  '      line: n && n > 0 ? n : null,',
  '      column: typeof column === "number" && column > 0 ? column : null',
  '    });',
  '  }',
  '  window.addEventListener("error", function (event) {',
  '    if (event.target && event.target !== window) return;',
  '    report(event.message, event.lineno, event.colno);',
  '  });',
  '  window.addEventListener("unhandledrejection", function (event) {',
  '    var reason = event.reason;',
  '    var text = reason && reason.message ? reason.message : String(reason);',
  '    report("Unhandled promise rejection: " + text, null, null);',
  '  });',
  '  window.addEventListener("message", function (event) {',
  '    if (event.source !== host) return;',
  '    var data = event.data;',
  '    if (!data || data.source !== "slashlearn") return;',
  '    if (data.type === "css") {',
  '      var el = document.getElementById("user-css");',
  '      if (el) el.textContent = data.code;',
  '    }',
  '  });',
  '  post({ source: "slashlearn-preview", type: "ready" });',
  '})();',
].join('\n');
