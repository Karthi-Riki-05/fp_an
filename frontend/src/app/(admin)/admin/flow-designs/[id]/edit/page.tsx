'use client';

import { ArrowLeftOutlined, FileImageOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Input, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GoJsLicensePlaceholder from '../../../../../../components/flow/GoJsLicensePlaceholder';
import { useMe } from '../../../../../../lib/api/auth';
import {
  useFlowDesign,
  useToggleFlowDesignStatus,
  useUpdateFlowDesign,
} from '../../../../../../lib/api/flow-designs';

const { Title } = Typography;

/**
 * Flow Designer page. Plan A renders a GoJsLicensePlaceholder where the
 * canvas would go. Editable flow-name + status toggle work today; the
 * canvas + background-image + save toolbar buttons activate when
 * NEXT_PUBLIC_GOJS_LICENSE_KEY is set (Plan B).
 */
export default function FlowDesignerPage() {
  const params = useParams<{ id: string }>();
  const flowId = params?.id ? Number(params.id) : null;
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };

  const flowQ = useFlowDesign(scope, flowId);
  const updateMut = useUpdateFlowDesign(scope);
  const toggleMut = useToggleFlowDesignStatus(scope);

  const [name, setName] = useState('');
  useEffect(() => { if (flowQ.data?.name) setName(flowQ.data.name); }, [flowQ.data?.name]);

  const hasLicense = !!process.env.NEXT_PUBLIC_GOJS_LICENSE_KEY;

  if (flowQ.isLoading) return <Skeleton active />;
  if (!flowQ.data) return <div>Flow not found.</div>;

  const isActive = flowQ.data.status === 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Space size="middle">
          <Link href="/admin/flow-designs" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
            <ArrowLeftOutlined />
          </Link>
          <Title level={3} style={{ margin: 0 }}>Flow Designer</Title>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              if (!flowId || name === flowQ.data?.name) return;
              try {
                await updateMut.mutateAsync({ id: flowId, input: { name } });
                message.success('Flow name updated.');
              } catch { message.error('Could not save name.'); }
            }}
            style={{ width: 260 }}
            placeholder="Flow name"
          />
          <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'active' : 'inactive'}</Tag>
        </Space>

        <Space>
          <Tooltip title={hasLicense ? 'Save the diagram' : 'GoJS license required to save'}>
            <Button icon={<SaveOutlined />} disabled={!hasLicense}>Save</Button>
          </Tooltip>
          <Tooltip title={hasLicense ? 'Upload a background image' : 'GoJS license required'}>
            <Button icon={<FileImageOutlined />} disabled={!hasLicense}>Background</Button>
          </Tooltip>
          <Button
            onClick={async () => {
              if (!flowId) return;
              try {
                await toggleMut.mutateAsync(flowId);
                message.success(isActive ? 'Flow deactivated.' : 'Flow activated.');
              } catch { message.error('Could not toggle status.'); }
            }}
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      </div>

      {/* Canvas slot. Plan B replaces this with the real GoJS component. */}
      <GoJsLicensePlaceholder width="100%" height="calc(100vh - 220px)" />
    </div>
  );
}
