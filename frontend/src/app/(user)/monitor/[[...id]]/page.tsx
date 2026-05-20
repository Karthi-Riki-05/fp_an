'use client';

import { ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import { Button, Card, Select, Space, Typography } from 'antd';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import EquipmentRegistrationModal from '../../../../components/flow/EquipmentRegistrationModal';
import FlowCardGrid from '../../../../components/flow/FlowCardGrid';
import FlowDesignerEditor, { type FlowStatusUpdate } from '../../../../components/flow/FlowDesignerEditor';
import { useMe } from '../../../../lib/api/auth';
import { useFlowDesignsList } from '../../../../lib/api/monitor';
import { useFlowDesignsList as useFlowDesignsListV2, useFlowMonitorStatus } from '../../../../lib/api/flow-designs';

const { Title } = Typography;

/**
 * Map `flow_monitor_status.runningStatus` onto a drawio style fragment
 * that fp-embed.js splices into the cell's existing style (replacing
 * fillColor/strokeColor/fontColor only).
 */
function statusToStyle(runningStatus: string | null | undefined): string {
  // Backend `running_status` enum is `on` / `off` (see MachineRunningStatus).
  // Accept the friendlier names too for forwards-compat if the enum grows.
  switch ((runningStatus ?? '').toLowerCase()) {
    case 'on':
    case 'running': return 'fillColor=#d4edda;strokeColor=#28a745;fontColor=#1a4d1f;';
    case 'off':
    case 'stopped': return 'fillColor=#f8d7da;strokeColor=#dc3545;fontColor=#5a1820;';
    case 'idle':    return 'fillColor=#e9ecef;strokeColor=#6c757d;fontColor=#333333;';
    case 'warning': return 'fillColor=#fff3cd;strokeColor=#ffc107;fontColor=#5a4500;';
    case 'offline': return 'fillColor=#e2e3e5;strokeColor=#6c757d;fontColor=#383d41;';
    default:        return 'fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1a1a2e;';
  }
}

/**
 * This page is mounted at BOTH /monitor (user shell) and /admin/monitor
 * (admin shell, via a re-export). Use the current pathname to decide
 * which set of internal links to render so navigation stays inside the
 * same shell the user came from.
 */
function useRouteBases() {
  const pathname = usePathname() ?? '';
  const inAdmin = pathname.startsWith('/admin/');
  return {
    monitorRoute: inAdmin ? '/admin/monitor' : '/monitor',
    dashboardRoute: inAdmin ? '/admin/dashboard' : '/dashboard',
  };
}

function FlowMonitorGrid() {
  const router = useRouter();
  const { data: me } = useMe();
  const { monitorRoute, dashboardRoute } = useRouteBases();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const gridFlows = useFlowDesignsListV2(scope);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={dashboardRoute} aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={3} style={{ margin: 0 }}>Flow Monitor</Title>
      </div>
      <FlowCardGrid
        flows={gridFlows.data ?? []}
        onFlowClick={(id) => router.push(`${monitorRoute}/${id}`)}
        title={`${gridFlows.data?.length ?? 0} active flow${(gridFlows.data?.length ?? 0) === 1 ? '' : 's'}`}
      />
    </div>
  );
}

function FlowMonitorDetail({ initialFlowId }: { initialFlowId: number }) {
  const { data: me } = useMe();
  const { dashboardRoute } = useRouteBases();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };

  // Real flow list from /api/v1/admin/flow-designs (B1.4).
  const { data: flows, isLoading: flowsLoading } = useFlowDesignsList(tenantId);
  const [flowId, setFlowId] = useState<number | null>(initialFlowId);
  // Live monitor status (ETag-cached on the server, polled every 10s).
  // Mapped to drawio style fragments and pushed into the readOnly editor
  // iframe via paintStatus — see fp-embed.js §11-S7.
  const monitorStatusQ = useFlowMonitorStatus(scope, flowId);
  const statusUpdates: FlowStatusUpdate[] = (monitorStatusQ.data ?? []).map((row) => ({
    equipmentId: row.equipmentId,
    style: statusToStyle(row.runningStatus),
  }));

  // Default the flow Select to the first active flow once it loads.
  useEffect(() => {
    if (flows && flows.length > 0 && flowId === null) {
      setFlowId(flows[0].id);
    }
  }, [flows, flowId]);

  // Set by FlowDesignerEditor's onCellClick (fp-embed.js forwards drawio
  // CLICK events as `equipmentId`, null when the user clicks empty canvas).
  // Drives the 4-step EquipmentRegistrationModal below.
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // When the flow changes, drop the selection so a stale equipment id
  // doesn't bleed into the next modal session.
  useEffect(() => { setSelectedEquipmentId(null); setModalOpen(false); }, [flowId]);

  const equipmentName = selectedEquipmentId != null ? `Equipment #${selectedEquipmentId}` : '';

  // A click on a real equipment cell opens the registration modal.
  // Empty-canvas clicks (`equipmentId == null`) clear selection but don't
  // open anything.
  const handleCellClick = (eid: number | null) => {
    setSelectedEquipmentId(eid);
    if (eid != null) setModalOpen(true);
  };

  return (
    <div>
      {/* page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <Space size="middle">
          <Link href={dashboardRoute} aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
            <ArrowLeftOutlined />
          </Link>
          <Title level={3} style={{ margin: 0 }}>Flow Monitor</Title>
        </Space>
        <Space wrap>
          <Select
            value={flowId ?? undefined}
            onChange={setFlowId}
            placeholder="Select flow"
            loading={flowsLoading}
            style={{ minWidth: 220 }}
            options={(flows ?? []).map((f) => ({ value: f.id, label: f.name }))}
            aria-label="Select flow"
            notFoundContent={flowsLoading ? 'Loading…' : 'No active flows'}
          />
          <Button icon={<FileExcelOutlined />}>Export</Button>
        </Space>
      </div>

      {/* Full-bleed read-only canvas — no side panel, no KPI strip.
          Equipment registration happens via the click → 4-step modal
          flow (Task 2, in progress). Height fills the viewport minus
          the shell chrome (header + back-row + safety margin). */}
      <Card styles={{ body: { padding: 0, height: 'calc(100vh - 200px)', minHeight: 480 } }}>
        {flowId ? (
          <FlowDesignerEditor
            flowId={flowId}
            scope={scope}
            readOnly
            statusUpdates={statusUpdates}
            onCellClick={handleCellClick}
          />
        ) : null}
      </Card>

      <EquipmentRegistrationModal
        open={modalOpen}
        flowId={flowId}
        equipmentId={selectedEquipmentId}
        equipmentName={equipmentName}
        tenantId={tenantId}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

// Top-level page: switch between the card grid and the detail view based
// on the URL. The catch-all route segment `[[...id]]` makes /monitor and
// /monitor/<id> hit the same file.
export default function FlowMonitorPage() {
  const routeParams = useParams<{ id?: string[] }>();
  const urlFlowId = routeParams?.id?.[0] ? Number(routeParams.id[0]) : null;
  if (urlFlowId === null) return <FlowMonitorGrid />;
  return <FlowMonitorDetail initialFlowId={urlFlowId} />;
}
