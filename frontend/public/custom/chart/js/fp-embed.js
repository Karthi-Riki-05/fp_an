/* FP Analyzer drawio embed plugin
 * Lives alongside ValueChart's over-ride.js (loaded by public/draw_io/index.html
 * via a sibling <script> tag). Provides three things:
 *
 *   1. Native HTML5 drop target — listens for dragover/drop on the iframe's
 *      own document so equipment rows dragged from the parent window land
 *      inside drawio without parent-side onDrop handlers (which never fire,
 *      because the iframe consumes the drop first). We claim only the
 *      `application/fp-equipment` MIME type; drawio's own toolbar drags
 *      (which carry text/plain) are unaffected.
 *
 *   2. postMessage action `insertNode` — same payload shape as the drop,
 *      kept for programmatic insertion (e.g. tests, future toolbar buttons).
 *
 *   3. postMessage action `paintStatus` — walks all cells, matches by the
 *      custom `equipment-id` attribute on the cell's UserObject value, and
 *      swaps fillColor/strokeColor/fontColor for the live-status overlay
 *      used by Monitor (§11-S7).
 *
 * Relies on `window.__editorUi` which over-ride.js captures at createUi
 * time. Polls with a 10s timeout for that to land if it isn't yet ready
 * when a message arrives.
 *
 * See FLOW_MANAGEMENT_ANALYSIS.md §11.4 + §11.6 for the contract.
 */
