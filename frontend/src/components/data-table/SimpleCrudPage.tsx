'use client';

import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tooltip } from 'antd';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../lib/api-client';
import {
  BaseListParams,
  ListResponse,
  TenantScope,
} from '../../lib/api/admin-crud';
import { DataTablePage, DataTableColumn } from './DataTablePage';

export type SimpleField =
  | { name: string; label: string; type: 'text'; required?: boolean; maxLength?: number; placeholder?: string }
  | { name: string; label: string; type: 'textarea'; required?: boolean; maxLength?: number; rows?: number }
  | { name: string; label: string; type: 'number'; required?: boolean; min?: number; max?: number; step?: number }
  | { name: string; label: string; type: 'time'; required?: boolean }
  | { name: string; label: string; type: 'switch'; defaultChecked?: boolean }
  | {
      name: string;
      label: string;
      type: 'select';
      required?: boolean;
      options: Array<{ value: string | number; label: string }>;
    };

export interface SimpleCrudPageProps<TRow extends { id: number }> {
  cardTitle: string;
  addButtonLabel: string;
  resourceLabel: string;
  scope: TenantScope;

  /** TanStack Query hooks for this resource. */
  hooks: {
    useList: (scope: TenantScope, params: BaseListParams) => { data?: ListResponse<TRow>; isFetching: boolean };
    useCreate: (scope: TenantScope) => { mutateAsync: (input: any) => Promise<TRow> };
    useUpdate: (scope: TenantScope) => { mutateAsync: (args: { id: number; input: any }) => Promise<TRow> };
    useRemove: (scope: TenantScope) => { mutateAsync: (id: number) => Promise<void> };
  };

  columns: DataTableColumn<TRow>[];
  fields: SimpleField[];

  /** Map row → form values for edit. Defaults to passing the row through. */
  toFormValues?: (row: TRow) => Record<string, unknown>;

  /** Default form values for "Add". */
  defaultValues?: Record<string, unknown>;
}

export function SimpleCrudPage<TRow extends { id: number }>(props: SimpleCrudPageProps<TRow>) {
  const { hooks, scope, fields, columns, cardTitle, addButtonLabel, resourceLabel } = props;
  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const params = useMemo<BaseListParams>(() => {
    const p: BaseListParams = { page, perPage, sort: 'id', order: 'desc' };
    if (search) p.search = search;
    if (columnFilters.name) p.name = columnFilters.name;
    return p;
  }, [page, perPage, search, columnFilters]);

  const { data, isFetching } = hooks.useList(scope, params);
  const create = hooks.useCreate(scope);
  const update = hooks.useUpdate(scope);
  const remove = hooks.useRemove(scope);

  const isEdit = editing !== null;
  const modalOpen = createOpen || isEdit;

  useEffect(() => {
    if (!modalOpen) return;
    if (isEdit && editing) {
      const values = props.toFormValues ? props.toFormValues(editing) : (editing as unknown as Record<string, unknown>);
      form.setFieldsValue(values);
    } else {
      form.resetFields();
      if (props.defaultValues) form.setFieldsValue(props.defaultValues);
    }
  }, [modalOpen, editing, isEdit, form, props]);

  const closeModal = () => {
    setCreateOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (isEdit && editing) {
        await update.mutateAsync({ id: editing.id, input: values });
        message.success(`${resourceLabel} updated.`);
      } else {
        await create.mutateAsync(values);
        message.success(`${resourceLabel} created.`);
      }
      closeModal();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return; // antd validation
      const e = toApiError(err);
      message.error(e.message || 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      message.success(`${resourceLabel} deleted.`);
    } catch (err) {
      message.error(toApiError(err).message || 'Delete failed.');
    }
  };

  const actionColumn: DataTableColumn<TRow> = {
    id: 'actions',
    title: 'Actions',
    width: 130,
    align: 'center' as const,
    render: (_: unknown, row: TRow) => (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <Tooltip title="View">
          <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#01b9d0' }} />}
            onClick={() => setEditing(row)} />
        </Tooltip>
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />}
            onClick={() => setEditing(row)} />
        </Tooltip>
        <Popconfirm
          title={`Delete this ${resourceLabel.toLowerCase()}?`}
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(row.id)}
        >
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </span>
    ),
  };

  return (
    <>
      <DataTablePage<TRow>
        cardTitle={cardTitle}
        actions={
          <Button
            type="text"
            icon={<PlusOutlined style={{ color: '#01b9d0' }} />}
            onClick={() => setCreateOpen(true)}
            style={{ color: '#01b9d0', fontWeight: 600 }}
          >
            {addButtonLabel}
          </Button>
        }
        rows={data?.data ?? []}
        rowKey="id"
        loading={isFetching}
        total={data?.total ?? 0}
        page={page}
        pageSize={perPage}
        onPageChange={(p, ps) => {
          setPage(p);
          setPerPage(ps);
        }}
        search={search}
        onSearchChange={(s) => {
          setSearch(s);
          setPage(1);
        }}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => {
          setColumnFilters(f);
          setPage(1);
        }}
        columns={[...columns, actionColumn]}
        emptyText={
          search || Object.values(columnFilters).some(Boolean)
            ? 'No entries match your filters.'
            : `No ${resourceLabel.toLowerCase()} entries yet.`
        }
      />

      <Modal
        open={modalOpen}
        title={isEdit ? `Edit ${resourceLabel}` : `Add ${resourceLabel}`}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={isEdit ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        maskClosable={false}
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          {fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              valuePropName={f.type === 'switch' ? 'checked' : 'value'}
              rules={fieldRules(f)}
            >
              {renderField(f)}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
}

function renderField(f: SimpleField): ReactNode {
  switch (f.type) {
    case 'text':
      return <Input maxLength={f.maxLength} placeholder={f.placeholder} />;
    case 'textarea':
      return <Input.TextArea rows={f.rows ?? 3} maxLength={f.maxLength} />;
    case 'number':
      return <InputNumber min={f.min} max={f.max} step={f.step ?? 1} style={{ width: '100%' }} />;
    case 'time':
      return <Input placeholder="HH:MM" />;
    case 'switch':
      return <Switch />;
    case 'select':
      return <Select options={f.options} allowClear />;
  }
}

function fieldRules(f: SimpleField) {
  const rules: Array<Record<string, unknown>> = [];
  if (f.type !== 'switch' && (f as { required?: boolean }).required) {
    rules.push({ required: true, message: `${f.label} is required` });
  }
  if (f.type === 'time') {
    rules.push({
      pattern: /^([01]\d|2[0-3]):[0-5]\d$/,
      message: 'Use HH:MM (24-hour)',
    });
  }
  return rules;
}
