'use client';

/**
 * /profile/password — dedicated change-password page (POST /me/password).
 *
 * Split from /profile/edit per operator request. The (user) route group
 * already wraps this in <UserShell>, so don't re-wrap here.
 */

import { App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';

const { Title, Text } = Typography;

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePasswordPage() {
  const t = useTranslations('texts');
  const router = useRouter();
  const { data: me } = useMe();
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordForm>();
  const [saving, setSaving] = useState(false);

  const onChange = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiClient.post('/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success(t('password_changed'));
      form.resetFields();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const e = toApiError(err);
      if (e.status === 401) message.error(t('current_password_incorrect'));
      else message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }}>
      <Title level={3} style={{ margin: '0 0 4px' }}>{t('profile_title')}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {me?.email ?? ''}
      </Text>

      <Card title={t('change_password')} style={{ marginBottom: 24 }}>
        <Form<PasswordForm> form={form} layout="vertical">
          <Form.Item
            name="currentPassword"
            label={t('current_password')}
            rules={[{ required: true, message: t('validation_password_required') }]}
          >
            <Input.Password id="currentPassword" autoFocus autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t('new_password')}
            rules={[
              { required: true, message: t('validation_password_required') },
              { min: 8, message: t('password_min_8') },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('confirm_new_password')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('validation_password_required') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value === getFieldValue('newPassword')) return Promise.resolve();
                  return Promise.reject(new Error(t('passwords_dont_match')));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={onChange} loading={saving}>
              {t('change_password')}
            </Button>
            <Button onClick={() => router.back()}>{t('cancel')}</Button>
          </Space>
        </Form>
      </Card>

      <Text type="secondary">
        <Link href="/profile/edit">← {t('edit_profile')}</Link>
      </Text>
    </div>
  );
}
