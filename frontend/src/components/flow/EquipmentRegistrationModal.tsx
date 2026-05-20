'use client';

/**
 * 4-step operator registration modal opened when a Flow Monitor cell is
 * clicked. Replaces the old persistent right-side panel that hung off
 * `selectedEquipmentId`.
 *
 * Steps
 *   1. shift-data   — date + work shift (required) + part + order (optional)
 *   2. choose-type  — Production / Stop / Scrap pill buttons + shift summary
 *   3. <type>       — the form for the chosen type
 *   4. (close)      — success toast, modal dismisses, state resets
 *
 * Visual: teal (#00b4d8) header, white title/back-arrow, teal section
 * heading, pill buttons. Matches the legacy fpanalyzer.se modal exactly.
 */

import { ArrowLeftOutlined, CameraOutlined, CheckOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  ConfigProvider,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
  Upload,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import {
  decodeReasonValue,
  groupReasonsForSelect,
  useCreateProduction,
  useCreateScrap,
  useCreateStop,
  useEquipmentParts,
  useEquipmentScrapReasons,
  useEquipmentStopReasons,
  useUploadResultPicture,
} from '../../lib/api/monitor';
import { workShiftsApi } from '../../lib/api/admin-crud';

const { Text } = Typography;

const TEAL = '#00b4d8';
const TEAL_DARK = '#0099b8';

type Step = 'shift-data' | 'choose-type' | 'production' | 'stop' | 'scrap';

interface ShiftData {
  date: string;            // YYYY-MM-DD
  workShift: string;
  partId: number | null;
  partLabel: string;
  orderNo: string;
}

interface Props {
  open: boolean;
  flowId: number | null;
  equipmentId: number | null;
  equipmentName: string;
  tenantId: number | null;
  onClose: () => void;
}

export default function EquipmentRegistrationModal({
  open,
  flowId,
  equipmentId,
  equipmentName,
  tenantId,
  onClose,
}: Props) {
  const { message } = App.useApp();
  const [step, setStep] = useState<Step>('shift-data');
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);

  // Reset state every time the modal opens. Without this, a previously
  // entered shift would carry over the next time an operator clicks a cell.
  useEffect(() => {
    if (open) {
      setStep('shift-data');
      setShiftData(null);
    }
  }, [open, equipmentId]);

  const headerTitle = equipmentName || (equipmentId != null ? `Equipment #${equipmentId}` : 'Equipment');

  const goBack = () => {
    if (step === 'shift-data') onClose();
    else if (step === 'choose-type') setStep('shift-data');
    else setStep('choose-type');
  };

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: TEAL },
      }}
    >
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        destroyOnClose
        width={520}
        closable
        title={
          <Space size={8}>
            <ArrowLeftOutlined
              onClick={goBack}
              style={{ cursor: 'pointer', color: '#fff', fontSize: 16 }}
              aria-label="Back"
            />
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 500 }}>{headerTitle}</span>
          </Space>
        }
        styles={{
          header: {
            background: TEAL,
            borderRadius: '8px 8px 0 0',
            borderBottom: 'none',
            padding: '12px 16px',
            margin: 0,
          },
          content: { padding: 0 },
          body: { padding: 20 },
        }}
      >
        {step === 'shift-data' && equipmentId != null && tenantId != null ? (
          <ShiftDataStep
            tenantId={tenantId}
            equipmentId={equipmentId}
            value={shiftData}
            onConfirm={(d) => {
              setShiftData(d);
              setStep('choose-type');
            }}
          />
        ) : null}

        {step === 'choose-type' && shiftData ? (
          <ChooseTypeStep
            shiftData={shiftData}
            onPick={(t) => setStep(t)}
          />
        ) : null}

        {step === 'production' && shiftData && flowId != null && equipmentId != null && tenantId != null ? (
          <ProductionStep
            tenantId={tenantId}
            flowId={flowId}
            equipmentId={equipmentId}
            shiftData={shiftData}
            onSaved={() => {
              // Operators commonly register production + stops + scraps
              // for the same shift back-to-back. Return to the "choose
              // type" step so the shift data is reused; the operator
              // closes the modal explicitly via the X / back arrow when
              // done. shiftData stays in state — only the form-step
              // resets via its own React unmount.
              message.success('Production data saved');
              setStep('choose-type');
            }}
            onError={(msg) => message.error(msg)}
          />
        ) : null}

        {step === 'stop' && shiftData && flowId != null && equipmentId != null && tenantId != null ? (
          <StopStep
            tenantId={tenantId}
            flowId={flowId}
            equipmentId={equipmentId}
            shiftData={shiftData}
            onSaved={() => {
              message.success('Stop data saved');
              setStep('choose-type');
            }}
            onError={(msg) => message.error(msg)}
          />
        ) : null}

        {step === 'scrap' && shiftData && flowId != null && equipmentId != null && tenantId != null ? (
          <ScrapStep
            tenantId={tenantId}
            flowId={flowId}
            equipmentId={equipmentId}
            shiftData={shiftData}
            onSaved={() => {
              message.success('Scrap data saved');
              setStep('choose-type');
            }}
            onError={(msg) => message.error(msg)}
          />
        ) : null}
      </Modal>
    </ConfigProvider>
  );
}

