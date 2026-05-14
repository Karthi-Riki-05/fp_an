'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Col, Input, InputNumber, Radio, Row, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toApiError } from '../../lib/api-client';
import { useCreateCompanyUser } from '../../lib/api/admin-users';

const { Title, Text } = Typography;

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  sessionTimeout: number;
  active: boolean;
  confirmed: boolean;
  role: 'User' | 'Admin';
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <Row align="top" style={{ marginBottom: 14 }}>
      <Col span={6} style={{ textAlign: 'right', paddingRight: 12, paddingTop: 6 }}>
        <Text style={{ fontSize: 13 }}>
          {label}{required && <span style={{ color: '#dd4b39', marginLeft: 2 }}>*</span>}
        </Text>
      </Col>
      <Col span={18}>
        {children}
        {error && <div style={{ color: '#dd4b39', fontSize: 12, marginTop: 3 }}>{error}</div>}
      </Col>
    </Row>
  );
}

export default function CompanyAdminCreateUserForm() {
  const router = useRouter();
  const { message } = App.useApp();
  const create = useCreateCompanyUser();
  const [submitting, setSubmitting] = useState(false);

  const {
    control, handleSubmit, setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      sessionTimeout: 5,
      active: true,
      confirmed: false,
      role: 'User',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (values.password !== values.passwordConfirmation) {
      setError('passwordConfirmation', { type: 'manual', message: 'Passwords do not match.' });
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        name: `${values.firstName} ${values.lastName}`.trim(),
        email: values.email,
        password: values.password,
        confirmed: values.confirmed,
        active: values.active,
        sessionTimeout: values.sessionTimeout,
        roles: [values.role],
      });
      message.success('User created successfully.');
      router.push('/admin/access/users');
    } catch (err) {
      const e = toApiError(err);
      if (e.status === 409 && /email/i.test(e.message)) {
        setError('email', { type: 'server', message: 'This email is already in use.' });
      } else {
        message.error(e.message || 'Failed to create user.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Manage users</Title>
      </div>

      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ padding: '0 4px' }} />
            <span style={{ fontWeight: 600 }}>Create user</span>
          </Space>
        }
        styles={{ header: { background: '#f4f6f9', borderBottom: '1px solid #e0e0e0' } }}
      >
        <form onSubmit={onSubmit} noValidate>
          <Field label="First name" required error={errors.firstName?.message}>
            <Controller
              control={control} name="firstName"
              rules={{ required: 'First name is required' }}
              render={({ field }) => <Input {...field} placeholder="First name" autoComplete="off" />}
            />
          </Field>

          <Field label="Surname" required error={errors.lastName?.message}>
            <Controller
              control={control} name="lastName"
              rules={{ required: 'Surname is required' }}
              render={({ field }) => <Input {...field} placeholder="Surname" autoComplete="off" />}
            />
          </Field>

          <Field label="Email address" required error={errors.email?.message}>
            <Controller
              control={control} name="email"
              rules={{
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              }}
              render={({ field }) => <Input {...field} type="email" placeholder="Email address" autoComplete="off" />}
            />
          </Field>

          <Field label="Password" required error={errors.password?.message}>
            <Controller
              control={control} name="password"
              rules={{ required: 'Password is required', minLength: { value: 5, message: 'Min 5 characters' } }}
              render={({ field }) => <Input.Password {...field} autoComplete="new-password" />}
            />
          </Field>

          <Field label="Confirm password" required error={errors.passwordConfirmation?.message}>
            <Controller
              control={control} name="passwordConfirmation"
              rules={{ required: 'Please confirm your password' }}
              render={({ field }) => <Input.Password {...field} autoComplete="new-password" />}
            />
          </Field>

          <Field label="Time until automatic logout (min)">
            <Controller
              control={control} name="sessionTimeout"
              render={({ field }) => <InputNumber {...field} min={1} max={1440} style={{ width: 120 }} />}
            />
          </Field>

          <Field label="Active">
            <Controller
              control={control} name="active"
              render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </Field>

          <Field label="Confirmed">
            <Controller
              control={control} name="confirmed"
              render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </Field>

          <Field label="Role">
            <Controller
              control={control} name="role"
              render={({ field }) => (
                <Radio.Group {...field}>
                  <Radio value="User">User</Radio>
                  <Radio value="Admin">Admin</Radio>
                </Radio.Group>
              )}
            />
          </Field>

          <Row>
            <Col offset={6} span={18}>
              <Button type="primary" htmlType="submit" loading={submitting} style={{ minWidth: 100 }}>
                Create
              </Button>
            </Col>
          </Row>
        </form>
      </Card>
    </div>
  );
}
