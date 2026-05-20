'use client';

/**
 * FlowDesignerEditor — wraps the vendored draw.io webapp in an iframe and
 * handles the bidirectional postMessage protocol documented in
 * FLOW_MANAGEMENT_ANALYSIS.md §11.4.
 *
 * Ported from the operator's ValueChart project (`components/flows/EditorView.tsx`)
 * per §11-S3. The ValueChart-specific surfaces have been stripped:
 *   - AI / Gemini integration
 *   - Template browser (the "what kind of flow?" dialog)
 *   - Team sharing / project assignment
 *   - Version history
 *   - Save-As modal
 * The injected CSS that hides draw.io's built-in AI/Save&Exit buttons is
 * retained verbatim per §11.10 — operators should never see "Save to Gemini".
 *
 * Save model
 *   - Explicit save (drawio Save button → `event: 'save'`) captures the
 *     current XML, fires an SVG export, and on the export response calls
 *     PUT /:id/diagram with BOTH `flowData` and `svgData` so the FlowCard
 *     thumbnail re-renders.
 *   - Autosave (drawio internal timer → `event: 'autosave'`) debounces 5s
 *     then writes XML only. svg_cache is preserved across autosaves —
 *     the backend (§11-S2) leaves the column alone when svgData is absent.
 *
 * Props (locked by §11-S3):
 *   - flowId       number   row id in flow_designs
 *   - readOnly?    boolean  drives the iframe URL params + setEnabled(false)
 *   - onDiagramReady?  fired once the init handshake completes (used by
 *                      Monitor to know when it's safe to paintStatus())
 */

import { App, Spin } from 'antd';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useFlowDesign } from '../../lib/api/flow-designs';
import type { TenantScope } from '../../lib/api/admin-crud';

const EMPTY_DIAGRAM_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

/**
 * Selectors that match draw.io's AI / Gemini / Save-and-Exit affordances,
 * plus its built-in status toast (we render our own in the page wrapper).
 * Kept verbatim from ValueChart — modifying the rules is risky because
 * draw.io versioning can introduce new sibling selectors that need
 * matching. Keep additive only.
 */
const HIDE_AI_CSS = `
  [title="Generate" i],
  [title*="AI" i],
  [title*="Gemini" i],
  [title*="Ask AI" i],
  [title*="Smart Template" i],
  [aria-label="Generate" i],
  [aria-label*="AI" i],
  [aria-label*="Gemini" i],
  [data-action*="ai" i],
  [data-action*="gemini" i],
  [data-action*="generate" i],
  .geAiButton,
  .mxgraph-ai,
  .mxgraph-ai-button,
  .geCommentsWin-ai,
  .geSidebarFooterAi,
  div.geBigButton[title*="AI" i],
  div.geBigButton[title="Generate" i],
  img[src*="ai-chat" i],
  img[src*="gemini" i],
  .geFooterToolbar [title*="AI" i],
  .geFooterToolbar [title*="Gemini" i],
  .geFooterToolbar [title="Generate" i],
  .picker [title*="AI" i],
  .geSaveAndExit,
  [title="Save & Exit"],
  [title="Save and Exit"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  .geStatus,
  .geStatusAlert,
  .geStatusMessage,
  .geStatusBox,
  .geStatusDiv,
  .geStatusContainer,
  .geNotification,
  .geLanguage,
  .geUser,
  .geFeedback,
  .geToolbarContainer:has(.geStatus),
  .geToolbarContainer:has(.geEmbedBtn),
  a.geStatus,
  div.geStatus,
  div.geStatusDiv,
  [title="Status"],
  [title*="Saved"],
  [title*="Saving"] {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    pointer-events: none !important;
    opacity: 0 !important;
  }
`;

/**
 * Extra CSS used only when `readOnly=true` (e.g. on the Flow Monitor).
 * Hides every drawio chrome surface — left shape library, top menubar +
 * toolbar, right Format panel, bottom footer/status bar — so the iframe
 * renders as a pure read-only diagram viewer.
 *
 * Drawio class names can shift between minor versions. The selectors
 * below cover the 29.x sketch UI; if a new version adds chrome with
 * different class names, extend this list rather than scoping to a
 * single selector — `display: none !important` is idempotent.
 */
