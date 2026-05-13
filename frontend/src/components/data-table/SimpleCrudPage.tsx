'use client';

import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tooltip } from 'antd';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../lib/api-client';
import {
  BaseListParams,
  ListResponse,
  TenantScope,
} from '../../lib/api/admin-crud';
import { DataTablePage, DataTableColumn } from './DataTablePage';

/**
 * Predicate evaluated against the current form values to decide whether a
 * field is rendered. Used by the Types form (kind / exclude_type visible
 * only for some entity values).
 */
type VisibleWhen = (values: Record<string, unknown>) => boolean;

export type SimpleField =
  | { name: string; label: string; type: 'text'; required?: boolean; maxLength?: number; placeholder?: string; visibleWhen?: VisibleWhen }
  | { name: string; label: string; type: 'textarea'; required?: boolean; maxLength?: number; rows?: number; visibleWhen?: VisibleWhen }
  | { name: string; label: string; type: 'number'; required?: boolean; min?: number; max?: number; step?: number; visibleWhen?: VisibleWhen }
  | { name: string; label: string; type: 'time'; required?: boolean; visibleWhen?: VisibleWhen }
  | { name: string; label: string; type: 'switch'; defaultChecked?: boolean; visibleWhen?: VisibleWhen }
  | {
      name: string;
      label: string;
      type: 'select';
      required?: boolean;
      options: Array<{ value: string | number; label: string }>;
      /** Dynamic options: when set, overrides `options` based on current form values. */
      optionsWhen?: (values: Record<string, unknown>) => Array<{ value: string | number; label: string }>;
      visibleWhen?: VisibleWhen;
    }
  | {
      /**
       * Multi-select rendered as a Checkbox.Group. The form value is an
       * array of option values on the wire; `toFormValues`/submit handlers
       * may serialise to/from a CSV string when the backend column requires
       * one (e.g. `work_shifts.working_days` stores "1,2,3,4,5").
       */
      name: string;
      label: string;
      type: 'checkbox-group';
      required?: boolean;
      options: Array<{ value: string | number; label: string }>;
      /**
       * Optional: when present, the field value is serialised to/from a
       * delimited string on submit/load. Used for backends that store the
       * selection in a single text column.
       */
      csv?: { separator?: string };
      visibleWhen?: VisibleWhen;
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
      // Serialise CSV-backed checkbox-group fields into a single string,
      // matching the backend column shape.
      const payload: Record<string, unknown> = { ...values };
      for (const f of fields) {
        if (f.type === 'checkbox-group' && f.csv) {
          const arr = payload[f.name];
          if (Array.isArray(arr)) {
            payload[f.name] = arr.join(f.csv.separator ?? ',');
          }
        }
      }
      setSubmitting(true);
      if (isEdit && editing) {
        await update.mutateAsync({ id: editing.id, input: payload });
        message.success(`${resourceLabel} updated.`);
      } else {
        await create.mutateAsync(payload);
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
          <ConditionalFields form={form} fields={fields} />
        </Form>
      </Modal>
    </>
  );
}

/**
 * Renders form items with conditional `visibleWhen` / dynamic `optionsWhen`
 * support. Watches every field referenced by these predicates (cheap — the
 * Form's getFieldsValue() is O(n) in form size and runs once per render).
 */
function ConditionalFields({
  form,
  fields,
}: {
  form: import('antd/es/form').FormInstance;
  fields: SimpleField[];
}) {
  // Form.useWatch returns a snapshot of all form values. Re-reading on every
  // change here lets visibleWhen / optionsWhen react to user input.
  const values = (Form.useWatch([], form) ?? {}) as Record<string, unknown>;

  return (
    <>
      {fields.map((f) => {
        if (f.visibleWhen && !f.visibleWhen(values)) return null;
        return (
          <Form.Item
            key={f.name}
            name={f.name}
            label={f.label}
            valuePropName={f.type === 'switch' ? 'checked' : 'value'}
            rules={fieldRules(f)}
          >
            {renderField(f, values)}
          </Form.Item>
        );
      })}
    </>
  );
}

function renderField(f: SimpleField, values: Record<string, unknown>): ReactNode {
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
    case 'select': {
      const options = f.optionsWhen ? f.optionsWhen(values) : f.options;
      return <Select options={options} allowClear />;
    }
    case 'checkbox-group':
      return <Checkbox.Group options={f.options} />;
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
  if (f.type === 'checkbox-group' && f.required) {
    rules.push({
      validator: (_: unknown, value: unknown) =>
        Array.isArray(value) && value.length > 0
          ? Promise.resolve()
          : Promise.reject(new Error(`${f.label} is required`)),
    });
  }
  return rules;
}
