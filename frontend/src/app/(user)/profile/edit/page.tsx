'use client';

/**
 * /profile/edit — dedicated "Edit profile" page (PATCH /me).
 *
 * The change-password flow lives at /profile/password. Splitting the
 * two is per operator request — each card was on the same page in the
 * previous iteration, which was confusing. This page intentionally does
 * NOT wrap its contents in <UserShell>: the (user) route group's
 * layout already does so, and double-wrapping caused a duplicated
 * MarketingHeader.
 */

import { App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';

const { Title, Text } = Typography;

interface ProfileForm {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function ProfileEditPage() {
  const t = useTranslations('texts');
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const { message } = App.useApp();

  const [form] = Form.useForm<ProfileForm>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me) return;
    form.setFieldsValue({
      name: me.name ?? '',
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      email: me.email ?? '',
    });
  }, [me, form]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiClient.patch('/me', values);
      message.success(t('profile_updated'));
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const e = toApiError(err);
      if (e.status === 409) message.error(t('email_in_use'));
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

      <Card title={t('edit_profile')} loading={isLoading} style={{ marginBottom: 24 }}>
        <Form<ProfileForm> form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('name')}
            rules={[{ required: true, message: t('name_required') }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="firstName" label={t('first_name')}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="lastName" label={t('last_name')}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('email')}
            rules={[
              { required: true, message: t('validation_email_invalid') },
              { type: 'email', message: t('validation_email_invalid') },
            ]}
          >
            <Input type="email" />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={onSave} loading={saving}>
              {t('save_changes')}
            </Button>
            <Button onClick={() => router.back()}>{t('cancel')}</Button>
          </Space>
        </Form>
      </Card>

      {/* Cross-link to the dedicated password page (per operator request:
          edit + change-password live on separate routes now). */}
      <Text type="secondary">
        <Link href="/profile/password">{t('change_password')} →</Link>
      </Text>
    </div>
  );
}
