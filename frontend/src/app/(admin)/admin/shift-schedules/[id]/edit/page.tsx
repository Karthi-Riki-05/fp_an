'use client';

import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Checkbox,
  ColorPicker,
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
import type { Color } from 'antd/es/color-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import dayjs, { type Dayjs } from 'dayjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  isRecurring?: boolean;
  parentId?: number;
  rcData?: string | null;
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
  textColor: string | Color;
  backgroundColor: string | Color;
  isRecurring: 0 | 1;
  startAt: Dayjs;
  endAt: Dayjs;
  repeatDays?: number[];
  endDateType?: 1 | 2 | 3;
  endDate?: Dayjs | null;
  endOccurrences?: number;
}

function toHex(c: string | Color | undefined, fallback: string): string {
  if (!c) return fallback;
  if (typeof c === 'string') return c;
  // AntD ColorPicker Color object
  return (c as Color).toHexString();
}

function formatDuration(start?: Dayjs, end?: Dayjs): string {
  if (!start || !end) return '--:--';
  const diffMin = end.diff(start, 'minute');
  if (!Number.isFinite(diffMin) || diffMin < 0) return '--:--';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ShiftScheduleEditPage({
  params,
}: {
  params: { id: string };
}) {
  const scheduleId = Number(params.id);

  const { data: me } = useMe();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<{ name: string; description: string }>();
  const [eventForm] = Form.useForm<EventFormShape>();
  // editingId === null → create; number → edit existing row id (real DB id,
  // not the synthetic recurring-occurrence id).
  const [eventModal, setEventModal] = useState<{
    open: boolean;
    editingId: number | null;
    startStr: string;
    endStr: string;
  }>({ open: false, editingId: null, startStr: '', endStr: '' });
  const [creating, setCreating] = useState(false);
  // Floating Edit/Remove menu — anchored to the click point, rendered as
  // a fixed-position card so FullCalendar's own drag handlers stay intact.
  const [eventMenu, setEventMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    eventId: string;
    title: string;
  }>({ open: false, x: 0, y: 0, eventId: '', title: '' });

  // Watch the conditional radio/select to drive field visibility + duration.
  const watchedIsRecurring = Form.useWatch('isRecurring', eventForm);
  const watchedEndDateType = Form.useWatch('endDateType', eventForm);
  const watchedStart = Form.useWatch('startAt', eventForm);
  const watchedEnd = Form.useWatch('endAt', eventForm);

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
    mutationFn: async (dto: {
      title: string;
      start: string;
      end: string;
      isRecurring: boolean;
      textColor: string;
      backgroundColor: string;
      rcData: object | null;
    }) => {
      const { data } = await apiClient.post(
        `/admin/shift-schedules/${scheduleId}/events`,
        dto,
        { headers },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-schedule-events', scheduleId] }),
  });

  const updateEventMut = useMutation({
    mutationFn: async (vars: {
      eventId: number;
      dto: Partial<{
        title: string;
        start: string;
        end: string;
        isRecurring: boolean;
        textColor: string;
        backgroundColor: string;
        rcData: object | null;
      }>;
    }) => {
      const { data } = await apiClient.patch(
        `/admin/shift-schedules/${scheduleId}/events/${vars.eventId}`,
        vars.dto,
        { headers },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-schedule-events', scheduleId] }),
  });

  const deleteEventMut = useMutation({
    mutationFn: async (eventId: number) => {
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
    eventForm.setFieldsValue({
      isRecurring: 0,
      endDateType: 1,
      repeatDays: [],
      textColor: '#ffffff',
      backgroundColor: '#3788d8',
      startAt: dayjs(arg.startStr),
      endAt: dayjs(arg.endStr),
    });
    setEventModal({ open: true, editingId: null, startStr: arg.startStr, endStr: arg.endStr });
  };

  // Recurring events come back with synthetic ids like "12-2026-05-18T...".
  // For edit/delete we need the real DB id, which the backend exposes as
  // `parentId` on expanded occurrences (or matches `id` for non-recurring).
  //
  // NOTE: events[].id arrives from the API as a NUMBER (postgres int),
  // while FullCalendar normalises `arg.event.id` to a STRING. Compare
  // via String(...) on both sides — `===` against a number/string
  // mismatch silently fails and was the cause of "Edit does nothing".
  const resolveRealId = (rawId: string): number | null => {
    const ev = events.find((e) => String(e.id) === String(rawId));
    if (ev?.isRecurring && ev.parentId) return ev.parentId;
    if (ev) return Number(ev.id);
    // Fall back to parsing the raw id (handles the synthetic
    // "<parentId>-<iso>" form for recurring occurrences when the lookup
    // misses, e.g. across paginated event windows).
    const parsed = Number(String(rawId).split('-')[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const openEditModal = (rawId: string) => {
    const ev = events.find((e) => String(e.id) === String(rawId));
    if (!ev) return;
    const realId = resolveRealId(rawId);
    if (!realId) return;
    let rc: Record<string, unknown> = {};
    try { rc = ev.rcData ? JSON.parse(ev.rcData) : {}; } catch { rc = {}; }
    const endDateType = Number(rc.end_date_type ?? 1) as 1 | 2 | 3;
    const repeatDays = Array.isArray(rc.repeat_day)
      ? (rc.repeat_day as Array<number | string>).map((d) => Number(d))
      : [];
    eventForm.resetFields();
    eventForm.setFieldsValue({
      title: ev.title,
      textColor: ev.textColor || '#ffffff',
      backgroundColor: ev.backgroundColor || '#3788d8',
      isRecurring: ev.isRecurring ? 1 : 0,
      startAt: dayjs(ev.start),
      endAt: dayjs(ev.end),
      repeatDays,
      endDateType,
      endDate: rc.end_date ? dayjs(rc.end_date as string) : null,
      endOccurrences: rc.end_occurrence != null ? Number(rc.end_occurrence) : undefined,
    });
    setEventModal({ open: true, editingId: realId, startStr: ev.start, endStr: ev.end });
    setEventMenu((m) => ({ ...m, open: false }));
  };

  const handleSaveEvent = async () => {
    try {
      const values = await eventForm.validateFields();
      setCreating(true);
      const isRecurring = values.isRecurring === 1;
      // Build the composite rcData blob the backend stores in
      // shift_schedule_data.rc_data — matches legacy field names. Only
      // include the conditional fields that the chosen end-date-type
      // actually needs (No-end → neither, On-date → end_date,
      // After-N → end_occurrence).
      const endDateType = values.endDateType ?? 1;
      const rcData: Record<string, unknown> | null = isRecurring
        ? {
            repeat_day: values.repeatDays ?? [],
            end_date_type: endDateType,
            end_date: endDateType === 2 && values.endDate ? values.endDate.toISOString() : null,
            end_occurrence: endDateType === 3 && values.endOccurrences != null
              ? Number(values.endOccurrences)
              : null,
          }
        : null;
      const payload = {
        title: values.title,
        start: values.startAt.format('YYYY-MM-DDTHH:mm:ss'),
        end: values.endAt.format('YYYY-MM-DDTHH:mm:ss'),
        isRecurring,
        textColor: toHex(values.textColor, '#ffffff'),
        backgroundColor: toHex(values.backgroundColor, '#3788d8'),
        rcData,
      };
      if (eventModal.editingId != null) {
        await updateEventMut.mutateAsync({ eventId: eventModal.editingId, dto: payload });
        message.success('Event updated');
      } else {
        await createEventMut.mutateAsync(payload);
        message.success('Event created');
      }
      setEventModal({ open: false, editingId: null, startStr: '', endStr: '' });
      eventForm.resetFields();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    } finally {
      setCreating(false);
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    // Anchor the floating Edit/Remove menu to the click coordinates.
    // We use jsEvent (the underlying DOM MouseEvent) and viewport
    // coordinates because the menu itself is `position: fixed`.
    const ev = arg.jsEvent as MouseEvent | undefined;
    const x = ev?.clientX ?? 0;
    const y = ev?.clientY ?? 0;
    setEventMenu({
      open: true,
      x,
      y,
      eventId: arg.event.id,
      title: arg.event.title || 'Shift event',
    });
  };

  // Close the floating menu on outside click / Escape.
  useEffect(() => {
    if (!eventMenu.open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-event-menu]')) return;
      setEventMenu((m) => ({ ...m, open: false }));
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEventMenu((m) => ({ ...m, open: false }));
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [eventMenu.open]);

  const handleEventDrop = async (arg: EventDropArg) => {
    const realId = resolveRealId(arg.event.id);
    if (!realId) { arg.revert(); return; }
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) { arg.revert(); return; }
    try {
      await updateEventMut.mutateAsync({
        eventId: realId,
        dto: {
          start: dayjs(start).format('YYYY-MM-DDTHH:mm:ss'),
          end: dayjs(end).format('YYYY-MM-DDTHH:mm:ss'),
        },
      });
      message.success('Event moved');
    } catch (err) {
      message.error(toApiError(err).message);
      arg.revert();
    }
  };

  const handleEventResize = async (arg: EventDropArg) => {
    // Same payload as drop — FullCalendar resize gives us new start/end.
    await handleEventDrop(arg);
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
              Click and drag a blank slot to add a shift. Drag an existing
              event to move it. Click an event for Edit / Remove.
            </Typography.Text>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              events={events.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                textColor: e.textColor,
                backgroundColor: e.backgroundColor,
                // Recurring occurrences are synthetic — editing/dragging
                // them by themselves doesn't map back to a row. Block
                // drag for those; the user can still click → Edit.
                editable: !e.isRecurring,
              }))}
              editable
              eventStartEditable
              eventDurationEditable
              selectable
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height="auto"
            />
          </Card>
        </Col>
      </Row>

      {/* Add / edit production time modal — matches legacy fpanalyzer layout
          (resources/views/backend/shift_schedule/create.blade.php). */}
      <Modal
        open={eventModal.open}
        title={eventModal.editingId != null ? 'Edit production time' : 'Add production time'}
        onCancel={() => { setEventModal({ open: false, editingId: null, startStr: '', endStr: '' }); eventForm.resetFields(); }}
        onOk={handleSaveEvent}
        okText="Save"
        confirmLoading={creating}
        // NOTE: do NOT use destroyOnClose here. With it on, the form body
        // unmounts when the modal closes, and the next setFieldsValue
        // call (in handleSelect / openEditModal) lands on a not-yet-mounted
        // form — so Start/End time would render blank. Keep the form
        // mounted; we explicitly reset/repopulate on each open.
        width={640}
        maskClosable={false}
      >
        <Form<EventFormShape>
          form={eventForm}
          layout="horizontal"
          labelCol={{ span: 7 }}
          wrapperCol={{ span: 17 }}
          initialValues={{
            isRecurring: 0,
            endDateType: 1,
            repeatDays: [],
            textColor: '#ffffff',
            backgroundColor: '#3788d8',
          }}
        >
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="title"
                label="Name"
                rules={[{ required: true, message: 'Name is required' }]}
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
              >
                <Input autoFocus maxLength={120} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="textColor"
                label="Text"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
              >
                <ColorPicker showText={false} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="backgroundColor"
                label="Bg"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
              >
                <ColorPicker showText={false} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isRecurring"
            label="Type of production time"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value={0}>Once</Radio>
              <Radio value={1}>Recurrent</Radio>
            </Radio.Group>
          </Form.Item>

          {/* Recurrence-specific options come BEFORE Start/End so that
              "Duration end date" sits next to the repeat-day checkboxes
              and the date inputs are the final pair the user fills in. */}
          {watchedIsRecurring === 1 && (
            <Form.Item name="repeatDays" label="On every">
              <Checkbox.Group options={REPEAT_DAY_OPTIONS} />
            </Form.Item>
          )}

          {/* Shared Start / End fields. Same width regardless of mode;
              Duration sits on its own row so it can't squeeze the
              Start-time input. */}
          <Form.Item
            name="startAt"
            label="Start time"
            rules={[{ required: true, message: 'Start time is required' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm:ss' }}
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="endAt"
            label="End time"
            rules={[
              { required: true, message: 'End time is required' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const s = getFieldValue('startAt') as Dayjs | undefined;
                  if (!value || !s || value.isAfter(s)) return Promise.resolve();
                  return Promise.reject(new Error('End time must be after start time'));
                },
              }),
            ]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm:ss' }}
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Duration" colon>
            <Typography.Text strong>{formatDuration(watchedStart, watchedEnd)}</Typography.Text>
          </Form.Item>

          {/* In recurrent mode, the end-date controls live at the END so
              the user can decide "until when" after picking the daily
              time window. Three modes:
                1 = No end       → no extra field
                2 = On date      → DatePicker
                3 = After N      → InputNumber */}
          {watchedIsRecurring === 1 && (
            <>
              <Form.Item name="endDateType" label="Duration end date" rules={[{ required: true }]}>
                <Select options={END_DATE_TYPE_OPTIONS} />
              </Form.Item>
              {watchedEndDateType === 2 && (
                <Form.Item
                  name="endDate"
                  label="End date"
                  rules={[{ required: true, message: 'End date is required' }]}
                >
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              )}
              {watchedEndDateType === 3 && (
                <Form.Item
                  name="endOccurrences"
                  label="Occurrences"
                  rules={[{ required: true, message: 'Occurrence count is required' }]}
                >
                  <InputNumber min={1} max={365} style={{ width: '100%' }} placeholder="e.g. 10" />
                </Form.Item>
              )}
            </>
          )}
        </Form>
      </Modal>

      {/* Floating Edit / Remove menu — anchored to the click point of
          the clicked event. Rendered as a `position: fixed` card so
          FullCalendar's drag handlers stay untouched. The outside-click
          / Escape listener that closes it is wired in a useEffect. */}
      {eventMenu.open && (
        <div
          data-event-menu
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            // Keep the menu inside the viewport — clamp to a 6px gutter.
            left: Math.min(Math.max(eventMenu.x, 8), window.innerWidth - 180),
            top: Math.min(eventMenu.y + 8, window.innerHeight - 140),
            zIndex: 1100,
            minWidth: 160,
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,.12)',
            padding: 6,
          }}
        >
          <div
            style={{
              padding: '4px 10px 6px',
              borderBottom: '1px solid #f0f0f0',
              marginBottom: 4,
              fontWeight: 500,
              maxWidth: 240,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {eventMenu.title}
          </div>
          <Button
            type="text"
            block
            icon={<EditOutlined />}
            style={{ textAlign: 'left' }}
            onClick={() => openEditModal(eventMenu.eventId)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this event?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              const realId = resolveRealId(eventMenu.eventId);
              if (realId) deleteEventMut.mutate(realId);
              setEventMenu((m) => ({ ...m, open: false }));
            }}
          >
            <Button
              type="text"
              danger
              block
              icon={<DeleteOutlined />}
              style={{ textAlign: 'left' }}
            >
              Remove
            </Button>
          </Popconfirm>
        </div>
      )}
    </div>
  );
}