// ─── Step 1 — Shift data ────────────────────────────────────────────────────

function ShiftDataStep({
  tenantId,
  equipmentId,
  value,
  onConfirm,
}: {
  tenantId: number;
  equipmentId: number;
  value: ShiftData | null;
  onConfirm: (d: ShiftData) => void;
}) {
  const [form] = Form.useForm<{
    date: Dayjs;
    workShift: string;
    partId: number | null;
    orderNo: string;
  }>();

  const partsQ = useEquipmentParts(tenantId, equipmentId);
  // Work shifts list — drives the Work shift Select. Same endpoint the
  // admin /work-shifts page uses; results are tenant-scoped automatically.
  const shiftsQ = workShiftsApi.useList(
    { tenantId, isAdmin: false },
    { page: 1, perPage: 200 },
  );

  const partOptions = (partsQ.data ?? []).map((p) => ({
    value: p.id,
    label: p.partNo ? `${p.partNo} - ${p.name}` : p.name,
  }));
  const workShiftOptions = (shiftsQ.data?.data ?? [])
    .filter((s) => s.name)
    .map((s) => ({ value: s.name as string, label: s.name as string }));

  return (
    <>
      <SectionTitle>Shift data</SectionTitle>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{
          date: value ? dayjs(value.date) : dayjs(),
          workShift: value?.workShift ?? '',
          partId: value?.partId ?? null,
          orderNo: value?.orderNo ?? '',
        }}
        onFinish={(values) => {
          const partLabel = partOptions.find((o) => o.value === values.partId)?.label ?? '';
          onConfirm({
            date: values.date.format('YYYY-MM-DD'),
            workShift: values.workShift.trim(),
            partId: values.partId ?? null,
            partLabel,
            orderNo: values.orderNo?.trim() ?? '',
          });
        }}
      >
        <Form.Item
          name="date"
          label={<TealLabel>Date</TealLabel>}
          rules={[{ required: true, message: 'Date is required' }]}
        >
          <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} allowClear={false} />
        </Form.Item>

        <Form.Item
          name="workShift"
          label={<TealLabel>Work shift</TealLabel>}
          rules={[{ required: true, message: 'Work shift is required' }]}
        >
          <Select
            placeholder={shiftsQ.isLoading ? 'Loading…' : 'Select work shift'}
            options={workShiftOptions}
            loading={shiftsQ.isLoading}
            showSearch
            optionFilterProp="label"
            notFoundContent={shiftsQ.isLoading ? 'Loading…' : 'No work shifts configured'}
          />
        </Form.Item>

        <Form.Item name="partId" label={<TealLabel>Part ID</TealLabel>}>
          <Select
            placeholder={partsQ.isLoading ? 'Loading…' : 'Choose part'}
            options={partOptions}
            loading={partsQ.isLoading}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item name="orderNo" label={<TealLabel>Order NR</TealLabel>}>
          <Input placeholder="Select Order Nr" autoComplete="off" />
        </Form.Item>

        <PillButton htmlType="submit" icon={<CheckOutlined />}>
          CONFIRM
        </PillButton>
      </Form>
    </>
  );
}

