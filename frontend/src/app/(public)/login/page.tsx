'use client';

import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { App, Alert, Button, Card, Input, Space, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { brand } from '../../../lib/assets';
import { apiClient, toApiError } from '../../../lib/api-client';
import { useLogin } from '../../../lib/api/auth';
import type { MeResponse } from '../../../lib/api/types';
import { PublicShell } from '../../../components/layout/PublicShell';
import { PublicLocaleSwitcher } from '../../../components/layout/PublicLocaleSwitcher';

const { Title, Text } = Typography;

function ResendConfirmLink({ email }: { email: string }) {
  const t = useTranslations('texts');
  const { message } = App.useApp();
  const [sent, setSent] = useState(false);

  const resend = async () => {
    try {
      await apiClient.post('/auth/confirm/resend', { email });
      setSent(true);
      message.success(t('confirmation_resent'));
    } catch {
      message.error(t('confirmation_resend_failed'));
    }
  };

  if (sent) return <span style={{ color: '#52c41a' }}>{t('confirmation_resent_short')}</span>;
  return (
    <button
      type="button"
      onClick={resend}
      style={{ background: 'none', border: 'none', color: '#1677ff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
    >
      <MailOutlined style={{ marginRight: 4 }} />
      {t('resend_confirmation_email')}
    </button>
  );
}

type LoginValues = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/dashboard';
  const login = useLogin();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const t = useTranslations('texts');

  // Build the Zod schema with translated error messages. Memoising on
  // `t` keeps the resolver stable until the locale (and thus `t`) changes.
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t('validation_email_invalid') }),
        password: z.string().min(1, { message: t('validation_password_required') }),
      }),
    [t],
  );

  const { control, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await login.mutateAsync(values);
      const { data: me } = await apiClient.get<MeResponse>('/me');
      message.success(t('signed_in'));
      router.push(me.isAdmin ? '/admin/dashboard' : next);
    } catch (err) {
      const e = toApiError(err);
      if (e.status === 403 && e.message === 'account_not_confirmed') {
        setUnconfirmedEmail(values.email);
      } else {
        message.error(e.status === 401 ? t('invalid_email_or_password') : e.message);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <PublicShell minimal>
      {/* Floating EN/SV switch — fixed top-right of the viewport so it
          doesn't compete with the centred card for space. */}
      <PublicLocaleSwitcher />
      <main
        style={{
          minHeight: 'calc(100vh - 64px - 90px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <Card
          bordered
          style={{ width: '100%', maxWidth: 420 }}
          bodyStyle={{ padding: 32 }}
        >
          <Link
            href="/"
            aria-label={t('back')}
            style={{
              color: 'rgba(0,0,0,0.45)',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            <ArrowLeftOutlined /> {t('back')}
          </Link>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Image
              src={brand.logo}
              alt="FP Analyzer"
              width={180}
              height={48}
              priority
              style={{ height: 48, width: 'auto' }}
            />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4, fontWeight: 500 }}>
              {t('sign_in_to_your_account')}
            </Title>
          </div>

          {unconfirmedEmail && (
            <Alert
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              style={{ marginBottom: 16 }}
              message={t('account_not_confirmed_title')}
              description={
                <>
                  {t('account_not_confirmed_body')}{' '}
                  <ResendConfirmLink email={unconfirmedEmail} />
                </>
              }
            />
          )}

          <form onSubmit={onSubmit} noValidate>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  {t('email')}
                </label>
                <Controller
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      size="large"
                      autoComplete="email"
                      autoFocus
                      prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
                      placeholder={t('email_placeholder')}
                      status={errors.email ? 'error' : ''}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                  )}
                />
                {errors.email && (
                  <div id="email-error" role="alert" style={{ color: '#dd4b39', fontSize: 12, marginTop: 4 }}>
                    {errors.email.message}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  {t('password')}
                </label>
                <Controller
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      id="password"
                      size="large"
                      autoComplete="current-password"
                      prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
                      placeholder="•••••••••"
                      status={errors.password ? 'error' : ''}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'pw-error' : undefined}
                    />
                  )}
                />
                {errors.password && (
                  <div id="pw-error" role="alert" style={{ color: '#dd4b39', fontSize: 12, marginTop: 4 }}>
                    {errors.password.message}
                  </div>
                )}
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <Link href="/password/reset" style={{ fontSize: 12 }}>
                    {t('forgot_your_password')}
                  </Link>
                </div>
              </div>

              <Button type="primary" size="large" htmlType="submit" loading={submitting} block>
                {t('sign_in')}
              </Button>
            </Space>
          </form>

          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', marginTop: 24, fontSize: 12 }}
          >
            {t('need_an_account')} <a href="mailto:info@fpanalyzer.se">info@fpanalyzer.se</a>
          </Text>

          {/* Dev credentials hint block removed per operator request. */}
        </Card>
      </main>
    </PublicShell>
  );
}