const HIDE_CHROME_CSS = `
  /* Class-name selectors — drawio v29 sketch UI surfaces */
  .geSidebarContainer,
  .geFormatContainer,
  .geFormat,
  .geSketchFormatContainer,
  .geMenubarContainer,
  .geMenubar,
  .mxToolbar,
  .geFooterContainer,
  .geFooter,
  .geStatusbar,
  .geToolbarContainer,
  .geVerticalToolbar,
  .geHsplit,
  .geVsplit,
  .geSidebarFooter,
  .geSidebarTooltip,
  .geMenubarBackground,
  .geFormatBackground,
  .geShapesView,
  .geOutline,
  .geOutlineSketch,
  .geSketchMenubarContainer,
  .geSketchPicker,
  .geShapePicker,
  .geFloatingPicker,
  .geSketchMainPicker,
  /* "Floating" panels drawio mounts as siblings of the diagram surface — */
  /* their position:absolute lives outside the chrome containers above,   */
  /* so we additionally target their roles + aria-labels.                 */
  div[role="dialog"][class*="Window"],
  div[role="dialog"][class*="ge"],
  .mxWindow,
  .mxWindowTitle,
  .geWindow,
  .mxPopupMenu,
  /* Tooltip + format-sidebar inner containers */
  [class*="FormatContainer"],
  [class*="ShapePicker"],
  [class*="SketchPicker"] {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    pointer-events: none !important;
  }
  /* Reclaim the diagram surface — without these resets the canvas
     stays squeezed to the right of the (now-hidden) sidebar. */
  .geDiagramContainer,
  .geEditor > .geDiagramContainer,
  div.geDiagramContainer {
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }
`;

const HIDE_SELECTORS = [
  '[title="Generate" i]',
  '[title*="AI" i]',
  '[title*="Gemini" i]',
  '[aria-label="Generate" i]',
  '[aria-label*="AI" i]',
  '[aria-label*="Gemini" i]',
  '[data-action*="ai" i]',
  '[data-action*="generate" i]',
  '[title*="Save & Exit"]',
  '[title*="Save and Exit"]',
  '.geSaveAndExit',
  '.geStatus',
  '.geStatusAlert',
  '.geStatusMessage',
  '.geStatusBox',
  '.geStatusDiv',
  '.geNotification',
  '.geToolbarContainer',
];

function hideAiElements(doc: Document | null | undefined) {
  if (!doc) return;
  for (const selector of HIDE_SELECTORS) {
    try {
      doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        // Only hide a geToolbarContainer if it carries the status / embed
        // chip — we don't want to wipe the main toolbar or the left sidebar.
        if (el.classList.contains('geToolbarContainer')) {
          const isVertical = el.classList.contains('geVerticalToolbar');
          const hasStatus = !!el.querySelector('.geStatus, .geStatusDiv, .geStatusBox');
          const hasEmbed = !!el.querySelector('.geEmbedBtn, .gePrimaryBtn');
          if (!isVertical && (hasStatus || hasEmbed)) {
            if (el.style.display !== 'none') {
              el.style.setProperty('display', 'none', 'important');
            }
          }
          return;
        }
        const btn = el.closest<HTMLElement>('a,button,div.geBtn,div.geBigButton') || el;
        if (btn.style.display !== 'none') {
          btn.style.setProperty('display', 'none', 'important');
        }
      });
    } catch { /* selector failed in this drawio build — keep walking */ }
  }
}

function injectEditorCustomisations(iframe: HTMLIFrameElement | null, readOnly: boolean) {
  const doc = iframe?.contentDocument;
  if (!doc) return;
  if (!doc.getElementById('fp-hide-ai-style')) {
    const style = doc.createElement('style');
    style.id = 'fp-hide-ai-style';
    style.textContent = HIDE_AI_CSS;
    doc.head?.appendChild(style);
  }
  // Readonly viewer (Monitor, Analyzer): also strip drawio editor chrome.
  if (readOnly && !doc.getElementById('fp-hide-chrome-style')) {
    const style = doc.createElement('style');
    style.id = 'fp-hide-chrome-style';
    style.textContent = HIDE_CHROME_CSS;
    doc.head?.appendChild(style);
  }
  hideAiElements(doc);

  // MutationObserver keeps the AI/status sweep running as draw.io lazy-
  // mounts more chrome (footer toolbar, comments panel, etc).
  const w = iframe?.contentWindow as unknown as { __fpAiObserver?: MutationObserver };
  if (w && !w.__fpAiObserver && typeof MutationObserver !== 'undefined') {
    let scheduled = false;
    const run = () => { scheduled = false; hideAiElements(doc); };
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(run, 200);
    });
    observer.observe(doc.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['title', 'aria-label', 'data-action'],
    });
    w.__fpAiObserver = observer;
  }

  // Belt-and-braces: drawio mounts AI/footer chrome lazily.
  [500, 1500, 3000].forEach((ms) => setTimeout(() => hideAiElements(doc), ms));
}