// ─── Step 2 — Choose type ───────────────────────────────────────────────────

function ChooseTypeStep({
  shiftData,
  onPick,
}: {
  shiftData: ShiftData;
  onPick: (t: 'production' | 'stop' | 'scrap') => void;
}) {
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 16px',
          marginBottom: 20,
          padding: 12,
          background: '#fafafa',
          borderRadius: 4,
        }}
      >
        <div>
          <ContextLabel>Date</ContextLabel>
          <ContextValue>{shiftData.date}</ContextValue>
        </div>
        <div>
          <ContextLabel>Work shift</ContextLabel>
          <ContextValue>{shiftData.workShift || '—'}</ContextValue>
        </div>
        <div>
          <ContextLabel>Part ID and name</ContextLabel>
          <ContextValue>{shiftData.partLabel || '—'}</ContextValue>
        </div>
        <div>
          <ContextLabel>Order NR</ContextLabel>
          <ContextValue>{shiftData.orderNo || '—'}</ContextValue>
        </div>
      </div>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <PillButton onClick={() => onPick('production')}>REGISTER PRODUCTION DATA</PillButton>
        <PillButton onClick={() => onPick('stop')}>REGISTER STOPS DATA</PillButton>
        <PillButton onClick={() => onPick('scrap')}>REGISTER SCRAPS DATA</PillButton>
      </Space>
    </>
  );
}

// ─── Step 3A — Production ───────────────────────────────────────────────────

function ProductionStep({
  tenantId,
  flowId,
  equipmentId,
  shiftData,
  onSaved,
  onError,
}: {
  tenantId: number;
  flowId: number;
  equipmentId: number;
  shiftData: ShiftData;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form] = Form.useForm<{
    workHours: string;
    okPartsQty: number;
    plannedQty: number;
    comment: string;
  }>();
  const createMut = useCreateProduction(tenantId);

  return (
    <>
      <SectionTitle>Production data</SectionTitle>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ workHours: '', okPartsQty: 0, plannedQty: 0, comment: '' }}
        onFinish={async (values) => {
          try {
            await createMut.mutateAsync({
              flowId,
              equipmentId,
              partId: shiftData.partId,
              workShiftName: shiftData.workShift,
              orderNo: shiftData.orderNo,
              date: shiftData.date,
              workHours: values.workHours,
              partQty: values.okPartsQty,
              plannedQty: values.plannedQty,
              comment: values.comment,
            });
            onSaved();
          } catch (e) {
            onError(extractErr(e, 'Could not save production data'));
          }
        }}
      >
        <Form.Item name="workHours" label={<TealLabel>Work hours</TealLabel>}>
          <Input placeholder="07:05" autoComplete="off" />
        </Form.Item>
        <Form.Item name="okPartsQty" label={<TealLabel>OK parts qty</TealLabel>}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="plannedQty" label={<TealLabel>Planned Qty</TealLabel>}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="comment" label={<TealLabel>Comment</TealLabel>}>
          <Input.TextArea rows={3} placeholder="Enter comment" />
        </Form.Item>
        <SaveRow loading={createMut.isPending} />
      </Form>
    </>
  );
}

// ─── Step 3B — Stop ─────────────────────────────────────────────────────────

