'use client';

import {
  App,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiClient, toApiError } from '../../lib/api-client';
import { salaryGroupsApi, typesApi, type TenantScope } from '../../lib/api/admin-crud';
import {
  useCreateEquipment,
  useEquipmentDetail,
  useEquipmentProperties,
  useReplaceEquipmentProperties,
  useUpdateEquipment,
  type EquipmentPropertyRow,
} from '../../lib/api/equipment';
import IconPicker from '../shared/IconPicker';
import EquipmentPropertiesPanel from './EquipmentPropertiesPanel';
import { EquipmentTreeSelect } from './EquipmentTreeSelect';

interface ShiftScheduleRow {
  id: number;
  name: string | null;
  status: number;
}

interface EquipmentFormValues {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive: boolean;
  reasonStopTypeIds: number[];
  reasonScrapTypeIds: number[];
  reasonPartTypeIds: number[];
  reasonOrderTypeIds: number[];
  scheduleId?: number | null;
  alsoAssignImport: boolean;
}

const DEFAULT_VALUES: EquipmentFormValues = {
  name: '',
  icon: '',
  isActive: true,
  reasonStopTypeIds: [],
  reasonScrapTypeIds: [],
  reasonPartTypeIds: [],
  reasonOrderTypeIds: [],
  alsoAssignImport: false,
};

interface Props {
  open: boolean;
  /** Non-null = edit existing; null = add new */
  editingId: number | null;
  /** When set (and editingId is null), pre-fill parentId on the Equipment tab. */
  addUnderParentId?: number | null;
  scope: TenantScope;
  onClose: () => void;
  /** Optional callback after a successful save — typically invalidates the
   *  tree query so the new placement appears immediately. */
  onSaved?: () => void;
}

/**
 * Full equipment edit/add modal — all 7 tabs (Equipment, Stop types, Scrap
 * types, Part types, Order types, Shift schedule, Properties). Used by:
 *   - /admin/equipment (list page) for inline edit/create
 *   - /admin/equipment/tree (structure page) so users can change Parent or
 *     any other field without leaving the tree.
 *
 * Salary groups and the small per-type queries also feed the Properties
 * sub-panel via context — see EquipmentPropertiesPanel.
 */
