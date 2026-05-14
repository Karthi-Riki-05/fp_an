/* FP Analyzer drawio embed plugin
 * Lives alongside ValueChart's over-ride.js (loaded by public/draw_io/index.html
 * via a sibling <script> tag). Handles two custom postMessage actions from
 * the new_fp parent window:
 *
 *   insertNode   — drop an equipment-bound cell at canvas coordinates.
 *                  Stores the equipment id in a custom `equipment-id`
 *                  attribute on the cell value (an XML <object>), so the
 *                  Monitor live-status overlay (§11-S7) can find it later.
 *
 *   paintStatus  — walk all cells; for every cell whose `equipment-id`
 *                  attribute matches one of the supplied updates, replace
 *                  its fillColor/strokeColor/fontColor with the new style.
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

  function handleInsertNode(editorUi, msg) {
    var graph = editorUi.editor.graph;
    var x = Number(msg.x) || 0;
    var y = Number(msg.y) || 0;
    var label = String(msg.label || 'Equipment');
    var equipmentId = String(msg.equipmentId || '');
    var style = msg.style
      || 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';

    // Build XML the same shape drawio writes when you serialize a cell
    // that has custom UserObject attributes, then deserialize via the
    // exact same path mergeAiXml uses (stringToCells → importCells).
    // mergeAiXml is known-good in this drawio build; reusing that path
    // sidesteps every shape-renderer quirk we hit when calling
    // insertVertex directly.
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
      console.log('[fp-embed] handleInsertNode v2 (stringToCells path)');
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

  function handlePaintStatus(editorUi, msg) {
    // §11.6 — match by equipment-id attribute, swap colour-relevant style.
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
})();
