'use client';

import { App, Button, Space, Upload } from 'antd';
import { useState } from 'react';
import IconLibraryModal from './IconLibraryModal';
import { uploadIcon } from '../../lib/api/icons';

interface Props {
  /** Filename (without leading slash). AntD Form passes/reads this via value/onChange. */
  value?: string;
  onChange?: (filename: string) => void;
  disabled?: boolean;
}

/**
 * Icon picker matching the legacy "Choose file / Choose from library"
 * affordance. Used in Type Management and the Equipment edit form. Plays
 * well with AntD <Form.Item> — implements the value/onChange contract.
 */
export default function IconPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { message } = App.useApp();

  return (
    <>
      <Space direction="vertical" size={6}>
        {value && (
          <Space size={8}>
            <img
              src={`/equipment-icons/${value}`}
              alt={value}
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
            />
            <span style={{ fontSize: 12, color: '#666' }}>{value}</span>
          </Space>
        )}
        <Space wrap>
          <Upload
            accept="image/*"
            showUploadList={false}
            disabled={disabled}
            beforeUpload={async (file) => {
              setUploading(true);
              try {
                const filename = await uploadIcon(file);
                onChange?.(filename);
                message.success(`Uploaded ${filename}`);
              } catch (err) {
                const e = err instanceof Error ? err.message : 'Upload failed';
                message.error(e);
              } finally {
                setUploading(false);
              }
              return false; // prevent AntD's auto-upload
            }}
          >
            <Button loading={uploading} disabled={disabled}>Choose file</Button>
          </Upload>
          <Button
            disabled={disabled}
            onClick={() => setOpen(true)}
            style={{ background: '#00b4d8', color: 'white', borderColor: '#00b4d8' }}
          >
            Choose from library
          </Button>
          {value && (
            <Button size="small" disabled={disabled} onClick={() => onChange?.('')}>
              Clear
            </Button>
          )}
        </Space>
      </Space>
      <IconLibraryModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(filename) => { onChange?.(filename); setOpen(false); }}
      />
    </>
  );
}
