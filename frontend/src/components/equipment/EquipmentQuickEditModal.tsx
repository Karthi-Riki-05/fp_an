'use client';

import { App, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useEffect } from 'react';
import { toApiError } from '../../lib/api-client';
import { typesApi, type TenantScope } from '../../lib/api/admin-crud';
import {
  useCreateEquipment,
  useEquipmentDetail,
  useUpdateEquipment,
} from '../../lib/api/equipment';
import { EquipmentTreeSelect } from './EquipmentTreeSelect';

interface FormValues {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
}

const DEFAULT_VALUES: FormValues = {
  name: '',
  parentId: undefined,
  typeId: undefined,
  description: '',
  sortOrder: 0,
  isActive: true,
};

interface Props {
  open: boolean;
  /** When set, the modal is in edit mode for this id. */
  editingId: number | null;
  /** When set, the modal is in create-child mode with this as the initial parent. */
  addUnderParentId?: number | null;
  scope: TenantScope;
  onClose: () => void;
  /** Optional callback after a successful save (e.g. invalidate other caches). */
  onSaved?: () => void;
}

/**
 * Small edit/create modal used by the Equipment Structure (tree) page. Covers
 * the fields most often changed during tree work — name, parent, type, sort,
 * active — without the full assignment tabs. Use the list-page modal for
 * deeper assignment editing.
 */
export default function EquipmentQuickEditModal({
  open, editingId, addUnderParentId, scope, onClose, onSaved,
}: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const { data: detail, isLoading: detailLoading } = useEquipmentDetail(scope.tenantId, editingId);
  const { data: equipmentTypes } = typesApi.useList(scope, { entity: 'Equipment', perPage: 200 });

  const create = useCreateEquipment(scope.tenantId);
  const update = useUpdateEquipment(scope.tenantId);

  const isEdit = editingId !== null;
  const title = isEdit
    ? `Edit equipment #${editingId}`
    : addUnderParentId
      ? 'Add child equipment'
      : 'Add equipment';

  // Reset / preload values when the modal opens.
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      if (detail) {
        form.setFieldsValue({
          name: detail.name ?? '',
          parentId: detail.parentId || undefined,
          typeId: detail.typeId || undefined,
          description: detail.description ?? '',
          sortOrder: detail.sortOrder ?? 0,
          isActive: detail.isActive ?? true,
        });
      }
    } else {
      form.resetFields();
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        parentId: addUnderParentId && addUnderParentId > 0 ? addUnderParentId : undefined,
      });
    }
  }, [open, isEdit, detail, addUnderParentId, form]);

  const onOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        parentId: values.parentId ?? 0,
        typeId: values.typeId ?? 0,
        description: values.description ?? '',
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive,
        // Preserve existing assignments by sending what the server already has.
        // For edit, these come from the detail fetch; for create, they default
        // to empty arrays (matching the legacy "create stub then assign" flow).
        reasonStopTypeIds:  isEdit ? detail?.reasonStopTypeIds  ?? [] : [],
        reasonScrapTypeIds: isEdit ? detail?.reasonScrapTypeIds ?? [] : [],
        reasonPartTypeIds:  isEdit ? detail?.reasonPartTypeIds  ?? [] : [],
        reasonOrderTypeIds: isEdit ? detail?.reasonOrderTypeIds ?? [] : [],
        scheduleId:         isEdit ? detail?.scheduleId ?? null : null,
        alsoAssignImport:   isEdit ? detail?.alsoAssignImport ?? false : false,
      };
      if (isEdit && editingId !== null) {
        await update.mutateAsync({ id: editingId, input: payload });
        message.success('Equipment updated.');
      } else {
        await create.mutateAsync(payload);
        message.success('Equipment created.');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // antd validation
      message.error(toApiError(err).message || 'Save failed.');
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      onOk={onOk}
      okText={isEdit ? 'Save changes' : 'Create'}
      confirmLoading={create.isPending || update.isPending}
      destroyOnClose
      maskClosable={false}
      width={560}
    >
      {isEdit && detailLoading ? null : (
        <Form<FormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={DEFAULT_VALUES}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input maxLength={255} autoFocus />
          </Form.Item>

          <Form.Item name="parentId" label="Parent equipment">
            <EquipmentTreeSelect
              tenantId={scope.tenantId}
              placeholder="Select parent equipment (leave empty for root)"
            />
          </Form.Item>

          <Form.Item name="typeId" label="Type" rules={[{ required: true, message: 'Type is required' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select equipment type"
              options={(equipmentTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
            />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 24 }}>
            <Form.Item name="sortOrder" label="Sort order" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      )}
    </Modal>
  );
}
