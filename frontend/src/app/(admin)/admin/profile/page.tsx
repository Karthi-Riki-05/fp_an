'use client';

import { UploadOutlined } from '@ant-design/icons';
import {
  App, Button, Card, Checkbox, Form, Input, InputNumber, Select, Skeleton, Switch, Typography, Upload,
} from 'antd';
import Image from 'next/image';
import { useEffect } from 'react';
import { toApiError } from '../../../../lib/api-client';
import {
  useCompanySettings, useUpdateCompanySettings, type CompanySettings,
} from '../../../../lib/api/company-settings';

const { Title, Text } = Typography;

const COUNTRIES = [
  { value: 'SE', label: 'Sweden' }, { value: 'NO', label: 'Norway' },
  { value: 'FI', label: 'Finland' }, { value: 'DK', label: 'Denmark' },
  { value: 'DE', label: 'Germany' }, { value: 'GB', label: 'United Kingdom' },
];
const TIMEZONES = [
  'Europe/Stockholm', 'Europe/Oslo', 'Europe/Helsinki', 'Europe/Copenhagen',
  'Europe/Berlin', 'Europe/London', 'UTC',
].map((t) => ({ value: t, label: t }));
const INDUSTRIES = [
  'Automotive', 'Aerospace', 'Electronics', 'Food & Beverage', 'Pharmaceutical',
  'Metal & Machining', 'Plastics', 'Other',
].map((i) => ({ value: i, label: i }));
const PLANNED_METHODS = [
  { value: 'shift_schedule', label: 'Shift schedule' },
  { value: '24_7', label: '24/7' },
  { value: 'custom', label: 'Custom hours' },
];
const WEEKDAYS = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 7 },
];

export default function CompanySetupPage() {
  const { message } = App.useApp();
  const { data, isLoading } = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [form] = Form.useForm<CompanySettings>();

  useEffect(() => { if (data) form.setFieldsValue(data); }, [data, form]);

  const onFinish = async (values: CompanySettings) => {
    try {
      await update.mutateAsync(values);
      message.success('Company settings saved.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  // Read the chosen logo as a data URL into the form (no upload endpoint yet).
  const beforeLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => form.setFieldValue(['company', 'logoUrl'], String(reader.result));
    reader.readAsDataURL(file);
    return false; // prevent antd's auto-upload
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Company Setup</Title>
      <Text type="secondary">Company profile, OEE targets and alert preferences.</Text>

      <Form form={form} layout="vertical" initialValues={data} onFinish={onFinish} style={{ marginTop: 16 }}>
        {/* 1 — Company Information */}
        <Card title="Company Information" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Form.Item label="Company name" name={['company', 'name']} rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Acme Manufacturing AB" />
          </Form.Item>
          <Form.Item label="Industry" name={['company', 'industry']}>
            <Select options={INDUSTRIES} allowClear placeholder="Select industry" />
          </Form.Item>
          <Form.Item label="Country" name={['company', 'country']}>
            <Select options={COUNTRIES} />
          </Form.Item>
          <Form.Item label="Timezone" name={['company', 'timezone']}>
            <Select options={TIMEZONES} showSearch />
          </Form.Item>
          <Form.Item label="Logo" shouldUpdate>
            {() => {
              const url = form.getFieldValue(['company', 'logoUrl']) as string | undefined;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {url ? (
                    <Image src={url} alt="logo" width={56} height={56} unoptimized
                      style={{ objectFit: 'contain', border: '1px solid #eef0f3', borderRadius: 8 }} />
                  ) : null}
                  <Upload beforeUpload={beforeLogoUpload} maxCount={1} showUploadList={false} accept="image/*">
                    <Button icon={<UploadOutlined />}>Upload logo</Button>
                  </Upload>
                </div>
              );
            }}
          </Form.Item>
          {/* Keep logoUrl in the submitted payload. */}
          <Form.Item name={['company', 'logoUrl']} hidden><Input /></Form.Item>
        </Card>

        {/* 2 — OEE Settings */}
        <Card title="OEE Settings" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Form.Item label="Target OEE %" name={['oee', 'targetOee']}>
            <InputNumber min={0} max={100} style={{ width: 160 }} addonAfter="%" />
          </Form.Item>
          <Form.Item label="Planned time method" name={['oee', 'plannedTimeMethod']}>
            <Select options={PLANNED_METHODS} style={{ maxWidth: 280 }} />
          </Form.Item>
          <Form.Item label="Working days" name={['oee', 'workingDays']}>
            <Checkbox.Group options={WEEKDAYS} />
          </Form.Item>
        </Card>

        {/* 3 — Notification Settings */}
        <Card title="Notification Settings" style={{ borderRadius: 8, marginBottom: 16 }}>
          <Form.Item label="Stop alert threshold (minutes)" name={['notifications', 'stopAlertThresholdMin']}>
            <InputNumber min={0} max={1440} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label="Email alerts" name={['notifications', 'emailAlerts']} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Alert email address" name={['notifications', 'alertEmail']}
            rules={[{ type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="ops@company.com" />
          </Form.Item>
        </Card>

        <Button type="primary" htmlType="submit" loading={update.isPending}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>
          Save settings
        </Button>
      </Form>
    </div>
  );
}
