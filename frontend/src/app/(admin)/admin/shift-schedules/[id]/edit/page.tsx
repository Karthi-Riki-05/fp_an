'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import dayjs, { type Dayjs } from 'dayjs';
import Link from 'next/link';
import { use, useState } from 'react';
import { apiClient, toApiError } from '../../../../../../lib/api-client';
import { useMe } from '../../../../../../lib/api/auth';

const { Title } = Typography;

interface ShiftSchedule {
  id: number;
  name: string;
  description: string | null;
  status: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  textColor: string;
  backgroundColor: string;
}

/**
 * Legacy event form field set per audit § Module 2 — Shift Schedule:
 *   is_reccuring : Radio    0=Once, 1=Repeats
 *   repeat_day[] : Checkbox.Group  legacy mapping Mon..Sat=1..6, Sun=0
 *   end_date_type: Select   1=None / 2=By date / 3=No. of occurrences
 *   f_c_r_end_date: DatePicker (shown when end_date_type=2)
 *   f_c_end_occurence: InputNumber (shown when end_date_type=3)
 * The composite is shipped to the backend in `rcData` JSON.
 */
const REPEAT_DAY_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const END_DATE_TYPE_OPTIONS = [
  { value: 1, label: 'No end' },
  { value: 2, label: 'On date' },
  { value: 3, label: 'After N occurrences' },
];

interface EventFormShape {
  title: string;
  isRecurring: 0 | 1;
  repeatDays?: number[];
  endDateType?: 1 | 2 | 3;
  endDate?: Dayjs | null;
  endOccurrences?: number;
}

