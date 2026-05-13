'use client';

import { App, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Table, Typography } from 'antd';
import { EditOutlined, FileExcelOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useMe } from '../../../../../lib/api/auth';
import {
  useStopList,
  useUpdateStop,
  type StopRow,
  type UpdateStopInput,
} from '../../../../../lib/api/admin-results';
import { DateRangeStrip } from '../../../../../components/result/DateRangeStrip';
import {
  usePartsForSelect,
  useReasonTypes,
  useReasonsForType,
} from '../../../../../components/result/EditModalHooks';
import { WorkShiftDualSource } from '../../../../../components/result/WorkShiftDualSource';
import { toApiError } from '../../../../../lib/api-client';

const { Title, Text } = Typography;

interface StopFormShape {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  stopTypeId?: number;
  reasonId?: number;
  orderNo?: string;
  quantity?: number;
  timeHours?: number;
  timeMinutes?: number;
  comment?: string;
  date?: Dayjs | null;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

export default function StopPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId;

  const today = todayYMD();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [editing, setEditing] = useState<StopRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<StopFormShape>();

  const { data, isFetching } = useStopList(tenantId, {
    page, perPage, from, to,
    include_excluded: includeExcluded ? '1' : '0',
  });
  const { data: parts } = usePartsForSelect(tenantId);
  const { data: stopTypes } = useReasonTypes(tenantId, 'StopReason');
  const updateMut = useUpdateStop(tenantId);

  const watchedStopTypeId = Form.useWatch('stopTypeId', form);
  const { data: stopReasons, isLoading: reasonsLoading } = useReasonsForType(
    tenantId,
    'stop-reasons',
    watchedStopTypeId ?? null,
  );

  // Decompose stored sum_of_time / time into the hours+minutes pair the
  // operator UI exposes. Backend recomputes hours/minutes/sum_of_time/time
  // on submit; this is purely the "show what's stored" pre-fill.
  useEffect(() => {
    if (!editing) return;
    const hours = editing.hours ?? (editing.sumOfTime ? Math.floor(editing.sumOfTime / 60) : undefined);
    const minutes = editing.minutes ?? (editing.sumOfTime ? editing.sumOfTime % 60 : undefined);
    form.setFieldsValue({
      partId: editing.partId ?? undefined,
      workShiftId: editing.workShiftId && editing.workShiftId > 0 ? editing.workShiftId : undefined,
      workShiftName: editing.workShiftId && editing.workShiftId > 0 ? undefined : editing.shiftName ?? undefined,
      stopTypeId: editing.stopTypeId ?? undefined,
      reasonId: editing.reasonId ?? undefined,
      orderNo: editing.orderNo ?? '',
      quantity: editing.quantity ?? undefined,
      timeHours: hours,
      timeMinutes: minutes,
      comment: editing.comment ?? '',
      date: editing.selectedDate ? dayjs(editing.selectedDate) : null,
    });
  }, [editing, form]);

  const closeModal = () => {
    setEditing(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const hours = Number(values.timeHours ?? 0);
      const minutes = Number(values.timeMinutes ?? 0);
      const totalMinutes = hours * 60 + minutes;
      const input: UpdateStopInput = {
        partId: values.partId,
        stopTypeId: values.stopTypeId,
        reasonId: values.reasonId,
        orderNo: values.orderNo,
        quantity: values.quantity,
        timeMinutes: totalMinutes > 0 ? totalMinutes : undefined,
        comment: values.comment,
        date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
      };
      if (values.workShiftId !== undefined) input.workShiftId = values.workShiftId;
      else if (values.workShiftName) input.workShiftName = values.workShiftName;
      await updateMut.mutateAsync({ id: editing!.id, input });
      message.success('Stop row updated.');
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant first.</Text>;

  function handleRangeChange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setPage(1);
  }

  const partOptions = (parts ?? []).map((p) => ({ value: p.id, label: p.partNo ? `${p.partNo} — ${p.name}` : p.name }));
  const stopTypeOptions = (stopTypes ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));
  const reasonOptions = (stopReasons ?? []).map((r) => ({ value: r.id, label: r.name ?? `#${r.id}` }));

  const PER_PAGE_OPTIONS = [
    { value: 10, label: 'Show 10 entries' },
    { value: 25, label: 'Show 25 entries' },
    { value: 50, label: 'Show 50 entries' },
    { value: 9999, label: 'Show All' },
  ];

