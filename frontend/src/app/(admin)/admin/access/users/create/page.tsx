'use client';

import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Col, Divider, Input, InputNumber, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toApiError } from '../../../../../../lib/api-client';
import { CreateAdminUserInput, TenantScope, useCreateAdminUser } from '../../../../../../lib/api/admin-users';
import { useMe } from '../../../../../../lib/api/auth';
import { useRoles } from '../../../../../../lib/api/roles';
import { useCompaniesForPicker } from '../../../../../../lib/api/companies';
import CompanyAdminCreateUserForm from '../../../../../../components/users/CompanyAdminCreateUserForm';

const { Title, Text } = Typography;

const SHARED_HOST = process.env.NEXT_PUBLIC_DB_HOST || 'postgres:5432';

/* ---- field wrapper ---- */
function FormField({ label, required, error, children, note }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; note?: string;
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
        {note && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{note}</div>}
        {error && <div style={{ color: '#dd4b39', fontSize: 12, marginTop: 3 }}>{error}</div>}
      </Col>
    </Row>
  );
}

interface FormValues {
  /* ── DB section ── */
  dbHost: string;
  dbName: string;
  dbUsername: string;
  dbPassword: string;
  /* ── Tenant selector (existing tenant, for non-Company users) ── */
  tenantId: number | null;
  /* ── User section ── */
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  sessionTimeout: number;
  active: boolean;
  confirmed: boolean;
  sendConfirmationEmail: boolean;
  roles: string[];
  unitOnly: boolean;
}