function StopStep({
  tenantId,
  flowId,
  equipmentId,
  shiftData,
  onSaved,
  onError,
}: {
  tenantId: number;
  flowId: number;
  equipmentId: number;
  shiftData: ShiftData;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form] = Form.useForm<{
    reason: string;
    stopHours: number;
    stopMinutes: number;
    comment: string;
  }>();
  const reasonsQ = useEquipmentStopReasons(tenantId, equipmentId);
  const uploadMut = useUploadResultPicture(tenantId);
  const createMut = useCreateStop(tenantId);
  const [picture, setPicture] = useState<string | null>(null);

  return (
    <>
      <SectionTitle>Stop Registration</SectionTitle>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ reason: undefined, stopHours: 0, stopMinutes: 0, comment: '' }}
        onFinish={async (values) => {
          const { typeId, reasonId } = decodeReasonValue(values.reason);
          if (typeId == null || reasonId == null) {
            onError('Pick a stop reason');
            return;
          }
          try {
            await createMut.mutateAsync({
              flowId,
              equipmentId,
              partId: shiftData.partId,
              workShiftName: shiftData.workShift,
              orderNo: shiftData.orderNo,
              date: shiftData.date,
              stopTypeId: typeId,
              stopReasonId: reasonId,
              timeHours: values.stopHours,
              timeMinutes: values.stopMinutes,
              comment: values.comment,
              picture,
            });
            onSaved();
          } catch (e) {
            onError(extractErr(e, 'Could not save stop data'));
          }
        }}
      >
        <Form.Item
          name="reason"
          label={<TealLabel>Cause</TealLabel>}
          rules={[{ required: true, message: 'Pick a stop reason' }]}
        >
          <Select
            placeholder="Select Reason"
            loading={reasonsQ.isLoading}
            options={groupReasonsForSelect(reasonsQ.data)}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <div style={{ color: TEAL, fontWeight: 500, marginBottom: 4 }}>
          Sum of stop time : <StopTimeWatcher form={form} />
        </div>
        <Space size={12} style={{ width: '100%', marginBottom: 16 }}>
          <Form.Item name="stopHours" label="hrs" style={{ marginBottom: 0 }}>
            <InputNumber min={0} style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="stopMinutes" label="mins" style={{ marginBottom: 0 }}>
            <InputNumber min={0} max={59} style={{ width: 100 }} />
          </Form.Item>
        </Space>

        <Form.Item name="comment" label={<TealLabel>Comment</TealLabel>}>
          <Input.TextArea rows={3} placeholder="Enter comment" />
        </Form.Item>

        <SaveRow
          loading={createMut.isPending}
          camera={
            <PictureUploader
              uploading={uploadMut.isPending}
              picture={picture}
              onUpload={async (file) => {
                try {
                  const r = await uploadMut.mutateAsync(file);
                  setPicture(r.filename);
                } catch (e) {
                  onError(extractErr(e, 'Upload failed'));
                }
              }}
              onClear={() => setPicture(null)}
            />
          }
        />
      </Form>
    </>
  );
}

// FormInstance is invariant in its generic parameter, so accept the
// `any` variant for this read-only watcher. The two field names are
// guaranteed to exist on the StopStep form.
function StopTimeWatcher({ form }: { form: FormInstance }) {
  return (
    <Form.Item shouldUpdate noStyle>
      {() => {
        const h = Number(form.getFieldValue('stopHours') ?? 0);
        const m = Number(form.getFieldValue('stopMinutes') ?? 0);
        return (
          <span>
            {String(h).padStart(2, '0')} hrs : {String(m).padStart(2, '0')} mins
          </span>
        );
      }}
    </Form.Item>
  );
}

// ─── Step 3C — Scrap ────────────────────────────────────────────────────────

