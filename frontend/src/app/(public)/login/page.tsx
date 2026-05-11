'use client';

import {
  ArrowLeftOutlined,
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { App, Button, Card, Input, Space, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { brand } from '../../../lib/assets';
import { apiClient, toApiError } from '../../../lib/api-client';
import { useLogin } from '../../../lib/api/auth';
import type { MeResponse } from '../../../lib/api/types';
import { PublicShell } from '../../../components/layout/PublicShell';

const { Title, Text } = Typography;

const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email' }),
  password: z.string().min(1, { message: 'Password is required' }),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/dashboard';
  const login = useLogin();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

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
      message.success('Signed in.');
      router.push(me.isAdmin ? '/admin/dashboard' : next);
    } catch (err) {
      const e = toApiError(err);
      message.error(e.status === 401 ? 'Invalid email or password.' : e.message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <PublicShell minimal>
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
            aria-label="Back to home"
            style={{
              color: 'rgba(0,0,0,0.45)',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            <ArrowLeftOutlined /> Back
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
              Sign in to your account
            </Title>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Email
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
                      placeholder="you@company.com"
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
                  Password
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
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <Button type="primary" size="large" htmlType="submit" loading={submitting} block>
                Sign in
              </Button>
            </Space>
          </form>

          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', marginTop: 24, fontSize: 12 }}
          >
            Need an account? Email <a href="mailto:info@fpanalyzer.se">info@fpanalyzer.se</a>
          </Text>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#f5f7f9',
              borderRadius: 6,
              fontSize: 11,
              color: '#666',
            }}
          >
            <strong>Dev credentials:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              <li><code>user1@gmail.com</code> / <code>password123</code> — Administrator</li>
              <li><code>user2@gmail.com</code> / <code>password123</code> — Company (demo tenant)</li>
            </ul>
          </div>
        </Card>
      </main>
    </PublicShell>
  );
}