export default function EquipmentFullEditModal({
  open, editingId, addUnderParentId, scope, onClose, onSaved,
}: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<EquipmentFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [propertyRows, setPropertyRows] = useState<EquipmentPropertyRow[]>([]);

  const tenantId = scope.tenantId;
  const headers = scope.isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;

  const { data: detail } = useEquipmentDetail(tenantId, editingId);
  const { data: existingProperties } = useEquipmentProperties(tenantId, editingId);

  // Reset / hydrate the controlled propertyRows whenever the modal flips
  // between edit targets or the existing properties land for an editing
  // session. The panel itself is purely controlled by us — no local state.
  useEffect(() => {
    if (!open) return;
    if (editingId === null) {
      setPropertyRows([]);
      return;
    }
    if (existingProperties) {
      setPropertyRows(existingProperties);
    }
  }, [open, editingId, existingProperties]);
  const { data: equipmentTypes } = typesApi.useList(scope, { entity: 'Equipment', perPage: 200 });
  const { data: stopTypes }      = typesApi.useList(scope, { entity: 'StopReason', perPage: 200 });
  const { data: scrapTypes }     = typesApi.useList(scope, { entity: 'ScrapReason', perPage: 200 });
  const { data: partTypes }      = typesApi.useList(scope, { entity: 'Part', perPage: 200 });
  const { data: orderTypes }     = typesApi.useList(scope, { entity: 'Order', perPage: 200 });
  // Salary groups are queried only so the Properties tab has the dropdown
  // ready when the user clicks into it — the data is shared via a cache key
  // it reads from inside EquipmentPropertiesPanel.
  salaryGroupsApi.useList(scope, { perPage: 200 });

  const { data: shiftSchedules } = useQuery({
    queryKey: ['shift-schedules-list', tenantId],
    queryFn: async () =>
      (await apiClient.get<{ data: ShiftScheduleRow[]; total: number }>('/admin/shift-schedules', {
        params: { perPage: 200 }, headers,
      })).data,
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const createMut = useCreateEquipment(tenantId);
  const updateMut = useUpdateEquipment(tenantId);
  const replacePropertiesMut = useReplaceEquipmentProperties(tenantId);

  // Prefill via initialValues — Form.Items on lazy-mounted Tabs only register
  // when their tab is first opened, so setFieldsValue inside a useEffect
  // silently drops values for inactive tabs. initialValues reapplies on
  // each mount, including the lazy ones, which is what we need here.
  const initialValues = useMemo<EquipmentFormValues>(() => {
    if (editingId !== null && detail) {
      return {
        name: detail.name ?? '',
        parentId: detail.parentId || undefined,
        typeId: detail.typeId || undefined,
        description: detail.description ?? undefined,
        icon: detail.icon && detail.icon !== 'noimage.jpg' ? detail.icon : '',
        sortOrder: detail.sortOrder ?? 0,
        isActive: detail.isActive ?? true,
        reasonStopTypeIds: detail.reasonStopTypeIds ?? [],
        reasonScrapTypeIds: detail.reasonScrapTypeIds ?? [],
        reasonPartTypeIds: detail.reasonPartTypeIds ?? [],
        reasonOrderTypeIds: detail.reasonOrderTypeIds ?? [],
        scheduleId: detail.scheduleId ?? undefined,
        alsoAssignImport: detail.alsoAssignImport ?? false,
      };
    }
    return {
      ...DEFAULT_VALUES,
      parentId: addUnderParentId && addUnderParentId > 0 ? addUnderParentId : undefined,
    };
  }, [editingId, detail, addUnderParentId]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate Properties rows up front — better to surface "row N is
      // missing a Part Type" before any network call than after equipment
      // saves and properties fail halfway.
      const badRow = propertyRows.findIndex((r) => !r.typeId || r.typeId <= 0);
      if (badRow !== -1) {
        message.error(`Properties row ${badRow + 1}: pick a Part Type before saving.`);
        return;
      }

      setSubmitting(true);
      const payload = {
        name: values.name,
        parentId: values.parentId ?? 0,
        typeId: values.typeId ?? 0,
        description: values.description ?? '',
        // Empty string = no icon → fall back to the noimage.jpg sentinel
        // the DB column defaults to; otherwise pass the picked filename.
        icon: values.icon ? values.icon : 'noimage.jpg',
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive,
        reasonStopTypeIds: values.reasonStopTypeIds,
        reasonScrapTypeIds: values.reasonScrapTypeIds,
        reasonPartTypeIds: values.reasonPartTypeIds,
        reasonOrderTypeIds: values.reasonOrderTypeIds,
        scheduleId: values.scheduleId ?? null,
        alsoAssignImport: values.alsoAssignImport,
      };

      // Save equipment first to get an id (for create) or just update.
      let savedId: number;
      if (editingId !== null) {
        await updateMut.mutateAsync({ id: editingId, input: payload });
        savedId = editingId;
      } else {
        const created = await createMut.mutateAsync(payload);
        savedId = created.id;
      }

      // Then persist the Properties tab against that id. PUT-replaces the
      // whole list so removed rows actually disappear.
      await replacePropertiesMut.mutateAsync({ id: savedId, rows: propertyRows });
      qc.invalidateQueries({ queryKey: ['equipment-properties', tenantId, savedId] });

      message.success(editingId !== null ? 'Equipment updated.' : 'Equipment created.');
      onSaved?.();
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // antd validation
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const title = editingId === null ? 'Add equipment' : `Edit equipment #${editingId}`;
  const okText = editingId === null ? 'Create' : 'Save changes';
  const isLoadingDetail = editingId !== null && !detail;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      okText={okText}
      confirmLoading={submitting}
      destroyOnClose
      width={920}
    >
      {isLoadingDetail ? (
        <Spin />
      ) : (
        <Form<EquipmentFormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={initialValues}
        >
          <Tabs
            defaultActiveKey="equipment"
            items={[
              {
                key: 'equipment',
                label: 'Equipment',
                children: (
                  <>
                    <Form.Item name="parentId" label="Parent equipment">
                      <EquipmentTreeSelect tenantId={tenantId} placeholder="Select parent equipment (optional)" />
                    </Form.Item>
                    <Form.Item name="typeId" label="Type" rules={[{ required: true, message: 'Type is required' }]}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Select equipment type"
                        options={(equipmentTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                      />
                    </Form.Item>
                    <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                      <Input maxLength={255} autoFocus />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                      <Input.TextArea rows={3} maxLength={2000} />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                      <Form.Item name="icon" label="Icon" style={{ flex: 1 }}>
                        <IconPicker />
                      </Form.Item>
                      <Form.Item name="sortOrder" label="Sort order" style={{ width: 160 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                    <Form.Item name="isActive" label="Active" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'stop',
                label: 'Stop types',
                children: (
                  <Form.Item name="reasonStopTypeIds">
                    <Checkbox.Group
                      options={(stopTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'scrap',
                label: 'Scrap types',
                children: (
                  <Form.Item name="reasonScrapTypeIds">
                    <Checkbox.Group
                      options={(scrapTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'parts',
                label: 'Part types',
                children: (
                  <Form.Item name="reasonPartTypeIds">
                    <Checkbox.Group
                      options={(partTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'orders',
                label: 'Order types',
                children: (
                  <Form.Item name="reasonOrderTypeIds">
                    <Checkbox.Group
                      options={(orderTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'shift',
                label: 'Shift schedule',
                children: (
                  <>
                    <Form.Item name="scheduleId" label="Shift schedule">
                      <Radio.Group>
                        <Space direction="vertical">
                          <Radio value={null}>(none)</Radio>
                          {(shiftSchedules?.data ?? []).map((s) => (
                            <Radio key={s.id} value={s.id}>{s.name ?? `#${s.id}`}</Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item name="alsoAssignImport" valuePropName="checked">
                      <Checkbox>Also assign on import</Checkbox>
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'properties',
                label: 'Properties',
                children: (
                  <EquipmentPropertiesPanel
                    equipmentId={editingId}
                    scope={scope}
                    value={propertyRows}
                    onChange={setPropertyRows}
                  />
                ),
              },
            ]}
          />
        </Form>
      )}
    </Modal>
  );
}
