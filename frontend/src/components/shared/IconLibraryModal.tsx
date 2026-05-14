'use client';

import { Alert, Button, Input, Modal, Spin, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { toApiError } from '../../lib/api-client';
import { useIcons } from '../../lib/api/icons';

const { Text } = Typography;

interface Props {
  open: boolean;
  onSelect: (filename: string) => void;
  onClose: () => void;
}

export default function IconLibraryModal({ open, onSelect, onClose }: Props) {
  const { data: icons, isLoading, isError, error } = useIcons();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return icons ?? [];
    return (icons ?? []).filter((i) => i.name.toLowerCase().includes(q));
  }, [icons, search]);

  return (
    <Modal
      open={open}
      title="Choose icon"
      onCancel={onClose}
      footer={
        <Button danger onClick={onClose}>Close</Button>
      }
      destroyOnClose
      width={520}
    >
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        Search&nbsp;
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200, display: 'inline-block' }}
          autoFocus
        />
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', borderTop: '1px solid #eee' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load icons"
            description={toApiError(error).message}
            style={{ margin: 12 }}
          />
        ) : (icons?.length ?? 0) === 0 ? (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 40 }}>
            Library is empty.
          </Text>
        ) : filtered.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 40 }}>
            No icons match &quot;{search}&quot;.
          </Text>
        ) : (
          filtered.map((icon) => (
            <div
              key={icon.filename}
              onClick={() => onSelect(icon.filename)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Plain <img> — next/image with unoptimized still gates rendering
                  on width/height props in ways that hid these icons. */}
              <img src={icon.url} alt={icon.name} width={32} height={32} style={{ objectFit: 'contain' }} />
              <Text>{icon.name}</Text>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
