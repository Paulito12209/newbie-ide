/**
 * Code that runs *inside* the preview iframe.
 *
 * Kept as a string so it can be inlined into the srcdoc document: the iframe is
 * sandboxed without `allow-same-origin`, so it has an opaque origin and cannot
 * load module scripts from this app.
 *
 * It does two jobs:
 *  1. Serves the CSS hot path, writing into whichever <style> element stands in
 *     for a given stylesheet file.
 *  2. Catches user errors, maps the document line back to a file and line the
 *     user can actually find, and forwards it to the parent.
 */
export const PREVIEW_RUNTIME = [
  '(function () {',
  '  var host = window.parent;',
  '  function post(msg) { try { host.postMessage(msg, "*"); } catch (e) {} }',
  '  function locate(line) {',
  '    var list = window.__SL_SCRIPTS || [];',
  '    for (var i = 0; i < list.length; i++) {',
  '      if (line >= list[i].start && line <= list[i].end) {',
  '        return { file: list[i].name, line: line - list[i].start };',
  '      }',
  '    }',
  '    return null;',
  '  }',
  '  function report(message, line, column) {',
  '    var at = typeof line === "number" ? locate(line) : null;',
  '    post({',
  '      source: "slashlearn-preview",',
  '      type: "error",',
  '      message: String(message || "Error"),',
  '      file: at ? at.file : null,',
  '      line: at ? at.line : null,',
  '      column: at && typeof column === "number" && column > 0 ? column : null',
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
  '    if (!data || data.source !== "slashlearn" || data.type !== "css") return;',
  '    var nodes = document.querySelectorAll("style[data-sl-file]");',
  '    for (var i = 0; i < nodes.length; i++) {',
  '      if (nodes[i].getAttribute("data-sl-file") === data.file) nodes[i].textContent = data.code;',
  '    }',
  '  });',
  '  post({ source: "slashlearn-preview", type: "ready" });',
  '})();',
].join('\n');