/** Cell status update for the live monitor overlay (§11-S7). Each entry
 *  maps an equipment id to a drawio style string fragment. fp-embed.js
 *  strips fillColor/strokeColor/fontColor from the existing style and
 *  applies the supplied fragment in their place. */
export interface FlowStatusUpdate {
  equipmentId: number;
  style: string;
}

interface Props {
  flowId: number;
  scope: TenantScope;
  readOnly?: boolean;
  /** Fired once the iframe responds to `init`. Monitor uses this to know
   *  when it's safe to start posting `paintStatus` updates. */
  onDiagramReady?: () => void;
  /** Live status overlay. When set, every change re-posts `paintStatus`
   *  to fp-embed.js inside the iframe. */
  statusUpdates?: FlowStatusUpdate[];
  /** Fires when the user clicks a cell inside the iframe. `equipmentId`
   *  is null when the click landed on empty canvas (used by Analyzer to
   *  clear its filter). */
  onCellClick?: (equipmentId: number | null) => void;
}

/** Imperative API the Designer page calls into to drive the iframe from
 *  the outer page chrome (Save button next to "Deactivate"). */
export interface FlowDesignerEditorHandle {
  /** Trigger drawio's save action inside the iframe. Same code path as
   *  clicking a drawio toolbar Save button — fires `event:'save'` back,
   *  which captures the XML + requests SVG export + PUTs both. */
  triggerSave: () => void;
}

