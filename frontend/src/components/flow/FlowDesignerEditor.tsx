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
import { useEffect, useRef, useState } from 'react';
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

function injectEditorCustomisations(iframe: HTMLIFrameElement | null) {
  const doc = iframe?.contentDocument;
  if (!doc) return;
  if (!doc.getElementById('fp-hide-ai-style')) {
    const style = doc.createElement('style');
    style.id = 'fp-hide-ai-style';
    style.textContent = HIDE_AI_CSS;
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

interface Props {
  flowId: number;
  scope: TenantScope;
  readOnly?: boolean;
  /** Fired once the iframe responds to `init`. Monitor uses this to know
   *  when it's safe to start posting `paintStatus` updates. */
  onDiagramReady?: () => void;
}

export default function FlowDesignerEditor({ flowId, scope, readOnly = false, onDiagramReady }: Props) {
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

  const { data: diagram, isLoading: diagramLoading } = useFlowDesign(scope, flowId);
  useEffect(() => {
    diagramRef.current = diagram ? { flowData: diagram.flowData ?? null } : null;
  }, [diagram]);

  const postToIframe = (payload: object) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  };

  const requestSvgExport = () => {
    isInternalSaveRef.current = true;
    wantsSvgRef.current = true;
    postToIframe({ action: 'export', format: 'svg', spin: 'Saving…' });
  };

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
      let msg: { event?: string; action?: string; xml?: string; data?: string; format?: string };
      try { msg = JSON.parse(event.data); } catch { return; }

      // 1) INIT — drawio is ready; send the diagram XML back.
      if (msg.event === 'init') {
        const stored = diagramRef.current?.flowData;
        // Only feed drawio-shaped XML. If the row is blank or is legacy GoJS
        // JSON (left over from §11-S1 blanking) we send an empty diagram.
        const xml = (typeof stored === 'string' && stored.trimStart().startsWith('<'))
          ? stored
          : EMPTY_DIAGRAM_XML;
        postToIframe({ action: 'load', xml, autosave: readOnly ? 0 : 1 });
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

  const iframeSrc = readOnly
    ? '/draw_io/index.html?embed=1&proto=json&spin=1&noExitBtn=1&noSaveBtn=1&sketch=1&ui=sketch&lightbox=1&chrome=0&edit=_blank&toolbar=0&nav=1'
    : '/draw_io/index.html?embed=1&proto=json&spin=1&noExitBtn=1&noSaveBtn=1&sketch=1&ui=sketch';

  /**
   * Drop handler for the iframe wrapper. The Designer page renders the
   * equipment tree as native HTML5 draggables; on drop here we read the
   * JSON payload, compute the canvas-relative position, and post
   * `insertNode` to the drawio iframe. fp-embed.js inside the iframe
   * does the actual graph.insertVertex().
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // The drop is only valid if the source set our payload.
    const types = e.dataTransfer.types;
    if (types && types.indexOf('application/fp-equipment') !== -1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const raw = e.dataTransfer.getData('application/fp-equipment');
    if (!raw) return;
    e.preventDefault();
    let payload: { equipmentId?: number; equipmentName?: string };
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload || !payload.equipmentId) return;

    // Coordinates relative to the iframe wrapper. fp-embed.js inserts
    // the cell at these graph-document coordinates — close enough for
    // v1 (drawio's own toolbar-drag uses transformViewToDoc for pixel-
    // perfect placement; we can polish later if it bothers users).
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const y = Math.max(0, e.clientY - rect.top);

    postToIframe({
      action: 'insertNode',
      equipmentId: payload.equipmentId,
      label: payload.equipmentName || `Equipment #${payload.equipmentId}`,
      x, y,
    });
  };

  return (
    <div
      data-testid="flow-designer-editor"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
          injectEditorCustomisations(iframeRef.current);
          if (readOnly) {
            // Belt-and-braces: also flip graph.setEnabled(false) once the
            // editor is ready so any edit gesture is blocked even if a
            // lightbox URL param is missed.
            const tryLock = () => {
              try {
                const ui = (iframeRef.current?.contentWindow as unknown as {
                  __editorUi?: { editor?: { graph?: { setEnabled?: (b: boolean) => void } } };
                })?.__editorUi;
                if (ui?.editor?.graph?.setEnabled) {
                  ui.editor.graph.setEnabled(false);
                  return true;
                }
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
}
