import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import './globals.css';

export const metadata: Metadata = {
  title: 'FP Analyzer',
  description: 'Manufacturing OEE — Phase 1 scaffold',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AntdRegistry>
            <ConfigProvider
              theme={{
                algorithm: theme.defaultAlgorithm,
                token: {
                  // Brand colors from legacy public/assets/sass/ — refined in Phase 4.
                  colorPrimary: '#954cfe',
                  colorInfo: '#01b9d0',
                },
              }}
            >
              {children}
            </ConfigProvider>
          </AntdRegistry>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