  const columns = [
    { title: 'S No', dataIndex: 'id', width: 70 },
    { title: 'Flödesnamn', dataIndex: 'flowName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Utrustningsbenämning', dataIndex: 'equipmentName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Artikelnummer', dataIndex: 'partNumber', width: 130, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Artikelnamn', dataIndex: 'partName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Skift-benämning', dataIndex: 'shiftName', width: 130, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Ordernummer', dataIndex: 'orderNo', width: 120, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Antal', dataIndex: 'quantity', width: 80, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Tid', dataIndex: 'time', width: 80, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Summa tid', dataIndex: 'sumOfTime', width: 110, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Förlustmodellkategori', dataIndex: 'lossCategory', width: 170, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Stoptyp', dataIndex: 'stopType', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Stopporsak', dataIndex: 'stopReason', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Kommentar', dataIndex: 'comment', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Valt datum', dataIndex: 'selectedDate', width: 110, render: fmtDate },
    { title: 'Stop tidsstämpel', dataIndex: 'stopTimestamp', width: 170, render: fmtDateTime },
    { title: 'Restart tidsstämpel', dataIndex: 'restartTimestamp', width: 180, render: fmtDateTime },
    { title: 'Skapad datum', dataIndex: 'createdAt', width: 170, render: fmtDateTime },
    { title: 'Skapad av', dataIndex: 'createdBy', width: 140, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    {
      title: 'Bilaga',
      dataIndex: 'attachment',
      width: 80,
      render: (v: unknown) =>
        v ? (
          <a href={String(v)} target="_blank" rel="noreferrer">
            <PaperClipOutlined />
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Actions',
      width: 80,
      render: (_: unknown, row: StopRow) => (
        <Button
          type="text"
          size="small"
          icon={<EditOutlined style={{ color: '#01b9d0' }} />}
          title="Edit"
          onClick={() => setEditing(row)}
        />
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: '0 0 12px' }}>Registrerade stopp</Title>

      <DateRangeStrip value={{ from, to }} onChange={handleRangeChange} />

      <div style={{ marginTop: 12 }}>
        <Checkbox
          checked={includeExcluded}
          onChange={(e) => { setIncludeExcluded(e.target.checked); setPage(1); }}
        >
          Visa även exkluderade kategorier
        </Checkbox>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}>
        <Select
          value={perPage}
          onChange={(v) => { setPerPage(v); setPage(1); }}
          options={PER_PAGE_OPTIONS}
          style={{ width: 160 }}
          size="small"
        />
        <div style={{ flex: 1 }} />
        <Button
          icon={<FileExcelOutlined />}
          style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
          size="small"
          onClick={() => message.info('Export not yet implemented')}
        >
          Excel
        </Button>
      </div>

      <Table<StopRow>
        rowKey="id"
        loading={isFetching}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 'max-content' }}
        size="small"
        pagination={{
          current: page,
          pageSize: perPage === 9999 ? (data?.total ?? 10) : perPage,
          total: data?.total ?? 0,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} records`,
          onChange: (p) => setPage(p),
        }}
      />

      <Modal
        open={editing !== null}
        title={`Edit stop row #${editing?.id ?? ''}`}
        onCancel={closeModal}
        onOk={onSubmit}
        okText="Save"
        confirmLoading={submitting}
        width={560}
        destroyOnClose
        maskClosable={false}
      >
        <Form<StopFormShape> form={form} layout="vertical">
          <Form.Item name="partId" label="Part">
            <Select options={partOptions} showSearch optionFilterProp="label" allowClear placeholder="Pick a part" />
          </Form.Item>
          <WorkShiftDualSource
            tenantId={tenantId}
            date={editing?.selectedDate ? String(editing.selectedDate).slice(0, 10) : null}
            equipmentId={editing?.equipmentId ?? null}
            initiallyShowFallback={
              !!(editing && (!editing.workShiftId || editing.workShiftId === 0) && editing.shiftName)
            }
          />
          <Form.Item name="stopTypeId" label="Stop type" rules={[{ required: true, message: 'Stop type is required' }]}>
            <Select
              options={stopTypeOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Pick a stop type"
              onChange={() => form.setFieldValue('reasonId', undefined)}
            />
          </Form.Item>
          <Form.Item name="reasonId" label="Stop reason" rules={[{ required: true, message: 'Reason is required' }]}>
            <Select
              options={reasonOptions}
              loading={reasonsLoading}
              disabled={!watchedStopTypeId || reasonsLoading}
              showSearch
              optionFilterProp="label"
              placeholder={watchedStopTypeId ? (reasonOptions.length === 0 && !reasonsLoading ? 'No reasons configured for this type' : 'Pick a reason') : 'Pick a stop type first'}
            />
          </Form.Item>
          <Form.Item name="orderNo" label="Order #"><Input maxLength={255} /></Form.Item>
          <Form.Item name="quantity" label="Quantity"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="timeHours" label="Hours">
                <InputNumber min={0} addonAfter="h" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeMinutes" label="Minutes">
                <InputNumber min={0} max={59} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="comment" label="Comment"><Input.TextArea rows={3} maxLength={255} /></Form.Item>
          <Form.Item name="date" label="Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
