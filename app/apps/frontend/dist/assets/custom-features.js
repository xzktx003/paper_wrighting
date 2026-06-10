/**
 * Custom features injected without modifying the main bundle.
 * Loaded after the React app mounts. Uses MutationObserver to
 * hook into dynamically rendered elements.
 */
(function () {
  'use strict';

  // ---- Helpers ----
  var PROJECT_ID_RE = /\/editor\/([^/]+)/;
  function getProjectId() {
    var m = location.pathname.match(PROJECT_ID_RE);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ---- 1. Auto-dismiss compile error / toast after 10 s ----
  var DISMISS_MS = 10000;
  var seenErrors = new WeakSet();

  function scanForErrors(root) {
    if (!root || !root.querySelectorAll) return;
    var candidates = root.querySelectorAll(
      '[class*="error"], [class*="Error"], [class*="toast"], [class*="Toast"], [class*="alert"], [class*="Alert"], [class*="danger"], [class*="Danger"]'
    );
    candidates.forEach(function (el) {
      if (seenErrors.has(el)) return;
      var text = (el.textContent || '').toLowerCase();
      if (
        text.indexOf('error') >= 0 ||
        text.indexOf('failed') >= 0 ||
        text.indexOf('错误') >= 0 ||
        text.indexOf('失败') >= 0 ||
        text.indexOf('misplaced') >= 0 ||
        text.indexOf('halted') >= 0
      ) {
        seenErrors.add(el);
        setTimeout(function () {
          el.style.transition = 'opacity 0.4s';
          el.style.opacity = '0';
          setTimeout(function () { el.remove(); }, 400);
        }, DISMISS_MS);
      }
    });
  }

  // ---- 2. SyncTeX click-to-source on PDF <embed> / <iframe> ----
  var synctexOverlays = new WeakSet();

  function addSynctexOverlay(embedEl) {
    if (synctexOverlays.has(embedEl)) return;
    synctexOverlays.add(embedEl);

    var parent = embedEl.parentElement;
    if (!parent) return;

    var prevPos = getComputedStyle(parent).position;
    if (prevPos === 'static') parent.style.position = 'relative';

    var overlay = document.createElement('div');
    overlay.title = 'Click to jump to source (SyncTeX)';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.cursor = 'crosshair';
    overlay.style.zIndex = '5';
    overlay.style.background = 'transparent';

    overlay.addEventListener('click', function (e) {
      var rect = overlay.getBoundingClientRect();
      var relX = e.clientX - rect.left;
      var relY = e.clientY - rect.top;
      var normX = relX / rect.width;
      var normY = relY / rect.height;
      var pdfX = normX * 612;
      var pdfY = (1 - normY) * 792;

      var projectId = getProjectId();
      if (!projectId) return;

      fetch(
        '/api/projects/' + encodeURIComponent(projectId) + '/synctex/pdf-to-source',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: 1, x: pdfX, y: pdfY }),
        }
      )
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.file && data.line) {
            window.dispatchEvent(
              new CustomEvent('synctex-jump', {
                detail: { file: data.file, line: data.line },
              })
            );
          }
        })
        .catch(function () {});
    });

    parent.appendChild(overlay);
  }

  // ---- 3. Handle synctex-jump → scroll CodeMirror editor ----
  window.addEventListener('synctex-jump', function (e) {
    var detail = e.detail || {};
    if (!detail.file || !detail.line) return;

    var cmEl = document.querySelector('.cm-editor');
    if (cmEl && cmEl.cmView && cmEl.cmView.view) {
      var view = cmEl.cmView.view;
      var doc = view.state.doc;
      var targetLine = Math.min(detail.line, doc.lines);
      var lineObj = doc.line(targetLine);
      view.dispatch({
        selection: { anchor: lineObj.from },
      });
      view.focus();
    }
  });

  // ---- 4. Terminal wheel scroll fix ----
  //
  // ROOT CAUSE: xterm.js 5.3.0's bindMouse() adds a wheel listener on the
  // .xterm element when mouse tracking protocol is active. That handler calls
  // cancel(ev, true) which prevents the browser's native scroll. Additionally,
  // even when mouse protocol is off, the xterm viewport scroll area may have
  // zero height if no scrollback was generated yet.
  //
  // FIX: Add a capture-phase wheel listener on each .xterm element. When a
  // wheel event arrives:
  //   1. Find the .xterm-viewport element
  //   2. Adjust its scrollTop directly
  //   3. Fire stopImmediatePropagation() to prevent xterm's bindMouse handler
  //      from consuming the event
  //   4. The browser fires a native 'scroll' event on the viewport, which
  //      xterm's _handleScroll picks up to redraw the terminal content.
  //
  var terminalScrollPatched = new WeakSet();

  function patchTerminalScroll(xtermEl) {
    if (terminalScrollPatched.has(xtermEl)) return;
    terminalScrollPatched.add(xtermEl);

    var viewport = xtermEl.querySelector('.xterm-viewport');
    var scrollArea = xtermEl.querySelector('.xterm-scroll-area');
    if (!viewport) {
      // Viewport not created yet, retry
      setTimeout(function () { patchTerminalScroll(xtermEl); }, 500);
      return;
    }

    // The LINES_PER_STEP constant controls how many lines to scroll per
    // wheel "notch". We convert deltaY pixels to lines using the character
    // height, then adjust the scroll area if needed.
    var LINES_PER_NOTCH = 3;
    var LINE_HEIGHT_PX = 18; // will be measured from viewport if possible

    xtermEl.addEventListener('wheel', function (ev) {
      viewport = xtermEl.querySelector('.xterm-viewport');
      scrollArea = xtermEl.querySelector('.xterm-scroll-area');
      if (!viewport) return;

      // Measure actual row height from xterm's internal rendering
      var rowEl = xtermEl.querySelector('.xterm-rows > div');
      if (rowEl) {
        var rh = rowEl.getBoundingClientRect().height;
        if (rh > 0) LINE_HEIGHT_PX = rh;
      }

      // If scroll area doesn't provide enough scroll height,
      // increase it manually. xterm.js sets it to:
      //   (rows + scrollback) * rowHeight
      // but sometimes it doesn't account for all buffer lines.
      var neededHeight = viewport.scrollHeight;
      var currentMax = viewport.scrollHeight - viewport.clientHeight;

      // If the viewport can't scroll at all, force-expand the scroll area
      if (currentMax <= 0) {
        var scrollback = 1000;
        var rows = 24; // default
        var termRows = xtermEl.querySelector('.xterm-rows');
        if (termRows) rows = termRows.children.length || 24;
        var newHeight = (rows + scrollback) * LINE_HEIGHT_PX;
        if (scrollArea) {
          scrollArea.style.height = newHeight + 'px';
        }
      }

      var maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (maxScroll <= 0) return;

      // Calculate scroll delta
      var delta = ev.deltaY;
      if (ev.deltaMode === 1) {
        // Line mode: deltaY is in lines
        delta = ev.deltaY * LINE_HEIGHT_PX * LINES_PER_NOTCH;
      } else if (ev.deltaMode === 2) {
        // Page mode
        delta = ev.deltaY * viewport.clientHeight;
      }
      // Pixel mode (deltaMode === 0): use as-is, but scale for smoothness
      // Many browsers send deltaY in pixels (~100px per notch)
      // We want ~3 lines per notch
      if (ev.deltaMode === 0 && Math.abs(delta) > 0) {
        // Keep pixel delta as-is, it should be proportional
      }

      var oldTop = viewport.scrollTop;
      viewport.scrollTop = Math.max(0, Math.min(maxScroll, oldTop + delta));

      // Prevent xterm's bindMouse handler from also processing this event
      ev.stopImmediatePropagation();
      ev.preventDefault();

      // If scrollTop changed, the browser fires a native 'scroll' event
      // on the viewport, which xterm's _handleScroll() picks up.
      // If it didn't change (already at top/bottom), still suppress the event.
    }, true); // capture phase

    console.log('[custom-features] Terminal wheel scroll patched for', xtermEl.className);
  }

  function scanForTerminals(root) {
    if (!root || !root.querySelectorAll) return;
    var xtermEls = root.querySelectorAll('.xterm');
    xtermEls.forEach(function (el) {
      patchTerminalScroll(el);
    });
    if (root.classList && root.classList.contains('xterm')) {
      patchTerminalScroll(root);
    }
  }

  // ---- 5. Scan for PDF embeds to add synctex overlay ----
  function scanForPdfEmbeds(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('embed[type="application/pdf"]').forEach(addSynctexOverlay);
    root.querySelectorAll('iframe').forEach(function (iframe) {
      var src = iframe.src || '';
      if (src.indexOf('.pdf') >= 0 || src.indexOf('/blob') >= 0) {
        addSynctexOverlay(iframe);
      }
    });
  }

  // ---- MutationObserver: watch the whole document ----
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var node = m.addedNodes[j];
        if (node.nodeType !== 1) continue;
        scanForErrors(node);
        scanForPdfEmbeds(node);
        scanForTerminals(node);
      }
    }
  });

  function init() {
    scanForErrors(document);
    scanForPdfEmbeds(document);
    scanForTerminals(document);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log('[custom-features] Loaded: terminal scroll fix, synctex overlay, error auto-dismiss');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }
})();