const FlowDesignerEditor = forwardRef<FlowDesignerEditorHandle, Props>(function FlowDesignerEditor(
  { flowId, scope, readOnly = false, onDiagramReady, statusUpdates, onCellClick },
  ref,
) {
  const { message } = App.useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestXmlRef = useRef<string>('');
  // Two flags so we can tell apart the three reasons drawio might fire
  // `export`: (a) our explicit save asked for SVG, (b) we asked for an
  // export-as-download for the user, (c) drawio's own File → Export As.
  const isInternalSaveRef = useRef(false);
  const wantsSvgRef = useRef(false);
  // diagram ref keeps the message handler's view of flowData fresh
  // across re-renders without needing the effect to re-bind.
  const diagramRef = useRef<{ flowData: string | null } | null>(null);
  // Set true once the iframe replies to `init`. Until then any
  // `paintStatus` we post would race the editor and fp-embed.js' poll
  // loop (which works but is wasteful).
  const readyRef = useRef(false);
  // Latest pending status updates while the editor is still booting. The
  // `init` handshake flushes whatever sat in here.
  const pendingStatusRef = useRef<FlowStatusUpdate[] | null>(null);
  // Cell-click callback ref — kept fresh without re-binding the
  // postMessage listener every render.
  const onCellClickRef = useRef<typeof onCellClick>(onCellClick);
  useEffect(() => { onCellClickRef.current = onCellClick; }, [onCellClick]);

  const { data: diagram, isLoading: diagramLoading } = useFlowDesign(scope, flowId);
  useEffect(() => {
    diagramRef.current = diagram ? { flowData: diagram.flowData ?? null } : null;
  }, [diagram]);

  const postToIframe = (payload: object) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  };

  // ─── paintStatus pump ───────────────────────────────────────────────────
  // Whenever the status array changes, push it to the iframe. Before
  // the iframe has handshaken we stash the latest snapshot in
  // pendingStatusRef and let the init branch flush it.
  useEffect(() => {
    if (!statusUpdates || statusUpdates.length === 0) return;
    if (!readyRef.current) {
      pendingStatusRef.current = statusUpdates;
      return;
    }
    postToIframe({ action: 'paintStatus', updates: statusUpdates });
  }, [statusUpdates]);

  const requestSvgExport = () => {
    isInternalSaveRef.current = true;
    wantsSvgRef.current = true;
    postToIframe({ action: 'export', format: 'svg', spin: 'Saving…' });
  };

  // Reach into the iframe and trigger drawio's save action. The handler
  // for `event:'save'` (below) does the rest — capture XML, request SVG,
  // PUT both. Works because /draw_io/* is same-origin (served from the
  // same Next public folder), so contentWindow access is allowed.
  useImperativeHandle(ref, () => ({
    triggerSave: () => {
      const win = iframeRef.current?.contentWindow as unknown as {
        __editorUi?: { actions?: { get?: (n: string) => { funct?: () => void } | undefined } };
      } | null;
      win?.__editorUi?.actions?.get?.('save')?.funct?.();
    },
  }), []);

  // ─── postMessage handler ────────────────────────────────────────────────
  useEffect(() => {
    const saveXmlOnly = async (xml: string) => {
      if (!xml) return;
      try {
        await apiClient.put(`/admin/flow-designs/${flowId}/diagram`, { flowData: xml });
      } catch { /* autosave failures stay silent */ }
    };

    const saveXmlAndSvg = async (xml: string, svg: string | null) => {
      try {
        await apiClient.put(`/admin/flow-designs/${flowId}/diagram`, {
          flowData: xml,
          ...(svg ? { svgData: svg } : {}),
        });
        message.success('Flow saved');
        postToIframe({ action: 'status', message: '', modified: false });
      } catch {
        message.error('Save failed.');
      }
    };

    const downloadBlob = (data: string | undefined, format: string) => {
      if (!data) return;
      const baseName = 'flow';
      let blob: Blob;
      if (format === 'svg') {
        const svgContent = data.startsWith('data:') ? atob(data.split(',')[1] || '') : data;
        blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      } else if (format === 'xml' || format === 'drawio') {
        blob = new Blob([data], { type: 'application/xml;charset=utf-8' });
      } else {
        // png/jpeg/etc come back as data: URLs from drawio. Re-anchor as a link.
        const link = document.createElement('a');
        link.href = data;
        link.download = `${baseName}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.${format === 'xml' ? 'drawio' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      let msg: {
        event?: string; action?: string; xml?: string; data?: string;
        format?: string; equipmentId?: number | null;
      };
      try { msg = JSON.parse(event.data); } catch { return; }

      // 0) Cell click — fp-embed.js forwards drawio CLICK events. Used by
      //    Analyzer (§11-S8) to filter the charts/tables.
      if (msg.event === 'cellClick') {
        onCellClickRef.current?.(
          typeof msg.equipmentId === 'number' ? msg.equipmentId : null,
        );
        return;
      }

      // 1) INIT — drawio is ready; send the diagram XML back.
      if (msg.event === 'init') {
        const stored = diagramRef.current?.flowData;
        // Only feed drawio-shaped XML. If the row is blank or is legacy GoJS
        // JSON (left over from §11-S1 blanking) we send an empty diagram.
        const xml = (typeof stored === 'string' && stored.trimStart().startsWith('<'))
          ? stored
          : EMPTY_DIAGRAM_XML;
        postToIframe({ action: 'load', xml, autosave: readOnly ? 0 : 1 });
        readyRef.current = true;
        // Flush any status snapshot the Monitor pushed before init.
        if (pendingStatusRef.current && pendingStatusRef.current.length > 0) {
          postToIframe({ action: 'paintStatus', updates: pendingStatusRef.current });
          pendingStatusRef.current = null;
        }
        onDiagramReady?.();
        return;
      }

      // 2) Save button inside drawio. Capture XML, request SVG, then persist
      //    both via PUT /:id/diagram.
      if (msg.event === 'save') {
        if (readOnly) return;
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        latestXmlRef.current = typeof msg.xml === 'string' ? msg.xml : '';
        requestSvgExport();
        return;
      }

      // 3) Autosave timer fired inside drawio. Debounce 5s then write XML
      //    only (no SVG; thumbnail stays as-is per §11.7).
      if (msg.event === 'autosave') {
        if (readOnly) return;
        const xml = typeof msg.xml === 'string' ? msg.xml : '';
        if (!xml) return;
        latestXmlRef.current = xml;
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
          autosaveTimerRef.current = null;
          void saveXmlOnly(latestXmlRef.current);
        }, 5000);
        return;
      }

      // 4) Export — three branches: explicit-save SVG, user-file-download,
      //    or stray (ignore).
      if (msg.event === 'export') {
        const wasInternal = isInternalSaveRef.current;
        const wasSvgRequest = wantsSvgRef.current;
        isInternalSaveRef.current = false;
        wantsSvgRef.current = false;
        const format = typeof msg.format === 'string' ? msg.format.toLowerCase() : 'png';

        if (wasInternal && wasSvgRequest && format === 'svg') {
          const raw = typeof msg.data === 'string' ? msg.data : '';
          const svg = raw.startsWith('data:')
            ? (() => { try { return atob(raw.split(',')[1] || ''); } catch { return raw; } })()
            : raw;
          void saveXmlAndSvg(latestXmlRef.current, svg || null);
          return;
        }
        if (!wasInternal) {
          downloadBlob(msg.data, format);
        }
        return;
      }

      // 5) Save-As dialog request — for v1 we treat as a plain save (no
      //    rename in the editor; the page wrapper owns the name).
      if (msg.event === 'showSaveDialog') {
        if (readOnly) return;
        latestXmlRef.current = typeof msg.xml === 'string' ? msg.xml : '';
        requestSvgExport();
        return;
      }

      // 6) Share / import / exit — explicitly ignored per §11.4 (Plan B v1
      //    has no team sharing; the import dialog isn't shown because the
      //    iframe URL params disable the Import button).
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [flowId, readOnly, onDiagramReady, message]);

  // ─── render ─────────────────────────────────────────────────────────────
  if (diagramLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin size="large" tip="Loading editor…" />
      </div>
    );
  }

  // Note: we deliberately avoid drawio's `lightbox=1&chrome=0` viewer
  // mode here. That path uses a synchronous bootstrap that skips the
  // EditorUi.createUi hook over-ride.js uses to expose __editorUi, so
  // our paintStatus / cellClick forwarders never arm. Instead we use
  // the regular embed bootstrap and call graph.setEnabled(false) inside
  // the onLoad callback to lock editing.
  const iframeSrc = '/draw_io/index.html?embed=1&proto=json&spin=1&noExitBtn=1&noSaveBtn=1&sketch=1&ui=sketch';

  // Drop handling lives inside the iframe (fp-embed.js) — the iframe's
  // document consumes drop events before they can bubble to a parent-
  // window React handler. The equipment row's onDragStart still sets
  // dataTransfer; fp-embed.js reads `application/fp-equipment` in
  // capture-phase dragover/drop listeners.

  return (
    <div
      data-testid="flow-designer-editor"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
          <Spin size="large" tip="Loading Editor…" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Flow Designer"
        onLoad={() => {
          setLoading(false);
          injectEditorCustomisations(iframeRef.current, readOnly);
          if (readOnly) {
            // Belt-and-braces: lock the graph + nuke every edit affordance
            // drawio mounts (Format panel, shape picker, popup menu, etc.).
            // CSS alone isn't enough — drawio re-shows these on click, and
            // the Format panel widens the chrome container which squeezes
            // the diagram. Calling toggleFormatPanel(false) drops its
            // width to 0 and refresh() re-lays-out the editor.
            type ReadonlyDrawioUi = {
              editor?: {
                graph?: {
                  setEnabled?: (b: boolean) => void;
                  popupMenuHandler?: { setEnabled?: (b: boolean) => void };
                  panningHandler?: { useLeftButtonForPanning?: boolean };
                };
              };
              formatWidth?: number;
              toggleFormatPanel?: (visible: boolean) => void;
              toggleOutline?: () => void;
              refresh?: () => void;
              format?: { panel?: { setVisible?: (b: boolean) => void } };
              outline?: { destroy?: () => void };
              sidebar?: { container?: HTMLElement };
            };
            const tryLock = () => {
              try {
                const ui = (iframeRef.current?.contentWindow as unknown as {
                  __editorUi?: ReadonlyDrawioUi;
                })?.__editorUi;
                const graph = ui?.editor?.graph;
                if (!graph?.setEnabled) return false;
                graph.setEnabled(false);
                // Kill the right-click context menu (mxPopupMenu).
                graph.popupMenuHandler?.setEnabled?.(false);
                // Drop the Format panel — it lives in a fixed-width column
                // on the right of the diagram. formatWidth=0 + refresh()
                // collapses it and `toggleFormatPanel(false)` removes the
                // drawer.
                if (ui) {
                  ui.formatWidth = 0;
                  try { ui.toggleFormatPanel?.(false); } catch { /* not in this UI mode */ }
                  try { ui.refresh?.(); } catch { /* layout already current */ }
                  // Sidebar lives in a separate container — hide it manually
                  // (CSS-only hides the visual but leaves layout reservation).
                  if (ui.sidebar?.container?.style) {
                    ui.sidebar.container.style.display = 'none';
                  }
                }
                return true;
              } catch { /* drawio not yet ready */ }
              return false;
            };
            if (!tryLock()) {
              let n = 0;
              const t = setInterval(() => {
                if (tryLock() || ++n > 30) clearInterval(t);
              }, 200);
            }
          }
        }}
      />
    </div>
  );
});

export default FlowDesignerEditor;
