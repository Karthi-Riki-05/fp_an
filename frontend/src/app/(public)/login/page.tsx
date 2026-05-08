'use client';

import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Card, Divider, Form, Input, Typography } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toApiError } from '../../../lib/api-client';
import { useLogin } from '../../../lib/api/auth';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/dashboard';
  const login = useLogin();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login.mutateAsync(values);
      message.success('Signed in.');
      router.push(next);
    } catch (err) {
      const e = toApiError(err);
      message.error(e.status === 401 ? 'Invalid email or password.' : e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f5f5f7',
      }}
    >
      <Card style={{ width: 380 }} bordered>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            FP Analyzer
          </Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        <Form<FormValues>
          name="login"
          autoComplete="off"
          onFinish={onSubmit}
          layout="vertical"
          initialValues={{ email: '', password: '' }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required.' },
              { type: 'email', message: 'Enter a valid email.' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="you@company.com" autoFocus />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password is required.' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="•••••••••" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Sign in
            </Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ margin: '8px 0 12px' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            dev credentials
          </Text>
        </Divider>
        <ul style={{ fontSize: 12, color: '#6b6b6b', margin: 0, paddingLeft: 16 }}>
          <li>
            <code>admin@fpanalyzer.local</code> / <code>dev-password-change-me</code> — Admin
          </li>
          <li>
            <code>user@demo.local</code> / <code>demo-password</code> — Demo tenant user
          </li>
        </ul>
      </Card>
    </main>
  );
}
