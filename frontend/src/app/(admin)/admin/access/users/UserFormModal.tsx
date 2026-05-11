'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { App, Checkbox, Input, Modal, Space } from 'antd';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { toApiError } from '../../../../../lib/api-client';
import {
  CreateAdminUserInput,
  TenantScope,
  UpdateAdminUserInput,
  useCreateAdminUser,
  useUpdateAdminUser,
} from '../../../../../lib/api/admin-users';
import type { AdminUser } from '../../../../../lib/api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided we're editing; password becomes optional. */
  user?: AdminUser | null;
  scope: TenantScope;
}

// Create vs. update share most rules. We branch on whether a user is provided.
const baseSchema = {
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional(),
};

const createSchema = z.object({
  ...baseSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
});

const updateSchema = z.object({
  ...baseSchema,
  password: z
    .string()
    .max(255)
    .optional()
    .refine((v) => !v || v.length >= 8, { message: 'Password must be at least 8 characters' }),
});

type FormValues = z.infer<typeof createSchema>;

export function UserFormModal({ open, onClose, user, scope }: Props) {
  const isEdit = Boolean(user);
  const { message } = App.useApp();
  const create = useCreateAdminUser(scope);
  const update = useUpdateAdminUser(scope);

  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(isEdit ? updateSchema : createSchema) as never,
      defaultValues: {
        name: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        confirmed: true,
        active: true,
      },
      mode: 'onBlur',
    });

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        confirmed: user?.confirmed ?? true,
        active: user?.active ?? true,
      });
    }
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && user) {
        const input: UpdateAdminUserInput = {
          name: values.name,
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          confirmed: values.confirmed,
          active: values.active,
        };
        if (values.password && values.password.length > 0) input.password = values.password;
        await update.mutateAsync({ id: user.id, input });
        message.success('User updated.');
      } else {
        const input: CreateAdminUserInput = {
          name: values.name,
          email: values.email,
          password: values.password!,
          firstName: values.firstName,
          lastName: values.lastName,
          confirmed: values.confirmed,
          active: values.active,
        };
        await create.mutateAsync(input);
        message.success('User created.');
      }
      onClose();
    } catch (err) {
      const e = toApiError(err);
      if (e.status === 409 && /email/i.test(e.message)) {
        setError('email', { type: 'server', message: 'This email is already in use.' });
      } else if (e.status === 400) {
        message.error(e.message);
      } else {
        message.error(e.message || 'Failed to save user.');
      }
    }
  });

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit user · ${user?.email}` : 'Add User'}
      onCancel={onClose}
      onOk={onSubmit}
      okText={isEdit ? 'Save changes' : 'Create user'}
      okButtonProps={{ loading: isSubmitting || create.isPending || update.isPending }}
      destroyOnClose
      maskClosable={false}
      width={520}
    >
      <form onSubmit={onSubmit} noValidate>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Field label="Display name" required error={errors.name?.message}>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input {...field} autoFocus autoComplete="off" placeholder="Eric Andersson" />
              )}
            />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input {...field} type="email" autoComplete="off" placeholder="user@company.com" />
              )}
            />
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="First name" error={errors.firstName?.message}>
              <Controller
                control={control}
                name="firstName"
                render={({ field }) => <Input {...field} autoComplete="off" />}
              />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Controller
                control={control}
                name="lastName"
                render={({ field }) => <Input {...field} autoComplete="off" />}
              />
            </Field>
          </div>
          <Field
            label={isEdit ? 'Password (leave blank to keep current)' : 'Password'}
            required={!isEdit}
            error={errors.password?.message}
          >
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input.Password
                  {...field}
                  autoComplete="new-password"
                  placeholder={isEdit ? '••••••••' : 'min 8 characters'}
                />
              )}
            />
          </Field>
          <div style={{ display: 'flex', gap: 24 }}>
            <Controller
              control={control}
              name="confirmed"
              render={({ field }) => (
                <Checkbox checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  Email confirmed
                </Checkbox>
              )}
            />
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Checkbox checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)}>
                  Active
                </Checkbox>
              )}
            />
          </div>
        </Space>
      </form>
    </Modal>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: '#dd4b39', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error && (
        <div role="alert" style={{ color: '#dd4b39', fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