export default function ShiftScheduleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const scheduleId = Number(id);

  const { data: me } = useMe();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<{ name: string; description: string }>();
  const [eventForm] = Form.useForm<EventFormShape>();
  const [eventModal, setEventModal] = useState<{ open: boolean; startStr: string; endStr: string }>({ open: false, startStr: '', endStr: '' });
  const [creating, setCreating] = useState(false);

  // Watch the conditional radio/select to drive field visibility.
  const watchedIsRecurring = Form.useWatch('isRecurring', eventForm);
  const watchedEndDateType = Form.useWatch('endDateType', eventForm);

  if (!me) return null;

  const headers =
    me.isAdmin && me.activeTenantId
      ? { 'X-Tenant-Id': String(me.activeTenantId) }
      : undefined;

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['shift-schedule', scheduleId],
    queryFn: async () => {
      const { data } = await apiClient.get<ShiftSchedule>(
        `/admin/shift-schedules/${scheduleId}`,
        { headers },
      );
      return data;
    },
  });

  // Pre-populate the header form once the schedule loads. React-Query v5
  // dropped onSuccess; do it via the data ref instead.
  if (schedule && form.getFieldValue('name') === undefined) {
    form.setFieldsValue({ name: schedule.name, description: schedule.description ?? '' });
  }

  const { data: events = [] } = useQuery({
    queryKey: ['shift-schedule-events', scheduleId],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().slice(0, 10);
      const { data } = await apiClient.get<CalendarEvent[]>(
        `/admin/shift-schedules/${scheduleId}/events`,
        { params: { start, end }, headers },
      );
      return data;
    },
    enabled: !!scheduleId,
  });

  const updateMut = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data } = await apiClient.patch(
        `/admin/shift-schedules/${scheduleId}`,
        input,
        { headers },
      );
      return data;
    },
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['shift-schedule', scheduleId] });
    },
  });

  const createEventMut = useMutation({
    mutationFn: async (dto: { title: string; start: string; end: string; isRecurring: boolean; rcData: object | null }) => {
      const { data } = await apiClient.post(
        `/admin/shift-schedules/${scheduleId}/events`,
        { ...dto, textColor: '#ffffff', backgroundColor: '#3788d8' },
        { headers },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-schedule-events', scheduleId] }),
  });

  const deleteEventMut = useMutation({
    mutationFn: async (eventId: string) => {
      await apiClient.delete(
        `/admin/shift-schedules/${scheduleId}/events/${eventId}`,
        { headers },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-schedule-events', scheduleId] }),
  });

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateMut.mutateAsync({ name: values.name, description: values.description || undefined });
    } catch (err) {
      const e = toApiError(err);
      if (e.status) message.error(e.message);
    }
  };

  const handleSelect = (arg: DateSelectArg) => {
    eventForm.resetFields();
    eventForm.setFieldsValue({ isRecurring: 0, endDateType: 1, repeatDays: [] });
    setEventModal({ open: true, startStr: arg.startStr, endStr: arg.endStr });
  };

  const handleCreateEvent = async () => {
    try {
      const values = await eventForm.validateFields();
      setCreating(true);
      const isRecurring = values.isRecurring === 1;
      // Build the composite rcData blob the backend stores in
      // shift_schedule_data.rc_data — matches legacy field names.
      const rcData: Record<string, unknown> | null = isRecurring
        ? {
            repeat_day: values.repeatDays ?? [],
            end_date_type: values.endDateType ?? 1,
            end_date: values.endDate ? values.endDate.toISOString() : null,
            end_occurrence: values.endOccurrences ?? null,
          }
        : null;
      await createEventMut.mutateAsync({
        title: values.title,
        start: eventModal.startStr,
        end: eventModal.endStr,
        isRecurring,
        rcData,
      });
      message.success('Event created');
      setEventModal({ open: false, startStr: '', endStr: '' });
      eventForm.resetFields();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    } finally {
      setCreating(false);
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    Modal.confirm({
      title: `Delete event "${arg.event.title}"?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => deleteEventMut.mutate(arg.event.id),
    });
  };

  if (isLoading) return <Spin style={{ margin: 48 }} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/shift-schedules">
          <Button type="text" icon={<ArrowLeftOutlined />} />
        </Link>
        <Title level={3} style={{ margin: 0 }}>
          {schedule?.name ?? 'Edit shift schedule'}
        </Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Schedule details">
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="name"
                    label="Name"
                    rules={[{ required: true, message: 'Name is required.' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="description" label="Description">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Button
                type="primary"
                onClick={handleSave}
                loading={updateMut.isPending}
              >
                Save
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Shift calendar">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Click and drag to add a shift event. Click an existing event to delete it.
            </Typography.Text>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek',
              }}
              events={events.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                textColor: e.textColor,
                backgroundColor: e.backgroundColor,
              }))}
              selectable
              select={handleSelect}
              eventClick={handleEventClick}
              height="auto"
            />
          </Card>
        </Col>
      </Row>

      {/* Event create modal (replaces window.prompt) */}
      <Modal
        open={eventModal.open}
        title="New shift event"
        onCancel={() => { setEventModal({ open: false, startStr: '', endStr: '' }); eventForm.resetFields(); }}
        onOk={handleCreateEvent}
        okText="Create"
        confirmLoading={creating}
        destroyOnClose
        width={520}
        maskClosable={false}
      >
        <Form<EventFormShape>
          form={eventForm}
          layout="vertical"
          preserve={false}
          initialValues={{ isRecurring: 0, endDateType: 1, repeatDays: [] }}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input autoFocus maxLength={120} />
          </Form.Item>
          <Form.Item name="isRecurring" label="Recurrence" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value={0}>Once</Radio>
              <Radio value={1}>Repeats</Radio>
            </Radio.Group>
          </Form.Item>
          {watchedIsRecurring === 1 && (
            <>
              <Form.Item name="repeatDays" label="Repeat on">
                <Checkbox.Group options={REPEAT_DAY_OPTIONS} />
              </Form.Item>
              <Form.Item name="endDateType" label="Ends" rules={[{ required: true }]}>
                <Select options={END_DATE_TYPE_OPTIONS} />
              </Form.Item>
              {watchedEndDateType === 2 && (
                <Form.Item name="endDate" label="End date" rules={[{ required: true, message: 'End date is required' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              )}
              {watchedEndDateType === 3 && (
                <Form.Item name="endOccurrences" label="Occurrences" rules={[{ required: true, message: 'Occurrence count is required' }]}>
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
