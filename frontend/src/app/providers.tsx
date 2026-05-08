'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { ReactNode } from 'react';
import { QueryProvider } from '../components/QueryProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#954cfe',
            colorInfo: '#01b9d0',
          },
        }}
      >
        {/* AntApp adds context for message/notification/modal hooks. */}
        <AntApp>
          <QueryProvider>{children}</QueryProvider>
        </AntApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
