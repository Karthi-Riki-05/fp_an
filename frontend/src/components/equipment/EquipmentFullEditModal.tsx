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
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient, toApiError } from '../../lib/api-client';
import { salaryGroupsApi, typesApi, type TenantScope } from '../../lib/api/admin-crud';
import {
  useCreateEquipment,
  useEquipmentDetail,
  useUpdateEquipment,
} from '../../lib/api/equipment';
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
  const [form] = Form.useForm<EquipmentFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const tenantId = scope.tenantId;
  const headers = scope.isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;

  const { data: detail } = useEquipmentDetail(tenantId, editingId);
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
      setSubmitting(true);
      const payload = {
        name: values.name,
        parentId: values.parentId ?? 0,
        typeId: values.typeId ?? 0,
        description: values.description ?? '',
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive,
        reasonStopTypeIds: values.reasonStopTypeIds,
        reasonScrapTypeIds: values.reasonScrapTypeIds,
        reasonPartTypeIds: values.reasonPartTypeIds,
        reasonOrderTypeIds: values.reasonOrderTypeIds,
        scheduleId: values.scheduleId ?? null,
        alsoAssignImport: values.alsoAssignImport,
      };
      if (editingId !== null) {
        await updateMut.mutateAsync({ id: editingId, input: payload });
        message.success('Equipment updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Equipment created.');
      }
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
                    <Space size="middle" wrap>
                      <Form.Item name="sortOrder" label="Sort order">
                        <InputNumber min={0} />
                      </Form.Item>
                      <Form.Item name="isActive" label="Active" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Space>
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
                children: <EquipmentPropertiesPanel equipmentId={editingId} scope={scope} />,
              },
            ]}
          />
        </Form>
      )}
    </Modal>
  );
}
