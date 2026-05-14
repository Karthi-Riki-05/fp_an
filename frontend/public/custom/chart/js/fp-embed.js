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

  function handleInsertNode(editorUi, msg) {
    var graph = editorUi.editor.graph;
    var x = Number(msg.x) || 0;
    var y = Number(msg.y) || 0;
    var label = String(msg.label || 'Equipment');
    var equipmentId = String(msg.equipmentId || '');
    var width = Number(msg.width) || 120;
    var height = Number(msg.height) || 60;
    // Default style — explicit shape=rectangle so drawio renders a filled
    // box even on themes where the default vertex shape isn't rectangle.
    var style = msg.style
      || 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';

    graph.model.beginUpdate();
    try {
      // Step 1: insert as a normal string-valued vertex so drawio renders
      // the rectangle + label using its standard path. (Passing an XML
      // <object> as value short-circuits that path and produces a
      // label-only render — which is what S5 originally hit.)
      var vertex = graph.insertVertex(
        graph.getDefaultParent(),
        null,
        label,
        x, y, width, height,
        style
      );
      // Step 2: promote the value to a UserObject and stamp the custom
      // attribute. setAttributeForCell handles the upgrade transparently.
      if (equipmentId) {
        graph.setAttributeForCell(vertex, 'equipment-id', equipmentId);
      }
      graph.setSelectionCell(vertex);
      try {
        (window.opener || window.parent).postMessage(
          JSON.stringify({ event: 'insertNode', success: true, equipmentId: equipmentId }),
          '*'
        );
      } catch (e) {}
    } catch (err) {
      try { console.error('[fp-embed] insertNode failed', err); } catch (e) {}
    } finally {
      graph.model.endUpdate();
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