(function () {
  if (typeof window === 'undefined') return;

  function whenEditorReady(cb) {
    var ui = window.__editorUi;
    if (ui && ui.editor && ui.editor.graph) { cb(ui); return; }
    var n = 0;
    var t = setInterval(function () {
      var u = window.__editorUi;
      if (u && u.editor && u.editor.graph) {
        clearInterval(t);
        cb(u);
        return;
      }
      if (++n > 50) {
        clearInterval(t);
        try { console.warn('[fp-embed] editor not ready after 10s; dropping message'); } catch (e) {}
      }
    }, 200);
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ─── insertNode ────────────────────────────────────────────────────────
  // Build XML the same shape drawio writes when you serialize a cell that
  // has custom UserObject attributes, then deserialize via the exact same
  // path mergeAiXml uses (stringToCells → importCells). mergeAiXml is
  // known-good in this drawio build; reusing that path sidesteps every
  // shape-renderer quirk we hit when calling insertVertex directly.
  function handleInsertNode(editorUi, msg) {
    var graph = editorUi.editor.graph;
    var x = Number(msg.x) || 0;
    var y = Number(msg.y) || 0;
    var label = String(msg.label || 'Equipment');
    var equipmentId = String(msg.equipmentId || '');
    var style = msg.style
      || 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';

    var xml =
      '<mxGraphModel><root>' +
      '<mxCell id="0"/>' +
      '<mxCell id="1" parent="0"/>' +
      '<UserObject id="fp-' + Date.now() + '"' +
        ' label="' + xmlEscape(label) + '"' +
        (equipmentId ? ' equipment-id="' + xmlEscape(equipmentId) + '"' : '') + '>' +
        '<mxCell style="' + xmlEscape(style) + '" vertex="1" parent="1">' +
          '<mxGeometry width="120" height="60" as="geometry"/>' +
        '</mxCell>' +
      '</UserObject>' +
      '</root></mxGraphModel>';

    try {
      console.log('[fp-embed] handleInsertNode at', x, y, 'label=', label);
      var cells = editorUi.stringToCells(xml);
      if (!cells || cells.length === 0) {
        console.warn('[fp-embed] insertNode: stringToCells returned 0 cells');
        return;
      }
      graph.model.beginUpdate();
      try {
        var inserted = graph.importCells(cells, x, y);
        graph.setSelectionCells(inserted);
      } finally {
        graph.model.endUpdate();
      }
      try {
        (window.opener || window.parent).postMessage(
          JSON.stringify({ event: 'insertNode', success: true, equipmentId: equipmentId }),
          '*'
        );
      } catch (e) {}
    } catch (err) {
      try { console.error('[fp-embed] insertNode failed', err); } catch (e) {}
    }
  }

  // ─── paintStatus ───────────────────────────────────────────────────────
  function handlePaintStatus(editorUi, msg) {
    if (!Array.isArray(msg.updates)) return;
    var graph = editorUi.editor.graph;
    var cells = graph.model.cells || {};
    var byId = {};
    for (var i = 0; i < msg.updates.length; i++) {
      var u = msg.updates[i];
      if (u && u.equipmentId !== undefined && u.equipmentId !== null) {
        byId[String(u.equipmentId)] = u.style || '';
      }
    }
    graph.model.beginUpdate();
    try {
      for (var id in cells) {
        var cell = cells[id];
        if (!cell || !cell.value || !cell.value.getAttribute) continue;
        var eid = cell.value.getAttribute('equipment-id');
        if (!eid || !(eid in byId)) continue;
        var existing = cell.getStyle() || '';
        var stripped = existing
          .replace(/fillColor=[^;]*;?/g, '')
          .replace(/strokeColor=[^;]*;?/g, '')
          .replace(/fontColor=[^;]*;?/g, '');
        var sep = stripped && stripped[stripped.length - 1] !== ';' ? ';' : '';
        graph.setCellStyle(stripped + sep + byId[eid], [cell]);
      }
    } catch (err) {
      try { console.error('[fp-embed] paintStatus failed', err); } catch (e) {}
    } finally {
      graph.model.endUpdate();
    }
  }

  // ─── native HTML5 drop target ─────────────────────────────────────────
  // The iframe's document receives drop events directly; the parent
  // window's onDrop never fires once the cursor crosses into the iframe
  // area. So we listen here, in capture phase (so drawio's own dragover
  // can't beat us to preventDefault), and only intercept drops carrying
  // our `application/fp-equipment` MIME type.
  function setupDropTarget(editorUi) {
    if (editorUi.__fpDropBound) return;
    editorUi.__fpDropBound = true;
    var graph = editorUi.editor.graph;
    console.log('[fp-embed] drop target armed');

    function hasFpPayload(evt) {
      if (!evt.dataTransfer || !evt.dataTransfer.types) return false;
      var types = evt.dataTransfer.types;
      // `types` is a DOMStringList in some browsers, a plain array in others
      for (var i = 0; i < types.length; i++) {
        if (types[i] === 'application/fp-equipment') return true;
      }
      return false;
    }

    document.addEventListener('dragover', function (evt) {
      if (!hasFpPayload(evt)) return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'copy';
    }, true);

    document.addEventListener('drop', function (evt) {
      if (!hasFpPayload(evt)) return;
      evt.preventDefault();
      evt.stopPropagation();
      var raw = evt.dataTransfer.getData('application/fp-equipment');
      if (!raw) return;
      var payload;
      try { payload = JSON.parse(raw); } catch (e) {
        console.warn('[fp-embed] drop payload not JSON', e);
        return;
      }
      console.log('[fp-embed] drop received', payload);

      // Convert client coords → graph model coords. Same formula drawio's
      // own sidebar drag uses (mxUtils.convertPoint + view scale/translate).
      var view = graph.view;
      var rect = graph.container.getBoundingClientRect();
      var scrollX = graph.container.scrollLeft || 0;
      var scrollY = graph.container.scrollTop || 0;
      var modelX = (evt.clientX - rect.left + scrollX) / view.scale - view.translate.x;
      var modelY = (evt.clientY - rect.top + scrollY) / view.scale - view.translate.y;

      // Center the 120x60 cell under the cursor instead of anchoring its
      // top-left at the cursor (which felt off when dropping).
      handleInsertNode(editorUi, {
        x: modelX - 60,
        y: modelY - 30,
        label: payload.equipmentName || 'Equipment',
        equipmentId: payload.equipmentId,
      });
    }, true);
  }

  // ─── cell-click forwarder ─────────────────────────────────────────────
  // Bound at IIFE time so it works regardless of whether over-ride.js
  // has captured __editorUi yet (lightbox / multi-iframe init can race).
  // On every click we look up the graph instance lazily — directly from
  // window.__editorUi if available, otherwise from the singleton App
  // pattern drawio exposes after main.js boots.
  //
  // Analyzer (§11-S8) listens for cellClick events and uses the
  // equipment id to filter the stop/scrap tables. A null payload means
  // the user clicked empty canvas (clear filter).
  function findEquipmentCell(cell) {
    while (cell) {
      if (cell.value && typeof cell.value.getAttribute === 'function') {
        var raw = cell.value.getAttribute('equipment-id');
        if (raw) {
          var n = Number(raw);
          if (Number.isInteger(n) && n > 0) return n;
        }
      }
      cell = cell.parent;
    }
    return null;
  }

  function findGraphInstance() {
    // Most reliable: over-ride.js's __editorUi capture.
    if (window.__editorUi && window.__editorUi.editor && window.__editorUi.editor.graph) {
      return window.__editorUi.editor.graph;
    }
    // Fallback for the iframe variants where createUi-hook misses (most
    // notably readOnly Analyzer in our setup): drawio stores the active
    // App on the Editor singleton via `Editor.lastDesktopMode` and the
    // App instance assigns itself to `App.theApp`. Walk those.
    var w = window;
    if (w.App && w.App.theApp && w.App.theApp.editor && w.App.theApp.editor.graph) {
      return w.App.theApp.editor.graph;
    }
    // Final fallback: walk the DOM. Drawio attaches the graph instance
    // to the container via property `graph`. Look for any element with
    // a `mxGraph` instance hung off it.
    var svgs = document.querySelectorAll('svg');
    for (var i = 0; i < svgs.length; i++) {
      var p = svgs[i].parentElement;
      while (p) {
        // mxGraph stores itself as container.graph (App pattern). When
        // it doesn't, the editor exposes it via `__mxGraph` for tests.
        if (p.graph && p.graph.model) return p.graph;
        if (p.__mxGraph) return p.__mxGraph;
        p = p.parentElement;
      }
    }
    return null;
  }

  document.addEventListener('click', function (evt) {
    var graph = findGraphInstance();
    console.log('[fp-embed] click received, graph?', !!graph, 'target=', evt.target && evt.target.tagName);
    if (!graph) {
      // Even without a graph, forward an empty cellClick — the parent
      // can use that as a hint to clear its filter.
      try {
        (window.opener || window.parent).postMessage(
          JSON.stringify({ event: 'cellClick', equipmentId: null }),
          '*'
        );
      } catch (e) {}
      return;
    }
    var target = evt.target;
    var hitCell = null;
    var cells = graph.model.cells || {};
    var cellCount = 0;
    for (var id in cells) {
      cellCount++;
      var c = cells[id];
      var state = graph.view.getState && graph.view.getState(c);
      var node = state && state.shape && state.shape.node;
      if (node && node.contains(target)) {
        hitCell = c;
        break;
      }
    }
    var equipmentId = findEquipmentCell(hitCell);
    console.log('[fp-embed] click cells=', cellCount, 'hitCell?', !!hitCell, 'equipmentId=', equipmentId);
    try {
      (window.opener || window.parent).postMessage(
        JSON.stringify({ event: 'cellClick', equipmentId: equipmentId }),
        '*'
      );
      console.log('[fp-embed] cellClick fired equipmentId=', equipmentId);
    } catch (e) { /* parent gone — silently drop */ }
  }, true);
  console.log('[fp-embed] cell-click forwarder armed (IIFE-bound)');

  // ─── postMessage router ────────────────────────────────────────────────
  window.addEventListener('message', function (evt) {
    if (!evt.data || typeof evt.data !== 'string') return;
    var msg;
    try { msg = JSON.parse(evt.data); } catch (e) { return; }
    if (!msg || typeof msg.action !== 'string') return;
    if (msg.action === 'insertNode') {
      whenEditorReady(function (ui) { handleInsertNode(ui, msg); });
    } else if (msg.action === 'paintStatus') {
      whenEditorReady(function (ui) { handlePaintStatus(ui, msg); });
    }
  });

  // Arm the drop target as soon as the editor exists.
  // (cell-click forwarder is bound at IIFE time above — it resolves the
  // graph lazily, which works even when whenEditorReady never fires.)
  whenEditorReady(setupDropTarget);
})();
