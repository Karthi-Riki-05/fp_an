'use client';

import { CopyOutlined, DeleteOutlined, DesktopOutlined } from '@ant-design/icons';
import { App, Button, Modal, Spin, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';

const { Text, Paragraph } = Typography;

interface AndonToken {
  id: string;
  flowId: number;
  token: string;
  label: string | null;
  url: string;
}

/**
 * Admin-only affordance on the Flow Monitor: generate / show / revoke a signed
 * Andon TV-board link for the currently-selected flow (Sprint 3 / Task 1).
 * Reads the active flowId from the [[...id]] catch-all route.
 */
export function AndonTvLinkButton() {
  const params = useParams<{ id?: string[] }>();
  const flowId = Number(params?.id?.[0]) || 0;

  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<AndonToken | null>(null);

  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await apiClient.get<AndonToken[]>('/admin/andon-tokens');
      setToken(data.find((t) => t.flowId === flowId) ?? null);
    } catch {
      message.error('Could not load TV links.');
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const { data } = await apiClient.post<AndonToken>('/admin/andon-tokens', {
        flowId, label: `Flow ${flowId} TV`,
      });
      setToken(data);
      message.success('TV link generated.');
    } catch {
      message.error('Could not generate link.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/andon-tokens/${token.id}`);
      setToken(null);
      message.success('TV link revoked.');
    } catch {
      message.error('Could not revoke link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.url);
      message.success('Copied to clipboard.');
    } catch {
      message.error('Copy failed — select and copy manually.');
    }
  };

  return (
    <>
      <Button
        icon={<DesktopOutlined />}
        onClick={openModal}
        disabled={!flowId}
        title={flowId ? 'Generate a wall-display TV link' : 'Select a flow first'}
      >
        Generate TV Link
      </Button>

      <Modal
        open={open}
        title="Andon TV Link"
        onCancel={() => setOpen(false)}
        footer={null}
        width={420}
      >
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spin /></div>
        ) : !token ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Paragraph type="secondary">
              No TV link exists for flow #{flowId} yet. Generate one to display this flow
              on a wall-mounted screen — no login required on the TV.
            </Paragraph>
            <Button type="primary" loading={busy} onClick={generate}>Generate link</Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: 16, display: 'inline-block', borderRadius: 8, border: '1px solid #eef0f3' }}>
              <QRCodeSVG value={token.url} size={180} includeMargin={false} />
            </div>
            <Paragraph
              copyable={{ text: token.url, tooltips: false }}
              style={{ marginTop: 16, wordBreak: 'break-all', fontSize: 12, background: '#f5f7fa', padding: '8px 10px', borderRadius: 6 }}
            >
              <Text>{token.url}</Text>
            </Paragraph>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              <Button icon={<CopyOutlined />} onClick={copy}>Copy</Button>
              <Button danger icon={<DeleteOutlined />} loading={busy} onClick={revoke}>Revoke</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
