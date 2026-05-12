import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import Link from 'next/link';
import { PublicShell } from '../../../../../components/layout/PublicShell';

const { Title, Text } = Typography;

async function confirmToken(token: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/v1/auth/confirm/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, message: body.message || 'invalid_or_expired_token' };
    }
    return { ok: true, message: body.message };
  } catch {
    return { ok: false, message: 'network-error' };
  }
}

export default async function ConfirmAccountPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const result = await confirmToken(token);

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
        <Card bordered style={{ width: '100%', maxWidth: 440, textAlign: 'center' }} bodyStyle={{ padding: 40 }}>
          {result.ok ? (
            <>
              <CheckCircleOutlined style={{ fontSize: 56, color: '#52c41a', marginBottom: 16 }} />
              <Title level={3}>Account confirmed!</Title>
              <Text type="secondary">Your email address has been verified. You can now sign in.</Text>
              <div style={{ marginTop: 24 }}>
                <Link href="/login">
                  <Button type="primary" size="large">Sign in</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <CloseCircleOutlined style={{ fontSize: 56, color: '#ff4d4f', marginBottom: 16 }} />
              <Title level={3}>Link expired or invalid</Title>
              <Text type="secondary">
                This confirmation link has already been used or has expired.
                If you still need to confirm your account, ask your administrator to resend the email.
              </Text>
              <div style={{ marginTop: 24 }}>
                <Link href="/login">
                  <Button type="default" size="large">Back to Sign in</Button>
                </Link>
              </div>
            </>
          )}
        </Card>
      </main>
    </PublicShell>
  );
}