function ScrapStep({
  tenantId,
  flowId,
  equipmentId,
  shiftData,
  onSaved,
  onError,
}: {
  tenantId: number;
  flowId: number;
  equipmentId: number;
  shiftData: ShiftData;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form] = Form.useForm<{
    reason: string;
    quantity: number;
    comment: string;
  }>();
  const reasonsQ = useEquipmentScrapReasons(tenantId, equipmentId);
  const uploadMut = useUploadResultPicture(tenantId);
  const createMut = useCreateScrap(tenantId);
  const [picture, setPicture] = useState<string | null>(null);

  return (
    <>
      <SectionTitle>Scrapped parts/Material defects</SectionTitle>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ reason: undefined, quantity: 0, comment: '' }}
        onFinish={async (values) => {
          const { typeId, reasonId } = decodeReasonValue(values.reason);
          if (typeId == null || reasonId == null) {
            onError('Pick a scrap reason');
            return;
          }
          try {
            await createMut.mutateAsync({
              flowId,
              equipmentId,
              partId: shiftData.partId,
              workShiftName: shiftData.workShift,
              orderNo: shiftData.orderNo,
              date: shiftData.date,
              scrapTypeId: typeId,
              scrapReasonId: reasonId,
              quantity: values.quantity,
              comment: values.comment,
              picture,
            });
            onSaved();
          } catch (e) {
            onError(extractErr(e, 'Could not save scrap data'));
          }
        }}
      >
        <Form.Item
          name="reason"
          label={<TealLabel>Cause</TealLabel>}
          rules={[{ required: true, message: 'Pick a scrap reason' }]}
        >
          <Select
            placeholder="Select Reason"
            loading={reasonsQ.isLoading}
            options={groupReasonsForSelect(reasonsQ.data)}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item name="quantity" label={<TealLabel>Quantity</TealLabel>}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="comment" label={<TealLabel>Comment</TealLabel>}>
          <Input.TextArea rows={3} placeholder="Enter comment" />
        </Form.Item>
        <SaveRow
          loading={createMut.isPending}
          camera={
            <PictureUploader
              uploading={uploadMut.isPending}
              picture={picture}
              onUpload={async (file) => {
                try {
                  const r = await uploadMut.mutateAsync(file);
                  setPicture(r.filename);
                } catch (e) {
                  onError(extractErr(e, 'Upload failed'));
                }
              }}
              onClear={() => setPicture(null)}
            />
          }
        />
      </Form>
    </>
  );
}

// ─── Shared pieces ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: TEAL,
        fontSize: 16,
        fontWeight: 500,
        textAlign: 'center',
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function TealLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ color: TEAL, fontWeight: 500 }}>{children}</span>;
}

function ContextLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ color: TEAL, fontSize: 12, fontWeight: 500 }}>{children}</div>;
}

function ContextValue({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#333', fontSize: 14 }}>{children}</div>;
}

function PillButton({
  children,
  icon,
  htmlType,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  htmlType?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <Button
      type="primary"
      htmlType={htmlType ?? 'button'}
      icon={icon}
      onClick={onClick}
      block
      style={{
        background: TEAL,
        border: 'none',
        borderRadius: 24,
        height: 48,
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = TEAL_DARK; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = TEAL; }}
    >
      {children}
    </Button>
  );
}

function SaveRow({ loading, camera }: { loading: boolean; camera?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
      {camera}
      <Button
        type="primary"
        htmlType="submit"
        icon={<CheckOutlined />}
        loading={loading}
        style={{
          background: TEAL,
          border: 'none',
          borderRadius: 4,
          height: 40,
          paddingInline: 24,
          fontWeight: 600,
          marginLeft: 'auto',
        }}
      >
        SAVE
      </Button>
    </div>
  );
}

function PictureUploader({
  uploading,
  picture,
  onUpload,
  onClear,
}: {
  uploading: boolean;
  picture: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <Space size={4}>
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={(file) => {
          onUpload(file);
          return false; // prevent AntD's auto-upload — we handle it via mutation
        }}
      >
        <Button
          type="text"
          icon={uploading ? <Spin size="small" /> : <CameraOutlined style={{ fontSize: 20, color: picture ? TEAL : '#888' }} />}
          aria-label="Attach picture"
        />
      </Upload>
      {picture ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          attached · <a onClick={onClear}>remove</a>
        </Text>
      ) : null}
    </Space>
  );
}

function extractErr(e: unknown, fallback: string): string {
  const ax = e as { response?: { data?: { error?: string; message?: string } } };
  return ax?.response?.data?.error ?? ax?.response?.data?.message ?? fallback;
}