export default function CreateUserPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: allRoles, isLoading: rolesLoading } = useRoles();
  const { data: companiesList } = useCompaniesForPicker({ enabled: me?.isAdmin ?? false });
  const [submitting, setSubmitting] = useState(false);

  // For creating a user within an existing tenant, pass X-Tenant-Id dynamically.
  // We start with null and update when the tenant selector changes.
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

  const scope: TenantScope = {
    tenantId: selectedTenantId,
    isAdmin: me?.isAdmin ?? false,
  };
  const create = useCreateAdminUser(scope);

  const activeTenant = me?.tenants.find((t) => t.id === me.activeTenantId) ?? me?.tenants[0] ?? null;
  const defaultDbName = activeTenant?.schemaName ?? '';

  const {
    control, handleSubmit, watch, setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      dbHost: SHARED_HOST,
      dbName: defaultDbName,
      dbUsername: 'admin',
      dbPassword: '',
      tenantId: null,
      name: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      sessionTimeout: 5,
      active: true,
      confirmed: true,
      sendConfirmationEmail: false,
      roles: ['Company'],
      unitOnly: false,
    },
  });

  const confirmedValue = watch('confirmed');
  const selectedRoles = watch('roles');
  const dbNameValue = watch('dbName');

  const isCompanyRole = selectedRoles.includes('Company');

  const onSubmit = handleSubmit(async (values) => {
    if (values.password !== values.passwordConfirmation) {
      setError('passwordConfirmation', { type: 'manual', message: 'Passwords do not match.' });
      return;
    }
    if (!isCompanyRole && !selectedTenantId && me?.isAdmin) {
      setError('tenantId' as never, { type: 'manual', message: 'Select an existing tenant for this user.' });
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateAdminUserInput & {
        roles?: string[]; unitOnly?: boolean; sessionTimeout?: number;
        newTenantName?: string; tenantDbName?: string;
      } = {
        name: values.name,
        email: values.email,
        password: values.password,
        confirmed: values.confirmed,
        active: values.active,
        roles: values.roles,
        unitOnly: values.unitOnly,
        sessionTimeout: values.sessionTimeout,
      };

      if (isCompanyRole && values.dbName) {
        // New company → provision a separate database
        input.newTenantName = values.name;
        input.tenantDbName = values.dbName;
      }
      // For existing-tenant path: selectedTenantId drives X-Tenant-Id via scope
      await create.mutateAsync(input);
      message.success('User created successfully.');
      router.push('/admin/access/users');
    } catch (err) {
      const e = toApiError(err);
      if (e.status === 409 && /email/i.test(e.message)) {
        setError('email', { type: 'server', message: 'This email is already in use.' });
      } else if (e.status === 409 && /database/i.test(e.message)) {
        setError('dbName', { type: 'server', message: 'A database with this name already exists.' });
      } else {
        message.error(e.message || 'Failed to create user.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (!me) return <Spin style={{ margin: '60px auto', display: 'block' }} />;

  // Company-Admin callers get the simplified sub-user form (legacy
  // /admin/company/useradd). Administrators keep the full form with the
  // Database information section that provisions a new tenant schema.
  const isCompanyAdmin = me.roles.includes('Company') && !me.isAdmin;
  if (isCompanyAdmin) {
    return <CompanyAdminCreateUserForm />;
  }

  const availableRoles = (allRoles ?? []).filter((r) => !r.all);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>User Management</Title>
        <Space>
          <Button type="primary" style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
            onClick={() => router.push('/admin/access/users')}>Users ▾</Button>
          <Button onClick={() => router.push('/admin/access/roles')}>Roles ▾</Button>
        </Space>
      </div>

      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ padding: '0 4px' }} />
            <span style={{ fontWeight: 600 }}>Create User</span>
          </Space>
        }
        styles={{ header: { background: '#f4f6f9', borderBottom: '1px solid #e0e0e0' } }}
      >
        <form onSubmit={onSubmit} noValidate>

          {/* ── Database Information ─────────────────────── */}
          <Text strong style={{ fontSize: 14, color: '#333' }}>Database information</Text>
          <Divider style={{ margin: '8px 0 16px' }} />

          {isCompanyRole && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span style={{ fontSize: 12 }}>
                  A new PostgreSQL database named <strong>{dbNameValue || '(db name)'}</strong> will
                  be created on <strong>{SHARED_HOST}</strong> and populated with all company tables.
                </span>
              }
            />
          )}

          <FormField label="Host Name" note="Shared PostgreSQL server — same host for all companies">
            <Controller control={control} name="dbHost"
              render={({ field }) => <Input {...field} disabled style={{ background: '#f5f5f5', color: '#555' }} />}
            />
          </FormField>

          <FormField
            label="Database Name"
            required={isCompanyRole}
            error={(errors.dbName as { message?: string })?.message}
            note={isCompanyRole ? 'This name will be used to create the new PostgreSQL database.' : undefined}
          >
            <Controller control={control} name="dbName"
              rules={isCompanyRole ? {
                required: 'Database name is required for Company users',
                pattern: { value: /^[a-z][a-z0-9_]{0,62}$/, message: 'Lowercase letters, numbers and underscores only' },
              } : {}}
              render={({ field }) => (
                <Input
                  {...field}
                  disabled={!isCompanyRole}
                  placeholder={isCompanyRole ? 'e.g. volvo_db' : ''}
                  style={!isCompanyRole ? { background: '#f5f5f5', color: '#555' } : {}}
                />
              )}
            />
          </FormField>

          <FormField label="Database Username" note="Shared credentials managed by platform">
            <Controller control={control} name="dbUsername"
              render={({ field }) => <Input {...field} disabled style={{ background: '#f5f5f5', color: '#555' }} />}
            />
          </FormField>

          <FormField label="Database Password">
            <Input
              disabled
              value="••••••••"
              suffix={<LockOutlined style={{ color: '#aaa' }} />}
              style={{ background: '#f5f5f5', color: '#555', maxWidth: 200 }}
            />
          </FormField>

          {/* ── Tenant selector — only for non-Company roles ─────── */}
          {!isCompanyRole && me?.isAdmin && (
            <>
              <div style={{ marginTop: 20 }}>
                <Text strong style={{ fontSize: 14, color: '#333' }}>Tenant</Text>
              </div>
              <Divider style={{ margin: '8px 0 16px' }} />
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={<span style={{ fontSize: 12 }}>
                  Select which existing company (tenant) this user belongs to.
                  They will be added to that company&apos;s workspace.
                </span>}
              />
              <FormField
                label="Select Tenant"
                required
                error={typeof (errors as Record<string, { message?: string }>).tenantId?.message === 'string'
                  ? (errors as Record<string, { message?: string }>).tenantId.message
                  : undefined}
              >
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select a company tenant…"
                  showSearch
                  optionFilterProp="label"
                  value={selectedTenantId}
                  onChange={(v) => setSelectedTenantId(v)}
                  options={(companiesList ?? [])
                    .map((c) => ({ value: c.id, label: c.name }))}
                />
              </FormField>
            </>
          )}

          {/* ── Company Information ────────────────────── */}
          <div style={{ marginTop: 20 }}>
            <Text strong style={{ fontSize: 14, color: '#333' }}>Company information</Text>
          </div>
          <Divider style={{ margin: '8px 0 16px' }} />

          <FormField label="Name" required error={errors.name?.message}>
            <Controller control={control} name="name"
              rules={{ required: 'Name is required', maxLength: { value: 191, message: 'Max 191 characters' } }}
              render={({ field }) => <Input {...field} placeholder="Name" autoComplete="off" />}
            />
          </FormField>

          <FormField label="E-mail Address" required error={errors.email?.message}>
            <Controller control={control} name="email"
              rules={{ required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } }}
              render={({ field }) => <Input {...field} type="email" placeholder="E-mail Address" autoComplete="off" />}
            />
          </FormField>

          <FormField label="Password" required error={errors.password?.message}>
            <Controller control={control} name="password"
              rules={{ required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } }}
              render={({ field }) => <Input.Password {...field} placeholder="Password" autoComplete="new-password" />}
            />
          </FormField>

          <FormField label="Password Confirmation" required error={errors.passwordConfirmation?.message}>
            <Controller control={control} name="passwordConfirmation"
              rules={{ required: 'Please confirm your password' }}
              render={({ field }) => <Input.Password {...field} placeholder="Password Confirmation" autoComplete="new-password" />}
            />
          </FormField>

          <FormField label="Session Timeout (min)">
            <Controller control={control} name="sessionTimeout"
              render={({ field }) => <InputNumber {...field} min={1} max={1440} style={{ width: 120 }} />}
            />
          </FormField>

          <FormField label="Active">
            <Controller control={control} name="active"
              render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </FormField>

          <FormField label="Confirmed">
            <Controller control={control} name="confirmed"
              render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </FormField>

          {!confirmedValue && (
            <FormField label="Send Confirmation Email">
              <Controller control={control} name="sendConfirmationEmail"
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                    <Text type="secondary" style={{ fontSize: 12 }}>(If confirmed is off)</Text>
                  </Checkbox>
                )}
              />
            </FormField>
          )}

          <FormField label="Associated Roles">
            {rolesLoading ? <Spin size="small" /> : (
              <Controller control={control} name="roles"
                render={({ field }) => (
                  <Space direction="vertical" size={6}>
                    {availableRoles.map((role) => (
                      <Space key={role.id} size={8}>
                        <Checkbox
                          checked={field.value.includes(role.name)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...field.value, role.name]
                              : field.value.filter((r) => r !== role.name);
                            field.onChange(next);
                          }}
                        >
                          {role.name}
                        </Checkbox>
                        {field.value.includes(role.name) && (
                          <Tag color="blue" style={{ fontSize: 11 }}>{role.permissionCount} permissions</Tag>
                        )}
                      </Space>
                    ))}
                  </Space>
                )}
              />
            )}
          </FormField>

          <FormField label="Unit Only">
            <Controller control={control} name="unitOnly"
              render={({ field }) => <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            />
          </FormField>

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
